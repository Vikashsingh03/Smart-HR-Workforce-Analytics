using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SmartHR.Core.Entities;

namespace SmartHR.Core;

/// <summary>Outcome of one CSV load run.</summary>
public class LoadResult
{
    public int RowsRead { get; set; }
    public int RowsLoaded { get; set; }
    public int RowsQuarantined { get; set; }
    public string Checksum { get; set; } = string.Empty;
    public bool AlreadyLoaded { get; set; }
    public long DurationMs { get; set; }
}

/// <summary>
/// Loads the IBM HR Analytics CSV into the database.
/// Applies the cleaning rules from the approved proposal: BOM stripped,
/// Yes/No mapped to 1/0, text fields trimmed and case-fixed, EmployeeCount /
/// StandardHours / Over18 dropped, bad rows quarantined (never deleted),
/// derived fields computed. Idempotent by file checksum; --force reloads.
/// </summary>
public class CsvLoader
{
    private static readonly string[] RequiredColumns =
    {
        "Age", "Attrition", "BusinessTravel", "DailyRate", "Department",
        "DistanceFromHome", "Education", "EducationField", "EmployeeNumber",
        "EnvironmentSatisfaction", "Gender", "HourlyRate", "JobInvolvement",
        "JobLevel", "JobRole", "JobSatisfaction", "MaritalStatus",
        "MonthlyIncome", "MonthlyRate", "NumCompaniesWorked", "OverTime",
        "PercentSalaryHike", "PerformanceRating", "RelationshipSatisfaction",
        "StockOptionLevel", "TotalWorkingYears", "TrainingTimesLastYear",
        "WorkLifeBalance", "YearsAtCompany", "YearsInCurrentRole",
        "YearsSinceLastPromotion", "YearsWithCurrManager"
    };

    public async Task<LoadResult> LoadAsync(string csvPath, HrDbContext db, bool force = false)
    {
        var stopwatch = Stopwatch.StartNew();
        var startedAt = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);

        byte[] bytes = await File.ReadAllBytesAsync(csvPath);
        string checksum = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        // Strip a UTF-8 BOM if present, then decode.
        int offset = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF ? 3 : 0;
        string text = Encoding.UTF8.GetString(bytes, offset, bytes.Length - offset);

        using var reader = new StringReader(text);
        string? headerLine = await reader.ReadLineAsync();
        if (headerLine == null)
        {
            throw new InvalidDataException($"CSV file is empty: {csvPath}");
        }
        var headers = ParseCsvLine(headerLine);
        var columnIndex = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < headers.Count; i++)
        {
            columnIndex[headers[i].Trim()] = i;
        }
        foreach (var required in RequiredColumns)
        {
            if (!columnIndex.ContainsKey(required))
            {
                throw new InvalidDataException($"CSV file is missing required column '{required}': {csvPath}");
            }
        }

        var dataLines = new List<string>();
        string? line;
        while ((line = await reader.ReadLineAsync()) != null)
        {
            if (!string.IsNullOrWhiteSpace(line))
            {
                dataLines.Add(line);
            }
        }
        int rowsRead = dataLines.Count;

        // Idempotency: same file already loaded and not forced -> skip.
        if (!force && await db.LoadLogs.AnyAsync(l =>
                l.SourceChecksum == checksum && l.Status == "Loaded"))
        {
            stopwatch.Stop();
            return new LoadResult
            {
                RowsRead = rowsRead,
                RowsLoaded = 0,
                RowsQuarantined = 0,
                Checksum = checksum,
                AlreadyLoaded = true,
                DurationMs = stopwatch.ElapsedMilliseconds
            };
        }

        var employees = new List<DimEmployee>();
        var employments = new List<FactEmployment>();
        var satisfactions = new List<FactSatisfaction>();
        var attritions = new List<FactAttrition>();
        var quarantined = new List<QuarantineRow>();

        foreach (var dataLine in dataLines)
        {
            ParseRow(dataLine, columnIndex, employees, employments, satisfactions, attritions, quarantined);
        }

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            if (force)
            {
                // Delete existing rows first (children before parent), plus the
                // earlier log rows for this file, all in the same transaction.
                db.FactAttritions.RemoveRange(db.FactAttritions);
                db.FactSatisfactions.RemoveRange(db.FactSatisfactions);
                db.FactEmployments.RemoveRange(db.FactEmployments);
                db.DimEmployees.RemoveRange(db.DimEmployees);
                db.QuarantineRows.RemoveRange(db.QuarantineRows);
                var oldLogs = await db.LoadLogs.Where(l => l.SourceChecksum == checksum).ToListAsync();
                db.LoadLogs.RemoveRange(oldLogs);
                await db.SaveChangesAsync();
            }

            db.DimEmployees.AddRange(employees);
            db.FactEmployments.AddRange(employments);
            db.FactSatisfactions.AddRange(satisfactions);
            db.FactAttritions.AddRange(attritions);
            db.QuarantineRows.AddRange(quarantined);
            await db.SaveChangesAsync();

            db.LoadLogs.Add(new LoadLog
            {
                RunStartedAt = startedAt,
                SourceFile = Path.GetFileName(csvPath),
                SourceChecksum = checksum,
                RowsRead = rowsRead,
                RowsLoaded = employees.Count,
                RowsQuarantined = quarantined.Count,
                Status = "Loaded"
            });
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        stopwatch.Stop();
        return new LoadResult
        {
            RowsRead = rowsRead,
            RowsLoaded = employees.Count,
            RowsQuarantined = quarantined.Count,
            Checksum = checksum,
            AlreadyLoaded = false,
            DurationMs = stopwatch.ElapsedMilliseconds
        };
    }

    private static void ParseRow(
        string dataLine,
        Dictionary<string, int> columnIndex,
        List<DimEmployee> employees,
        List<FactEmployment> employments,
        List<FactSatisfaction> satisfactions,
        List<FactAttrition> attritions,
        List<QuarantineRow> quarantined)
    {
        var fields = ParseCsvLine(dataLine);
        string Get(string column) =>
            columnIndex.TryGetValue(column, out int i) && i < fields.Count ? fields[i] : string.Empty;

        int? employeeNumber = ParseInt(Get("EmployeeNumber"));
        string? Quarantine(string reason)
        {
            quarantined.Add(new QuarantineRow
            {
                EmployeeNumber = employeeNumber,
                Reason = reason,
                RawLine = dataLine
            });
            return null;
        }

        // Required fields must be present.
        foreach (var required in new[] { "Age", "Gender", "Department", "JobRole", "MonthlyIncome", "Attrition" })
        {
            if (string.IsNullOrWhiteSpace(Get(required)))
            {
                Quarantine($"Missing required field: {required}");
                return;
            }
        }

        int? age = ParseInt(Get("Age"));
        int? monthlyIncome = ParseInt(Get("MonthlyIncome"));
        int? yearsAtCompany = ParseInt(Get("YearsAtCompany"));
        if (age == null || monthlyIncome == null || yearsAtCompany == null)
        {
            Quarantine("Invalid number in a required numeric field");
            return;
        }
        if (age < 18 || age > 65)
        {
            Quarantine($"Age out of range: {age}");
            return;
        }
        if (monthlyIncome <= 0)
        {
            Quarantine($"MonthlyIncome out of range: {monthlyIncome}");
            return;
        }
        if (yearsAtCompany < 0)
        {
            Quarantine($"YearsAtCompany out of range: {yearsAtCompany}");
            return;
        }

        // All other numeric fields must parse; a bad value quarantines the row.
        int? ParseRequiredInt(string column)
        {
            var value = ParseInt(Get(column));
            if (value == null)
            {
                Quarantine($"Invalid number in column {column}: '{Get(column)}'");
            }
            return value;
        }

        int? distanceFromHome = ParseRequiredInt("DistanceFromHome");
        int? education = ParseRequiredInt("Education");
        int? dailyRate = ParseRequiredInt("DailyRate");
        int? hourlyRate = ParseRequiredInt("HourlyRate");
        int? monthlyRate = ParseRequiredInt("MonthlyRate");
        int? percentSalaryHike = ParseRequiredInt("PercentSalaryHike");
        int? yearsInCurrentRole = ParseRequiredInt("YearsInCurrentRole");
        int? yearsSinceLastPromotion = ParseRequiredInt("YearsSinceLastPromotion");
        int? yearsWithCurrManager = ParseRequiredInt("YearsWithCurrManager");
        int? totalWorkingYears = ParseRequiredInt("TotalWorkingYears");
        int? numCompaniesWorked = ParseRequiredInt("NumCompaniesWorked");
        int? jobLevel = ParseRequiredInt("JobLevel");
        int? stockOptionLevel = ParseRequiredInt("StockOptionLevel");
        int? trainingTimesLastYear = ParseRequiredInt("TrainingTimesLastYear");
        int? jobInvolvement = ParseRequiredInt("JobInvolvement");
        int? performanceRating = ParseRequiredInt("PerformanceRating");
        int? environmentSatisfaction = ParseRequiredInt("EnvironmentSatisfaction");
        int? jobSatisfaction = ParseRequiredInt("JobSatisfaction");
        int? relationshipSatisfaction = ParseRequiredInt("RelationshipSatisfaction");
        int? workLifeBalance = ParseRequiredInt("WorkLifeBalance");
        if (employeeNumber == null ||
            distanceFromHome == null || education == null || dailyRate == null ||
            hourlyRate == null || monthlyRate == null || percentSalaryHike == null ||
            yearsInCurrentRole == null || yearsSinceLastPromotion == null ||
            yearsWithCurrManager == null || totalWorkingYears == null ||
            numCompaniesWorked == null || jobLevel == null || stockOptionLevel == null ||
            trainingTimesLastYear == null || jobInvolvement == null ||
            performanceRating == null || environmentSatisfaction == null ||
            jobSatisfaction == null || relationshipSatisfaction == null ||
            workLifeBalance == null)
        {
            return;
        }

        // Cleaning: trim and fix case for text fields; Yes/No -> 1/0.
        string department = FixCase(Get("Department"));
        string jobRole = FixCase(Get("JobRole"));
        string maritalStatus = FixCase(Get("MaritalStatus"));
        string businessTravel = FixCase(Get("BusinessTravel"));
        string gender = Get("Gender").Trim();
        string educationField = Get("EducationField").Trim();
        int attrition = ParseYesNo(Get("Attrition"));
        int overTime = ParseYesNo(Get("OverTime"));

        // Derived fields.
        string tenureBand = yearsAtCompany.Value <= 2 ? "0-2"
            : yearsAtCompany.Value <= 5 ? "3-5"
            : yearsAtCompany.Value <= 10 ? "6-10" : "10+";
        string incomeBand = monthlyIncome.Value < 3000 ? "<3000"
            : monthlyIncome.Value < 6000 ? "3000-6000"
            : monthlyIncome.Value < 10000 ? "6000-10000" : ">10000";
        double satisfactionScore = Math.Round(
            (jobSatisfaction.Value + environmentSatisfaction.Value + relationshipSatisfaction.Value) / 3.0, 2);

        // EmployeeCount, StandardHours and Over18 are dropped by design.
        employees.Add(new DimEmployee
        {
            EmployeeNumber = employeeNumber.Value,
            Age = age.Value,
            Gender = gender,
            Department = department,
            JobRole = jobRole,
            Education = education.Value,
            EducationField = educationField,
            MaritalStatus = maritalStatus,
            BusinessTravel = businessTravel,
            DistanceFromHome = distanceFromHome.Value
        });
        employments.Add(new FactEmployment
        {
            EmployeeNumber = employeeNumber.Value,
            MonthlyIncome = monthlyIncome.Value,
            DailyRate = dailyRate.Value,
            HourlyRate = hourlyRate.Value,
            MonthlyRate = monthlyRate.Value,
            PercentSalaryHike = percentSalaryHike.Value,
            OverTime = overTime,
            YearsAtCompany = yearsAtCompany.Value,
            YearsInCurrentRole = yearsInCurrentRole.Value,
            YearsSinceLastPromotion = yearsSinceLastPromotion.Value,
            YearsWithCurrManager = yearsWithCurrManager.Value,
            TotalWorkingYears = totalWorkingYears.Value,
            NumCompaniesWorked = numCompaniesWorked.Value,
            JobLevel = jobLevel.Value,
            StockOptionLevel = stockOptionLevel.Value,
            TrainingTimesLastYear = trainingTimesLastYear.Value,
            JobInvolvement = jobInvolvement.Value,
            PerformanceRating = performanceRating.Value,
            TenureBand = tenureBand,
            IncomeBand = incomeBand
        });
        satisfactions.Add(new FactSatisfaction
        {
            EmployeeNumber = employeeNumber.Value,
            EnvironmentSatisfaction = environmentSatisfaction.Value,
            JobSatisfaction = jobSatisfaction.Value,
            RelationshipSatisfaction = relationshipSatisfaction.Value,
            WorkLifeBalance = workLifeBalance.Value,
            SatisfactionScore = satisfactionScore
        });
        attritions.Add(new FactAttrition
        {
            EmployeeNumber = employeeNumber.Value,
            Attrition = attrition
        });
    }

    private static int? ParseInt(string value) =>
        int.TryParse(value.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int result)
            ? result
            : null;

    private static int ParseYesNo(string value) =>
        string.Equals(value.Trim(), "Yes", StringComparison.OrdinalIgnoreCase) ? 1 : 0;

    /// <summary>
    /// Trims the value; if it is all lower-case or all upper-case, converts it
    /// to title case word by word (separators such as spaces, underscores and
    /// ampersands are preserved). Mixed-case values are left untouched.
    /// </summary>
    private static string FixCase(string value)
    {
        string trimmed = value.Trim();
        if (trimmed.Length == 0)
        {
            return trimmed;
        }
        bool allLower = trimmed == trimmed.ToLowerInvariant();
        bool allUpper = trimmed == trimmed.ToUpperInvariant();
        if (!allLower && !allUpper)
        {
            return trimmed;
        }
        var chars = trimmed.ToCharArray();
        bool newWord = true;
        for (int i = 0; i < chars.Length; i++)
        {
            if (char.IsLetter(chars[i]))
            {
                chars[i] = newWord
                    ? char.ToUpperInvariant(chars[i])
                    : char.ToLowerInvariant(chars[i]);
                newWord = false;
            }
            else
            {
                newWord = true;
            }
        }
        return new string(chars);
    }

    /// <summary>Minimal CSV line parser: handles quoted fields and doubled quotes.</summary>
    private static List<string> ParseCsvLine(string line)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        bool inQuotes = false;
        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        current.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    current.Append(c);
                }
            }
            else if (c == '"')
            {
                inQuotes = true;
            }
            else if (c == ',')
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }
        fields.Add(current.ToString());
        return fields;
    }
}
