using Microsoft.EntityFrameworkCore;
using SmartHR.Core.Dtos;

namespace SmartHR.Core;

/// <summary>
/// All analytical queries as LINQ, provider-agnostic. Results match
/// sql/queries.sql Q1-Q7: rates are percentages rounded to 1 decimal,
/// satisfaction averages rounded to 2 decimals, bands in the order given
/// in the contract (0-2, 3-5, 6-10, 10+ and &lt;3000, 3000-6000, 6000-10000, &gt;10000).
/// </summary>
public class AnalyticsService
{
    private static readonly string[] TenureBandOrder = { "0-2", "3-5", "6-10", "10+" };
    private static readonly string[] IncomeBandOrder = { "<3000", "3000-6000", "6000-10000", ">10000" };
    private static readonly string[] AgeBandOrder = { "18-25", "26-35", "36-45", "46-55", "56+" };
    private static readonly string[] DistanceBandOrder = { "1-5", "6-10", "11-20", "21+" };

    /// <summary>One grouped aggregate before the rate is computed.</summary>
    private sealed record GroupAgg(string Group, int Total, int Left, string? Department, string? Band);

    private readonly HrDbContext _db;

    public AnalyticsService(HrDbContext db)
    {
        _db = db;
    }

    public async Task<SummaryDto> GetSummaryAsync()
    {
        int total = await _db.DimEmployees.CountAsync();
        int left = await _db.FactAttritions.SumAsync(a => a.Attrition);
        int departments = await _db.DimEmployees.Select(e => e.Department).Distinct().CountAsync();
        double avgIncome = total == 0 ? 0 : await _db.FactEmployments.AverageAsync(f => f.MonthlyIncome);
        return new SummaryDto
        {
            TotalEmployees = total,
            AttritionCount = left,
            AttritionRate = total == 0 ? 0 : Math.Round(100.0 * left / total, 1),
            DepartmentCount = departments,
            AvgMonthlyIncome = Math.Round(avgIncome, 0)
        };
    }

    public async Task<List<RateRow>> GetAttritionByDepartmentAsync()
    {
        var groups = await _db.DimEmployees
            .Join(_db.FactAttritions,
                e => e.EmployeeNumber, a => a.EmployeeNumber,
                (e, a) => new { e.Department, a.Attrition })
            .GroupBy(x => x.Department)
            .Select(g => new GroupAgg(g.Key, g.Count(), g.Sum(x => x.Attrition), null, null))
            .ToListAsync();
        return ToRateRows(groups).OrderByDescending(r => r.Rate).ThenBy(r => r.Group).ToList();
    }

    public async Task<List<RateRow>> GetOvertimeAsync()
    {
        var groups = await _db.FactEmployments
            .Join(_db.FactAttritions,
                f => f.EmployeeNumber, a => a.EmployeeNumber,
                (f, a) => new { f.OverTime, a.Attrition })
            .GroupBy(x => x.OverTime)
            .Select(g => new GroupAgg(g.Key == 1 ? "Yes" : "No", g.Count(), g.Sum(x => x.Attrition), null, null))
            .ToListAsync();
        return ToRateRows(groups).OrderByDescending(r => r.Rate).ThenBy(r => r.Group).ToList();
    }

    public async Task<List<RateRow>> GetOvertimeByDepartmentAsync()
    {
        var groups = await _db.DimEmployees
            .Join(_db.FactEmployments,
                e => e.EmployeeNumber, f => f.EmployeeNumber,
                (e, f) => new { e.Department, f.OverTime, f.EmployeeNumber })
            .Join(_db.FactAttritions,
                x => x.EmployeeNumber, a => a.EmployeeNumber,
                (x, a) => new { x.Department, x.OverTime, a.Attrition })
            .GroupBy(x => new { x.Department, x.OverTime })
            .Select(g => new GroupAgg(
                g.Key.Department + " — " + (g.Key.OverTime == 1 ? "Yes" : "No"),
                g.Count(), g.Sum(x => x.Attrition), g.Key.Department, null))
            .ToListAsync();
        return ToRateRows(groups)
            .OrderBy(r => groups.First(g => g.Group == r.Group).Department)
            .ThenByDescending(r => r.Rate)
            .ToList();
    }

    public async Task<List<RateRow>> GetAttritionByRoleAsync()
    {
        var groups = await _db.DimEmployees
            .Join(_db.FactAttritions,
                e => e.EmployeeNumber, a => a.EmployeeNumber,
                (e, a) => new { e.JobRole, a.Attrition })
            .GroupBy(x => x.JobRole)
            .Select(g => new GroupAgg(g.Key, g.Count(), g.Sum(x => x.Attrition), null, null))
            .ToListAsync();
        return ToRateRows(groups).OrderByDescending(r => r.Rate).ThenBy(r => r.Group).ToList();
    }

    public async Task<List<SatisfactionRow>> GetSatisfactionAsync()
    {
        var groups = await _db.FactSatisfactions
            .Join(_db.FactAttritions,
                s => s.EmployeeNumber, a => a.EmployeeNumber,
                (s, a) => new { a.Attrition, s })
            .GroupBy(x => x.Attrition)
            .Select(g => new
            {
                Attrition = g.Key,
                AvgJob = g.Average(x => x.s.JobSatisfaction),
                AvgEnv = g.Average(x => x.s.EnvironmentSatisfaction),
                AvgRel = g.Average(x => x.s.RelationshipSatisfaction),
                AvgWlb = g.Average(x => x.s.WorkLifeBalance),
                Headcount = g.Count()
            })
            .ToListAsync();
        return groups
            .Select(g => new SatisfactionRow
            {
                Attrition = g.Attrition,
                AvgJobSatisfaction = Math.Round(g.AvgJob, 2),
                AvgEnvironmentSatisfaction = Math.Round(g.AvgEnv, 2),
                AvgRelationshipSatisfaction = Math.Round(g.AvgRel, 2),
                AvgWorkLifeBalance = Math.Round(g.AvgWlb, 2),
                Headcount = g.Headcount
            })
            .OrderBy(r => r.Attrition)
            .ToList();
    }

    public async Task<List<RateRow>> GetTenureAsync()
    {
        var groups = await _db.FactEmployments
            .Join(_db.FactAttritions,
                f => f.EmployeeNumber, a => a.EmployeeNumber,
                (f, a) => new { f.TenureBand, a.Attrition })
            .GroupBy(x => x.TenureBand)
            .Select(g => new GroupAgg(g.Key, g.Count(), g.Sum(x => x.Attrition), null, null))
            .ToListAsync();
        return ToRateRows(groups).OrderBy(r => Array.IndexOf(TenureBandOrder, r.Group)).ToList();
    }

    public async Task<List<RateRow>> GetIncomeAsync()
    {
        var groups = await _db.FactEmployments
            .Join(_db.FactAttritions,
                f => f.EmployeeNumber, a => a.EmployeeNumber,
                (f, a) => new { f.IncomeBand, a.Attrition })
            .GroupBy(x => x.IncomeBand)
            .Select(g => new GroupAgg(g.Key, g.Count(), g.Sum(x => x.Attrition), null, null))
            .ToListAsync();
        return ToRateRows(groups).OrderBy(r => Array.IndexOf(IncomeBandOrder, r.Group)).ToList();
    }

    public async Task<List<RateRow>> GetIncomeByDepartmentAsync()
    {
        var groups = await _db.DimEmployees
            .Join(_db.FactEmployments,
                e => e.EmployeeNumber, f => f.EmployeeNumber,
                (e, f) => new { e.Department, f.IncomeBand, f.EmployeeNumber })
            .Join(_db.FactAttritions,
                x => x.EmployeeNumber, a => a.EmployeeNumber,
                (x, a) => new { x.Department, x.IncomeBand, a.Attrition })
            .GroupBy(x => new { x.Department, x.IncomeBand })
            .Select(g => new GroupAgg(
                g.Key.Department + " — " + g.Key.IncomeBand,
                g.Count(), g.Sum(x => x.Attrition), g.Key.Department, g.Key.IncomeBand))
            .ToListAsync();
        var rows = ToRateRows(groups);
        var byGroup = groups.ToDictionary(g => g.Group);
        return rows
            .OrderBy(r => byGroup[r.Group].Department)
            .ThenBy(r => Array.IndexOf(IncomeBandOrder, byGroup[r.Group].Band))
            .ToList();
    }

    public async Task<List<ActionRow>> GetActionFirstAsync()
    {
        var groups = await _db.DimEmployees
            .Join(_db.FactAttritions,
                e => e.EmployeeNumber, a => a.EmployeeNumber,
                (e, a) => new { e.Department, e.JobRole, a.Attrition })
            .GroupBy(x => new { x.Department, x.JobRole })
            .Select(g => new
            {
                g.Key.Department,
                g.Key.JobRole,
                Total = g.Count(),
                Left = g.Sum(x => x.Attrition)
            })
            .Where(g => g.Total >= 50)
            .ToListAsync();
        return groups
            .Select(g => new ActionRow
            {
                Department = g.Department,
                JobRole = g.JobRole,
                Total = g.Total,
                Left = g.Left,
                Rate = Math.Round(100.0 * g.Left / g.Total, 1)
            })
            .OrderByDescending(r => r.Rate)
            .ThenBy(r => r.Department)
            .ThenBy(r => r.JobRole)
            .ToList();
    }

    public async Task<PagedResult<EmployeeRow>> GetEmployeesAsync(
        string? search, string? department, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = from e in _db.DimEmployees
                    join f in _db.FactEmployments on e.EmployeeNumber equals f.EmployeeNumber
                    join a in _db.FactAttritions on e.EmployeeNumber equals a.EmployeeNumber
                    select new EmployeeRow
                    {
                        EmployeeNumber = e.EmployeeNumber,
                        Age = e.Age,
                        Gender = e.Gender,
                        Department = e.Department,
                        JobRole = e.JobRole,
                        MonthlyIncome = f.MonthlyIncome,
                        YearsAtCompany = f.YearsAtCompany,
                        Attrition = a.Attrition
                    };

        if (!string.IsNullOrWhiteSpace(department))
        {
            string wanted = department.Trim().ToLowerInvariant();
            query = query.Where(x => x.Department.ToLower() == wanted);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            string term = search.Trim().ToLowerInvariant();
            if (int.TryParse(term, out int number))
            {
                query = query.Where(x => x.EmployeeNumber == number
                    || x.JobRole.ToLower().Contains(term)
                    || x.Department.ToLower().Contains(term));
            }
            else
            {
                query = query.Where(x => x.JobRole.ToLower().Contains(term)
                    || x.Department.ToLower().Contains(term));
            }
        }

        int total = await query.CountAsync();
        var items = await query
            .OrderBy(x => x.EmployeeNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        return new PagedResult<EmployeeRow>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<List<RateRow>> GetAgeBandsAsync()
    {
        var groups = await _db.DimEmployees
            .Join(_db.FactAttritions,
                e => e.EmployeeNumber, a => a.EmployeeNumber,
                (e, a) => new { e.Age, a.Attrition })
            .GroupBy(x => x.Age <= 25 ? "18-25"
                : x.Age <= 35 ? "26-35"
                : x.Age <= 45 ? "36-45"
                : x.Age <= 55 ? "46-55"
                : "56+")
            .Select(g => new GroupAgg(g.Key, g.Count(), g.Sum(x => x.Attrition), null, null))
            .ToListAsync();
        return ToRateRows(groups).OrderBy(r => Array.IndexOf(AgeBandOrder, r.Group)).ToList();
    }

    public async Task<List<RateRow>> GetDistanceBandsAsync()
    {
        var groups = await _db.DimEmployees
            .Join(_db.FactAttritions,
                e => e.EmployeeNumber, a => a.EmployeeNumber,
                (e, a) => new { e.DistanceFromHome, a.Attrition })
            .GroupBy(x => x.DistanceFromHome <= 5 ? "1-5"
                : x.DistanceFromHome <= 10 ? "6-10"
                : x.DistanceFromHome <= 20 ? "11-20"
                : "21+")
            .Select(g => new GroupAgg(g.Key, g.Count(), g.Sum(x => x.Attrition), null, null))
            .ToListAsync();
        return ToRateRows(groups).OrderBy(r => Array.IndexOf(DistanceBandOrder, r.Group)).ToList();
    }

    public async Task<List<RateRow>> GetJobLevelAsync()
    {
        var groups = await _db.FactEmployments
            .Join(_db.FactAttritions,
                f => f.EmployeeNumber, a => a.EmployeeNumber,
                (f, a) => new { f.JobLevel, a.Attrition })
            .GroupBy(x => x.JobLevel)
            .Select(g => new GroupAgg("Level " + g.Key, g.Count(), g.Sum(x => x.Attrition), null, null))
            .ToListAsync();
        return ToRateRows(groups).OrderBy(r => r.Group).ToList();
    }

    public async Task<List<MatrixRow>> GetDepartmentRoleMatrixAsync()
    {
        var groups = await _db.DimEmployees
            .Join(_db.FactAttritions,
                e => e.EmployeeNumber, a => a.EmployeeNumber,
                (e, a) => new { e.Department, e.JobRole, a.Attrition })
            .GroupBy(x => new { x.Department, x.JobRole })
            .Select(g => new
            {
                g.Key.Department,
                g.Key.JobRole,
                Total = g.Count(),
                Left = g.Sum(x => x.Attrition)
            })
            .ToListAsync();
        return groups
            .Select(g => new MatrixRow
            {
                Department = g.Department,
                JobRole = g.JobRole,
                Total = g.Total,
                Left = g.Left,
                Rate = Math.Round(100.0 * g.Left / g.Total, 1)
            })
            .OrderByDescending(r => r.Rate)
            .ThenBy(r => r.Department)
            .ThenBy(r => r.JobRole)
            .ToList();
    }

    public async Task<EmployeeDetailDto?> GetEmployeeDetailAsync(int employeeNumber)
    {
        return await (from e in _db.DimEmployees
                      join f in _db.FactEmployments on e.EmployeeNumber equals f.EmployeeNumber
                      join s in _db.FactSatisfactions on e.EmployeeNumber equals s.EmployeeNumber
                      join a in _db.FactAttritions on e.EmployeeNumber equals a.EmployeeNumber
                      where e.EmployeeNumber == employeeNumber
                      select new EmployeeDetailDto
                      {
                          EmployeeNumber = e.EmployeeNumber,
                          Age = e.Age,
                          Gender = e.Gender,
                          Department = e.Department,
                          JobRole = e.JobRole,
                          Education = e.Education,
                          EducationField = e.EducationField,
                          MaritalStatus = e.MaritalStatus,
                          BusinessTravel = e.BusinessTravel,
                          DistanceFromHome = e.DistanceFromHome,
                          MonthlyIncome = f.MonthlyIncome,
                          DailyRate = f.DailyRate,
                          HourlyRate = f.HourlyRate,
                          MonthlyRate = f.MonthlyRate,
                          PercentSalaryHike = f.PercentSalaryHike,
                          OverTime = f.OverTime,
                          YearsAtCompany = f.YearsAtCompany,
                          YearsInCurrentRole = f.YearsInCurrentRole,
                          YearsSinceLastPromotion = f.YearsSinceLastPromotion,
                          YearsWithCurrManager = f.YearsWithCurrManager,
                          TotalWorkingYears = f.TotalWorkingYears,
                          NumCompaniesWorked = f.NumCompaniesWorked,
                          JobLevel = f.JobLevel,
                          StockOptionLevel = f.StockOptionLevel,
                          TrainingTimesLastYear = f.TrainingTimesLastYear,
                          JobInvolvement = f.JobInvolvement,
                          PerformanceRating = f.PerformanceRating,
                          EnvironmentSatisfaction = s.EnvironmentSatisfaction,
                          JobSatisfaction = s.JobSatisfaction,
                          RelationshipSatisfaction = s.RelationshipSatisfaction,
                          WorkLifeBalance = s.WorkLifeBalance,
                          SatisfactionScore = s.SatisfactionScore,
                          TenureBand = f.TenureBand,
                          IncomeBand = f.IncomeBand,
                          Attrition = a.Attrition
                      })
            .FirstOrDefaultAsync();
    }

    private static List<RateRow> ToRateRows(IEnumerable<GroupAgg> groups) =>
        groups.Select(g => new RateRow
        {
            Group = g.Group,
            Total = g.Total,
            Left = g.Left,
            Rate = g.Total == 0 ? 0 : Math.Round(100.0 * g.Left / g.Total, 1)
        }).ToList();
}
