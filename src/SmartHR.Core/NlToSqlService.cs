using System.Data;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SmartHR.Core.Dtos;

namespace SmartHR.Core;

/// <summary>
/// Turns a plain-English HR question into a read-only SELECT query and runs it.
/// Validation applies to every path: exactly one statement, must start with
/// SELECT, no write keywords, no comments or semicolons, only the four allowed
/// tables. Without a Gemini key, questions are mapped by keyword to the exact
/// queries from sql/queries.sql. The service never writes to the database.
/// </summary>
public class NlToSqlService
{
    private const string GeminiUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    private static readonly string[] AllowedTables =
        { "dim_employee", "fact_employment", "fact_satisfaction", "fact_attrition" };

    private static readonly Regex BannedKeyword = new(
        @"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex TableReference = new(
        @"(?:from|join)\s+([a-z_][a-z0-9_]*)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private const string NoKeyHelp =
        "AI key not configured — try a question about department, overtime, role, satisfaction, tenure, income, or priorities.";

    // Exact queries from sql/queries.sql (statement terminator omitted so the
    // same validation that guards generated SQL also accepts these).
    // One correction: Q2 in queries.sql selects column "overtime", which does
    // not exist — the schema column is "over_time" (see CONTRACT schema and
    // the OverTime field). Using "over_time" here so the query runs; the
    // query itself is otherwise verbatim.
    private const string Q1 = """
        SELECT department,
               COUNT(*) AS headcount,
               ROUND(AVG(attrition) * 100, 1) AS attrition_pct
        FROM dim_employee
        JOIN fact_attrition USING (employee_number)
        GROUP BY department
        ORDER BY attrition_pct DESC
        """;

    private const string Q2 = """
        SELECT over_time,
               COUNT(*) AS headcount,
               ROUND(AVG(attrition) * 100, 1) AS attrition_pct
        FROM dim_employee
        JOIN fact_employment USING (employee_number)
        JOIN fact_attrition USING (employee_number)
        GROUP BY over_time
        ORDER BY attrition_pct DESC
        """;

    private const string Q3 = """
        SELECT job_role,
               COUNT(*) AS headcount,
               ROUND(AVG(attrition) * 100, 1) AS attrition_pct
        FROM dim_employee
        JOIN fact_attrition USING (employee_number)
        GROUP BY job_role
        ORDER BY attrition_pct DESC
        """;

    private const string Q4 = """
        SELECT attrition,
               ROUND(AVG(job_satisfaction), 2) AS avg_job_satisfaction,
               ROUND(AVG(environment_satisfaction), 2) AS avg_env_satisfaction,
               ROUND(AVG(relationship_satisfaction), 2) AS avg_rel_satisfaction,
               ROUND(AVG(work_life_balance), 2) AS avg_work_life_balance,
               COUNT(*) AS headcount
        FROM fact_satisfaction
        JOIN fact_attrition USING (employee_number)
        GROUP BY attrition
        """;

    private const string Q5 = """
        SELECT CASE
                 WHEN years_at_company <= 2 THEN '0-2'
                 WHEN years_at_company <= 5 THEN '3-5'
                 WHEN years_at_company <= 10 THEN '6-10'
                 ELSE '10+'
               END AS tenure_band,
               COUNT(*) AS headcount,
               ROUND(AVG(attrition) * 100, 1) AS attrition_pct
        FROM dim_employee
        JOIN fact_employment USING (employee_number)
        JOIN fact_attrition USING (employee_number)
        GROUP BY tenure_band
        ORDER BY tenure_band
        """;

    private const string Q6 = """
        SELECT CASE
                 WHEN monthly_income < 3000 THEN '<3000'
                 WHEN monthly_income < 6000 THEN '3000-6000'
                 WHEN monthly_income < 10000 THEN '6000-10000'
                 ELSE '>10000'
               END AS income_band,
               COUNT(*) AS headcount,
               ROUND(AVG(attrition) * 100, 1) AS attrition_pct
        FROM fact_employment
        JOIN fact_attrition USING (employee_number)
        GROUP BY income_band
        ORDER BY income_band
        """;

    private const string Q7 = """
        SELECT department, job_role,
               COUNT(*) AS headcount,
               ROUND(AVG(attrition) * 100, 1) AS attrition_pct
        FROM dim_employee
        JOIN fact_attrition USING (employee_number)
        GROUP BY department, job_role
        HAVING COUNT(*) >= 50
        ORDER BY attrition_pct DESC
        """;

    private readonly HrDbContext _db;
    private readonly IConfiguration _config;
    private readonly HttpClient _http;

    public NlToSqlService(HrDbContext db, IConfiguration config, HttpClient http)
    {
        _db = db;
        _config = config;
        _http = http;
    }

    public async Task<NlToSqlResult> AskAsync(string question)
    {
        if (string.IsNullOrWhiteSpace(question))
        {
            return Blocked("Please ask a question in plain English.");
        }

        string? apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            apiKey = _config["Gemini:ApiKey"];
        }

        string? sql;
        string source;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            sql = MapKeyword(question);
            if (sql == null)
            {
                return Blocked(NoKeyHelp);
            }
            source = "keyword";
        }
        else
        {
            try
            {
                sql = await AskGeminiForSqlAsync(question, apiKey);
            }
            catch
            {
                return Blocked("The AI service could not be reached. " + NoKeyHelp);
            }
            if (sql == null)
            {
                return Blocked("The AI service did not return a usable SELECT query.");
            }
            source = "gemini";
        }

        string? validationError = Validate(sql);
        if (validationError != null)
        {
            return Blocked(validationError);
        }

        return await RunAsync(sql, source);
    }

    /// <summary>
    /// Keyword mapping for the no-key path. The most specific intent
    /// ("act first" / priority) is checked before the generic keywords.
    /// </summary>
    private static string? MapKeyword(string question)
    {
        string q = question.ToLowerInvariant();
        if (q.Contains("act first") || q.Contains("priority") || q.Contains("where should"))
        {
            return Q7;
        }
        if (q.Contains("department"))
        {
            return Q1;
        }
        if (q.Contains("overtime"))
        {
            return Q2;
        }
        if (q.Contains("role"))
        {
            return Q3;
        }
        if (q.Contains("satisfaction") || q.Contains("work-life"))
        {
            return Q4;
        }
        if (q.Contains("tenure") || q.Contains("years"))
        {
            return Q5;
        }
        if (q.Contains("income") || q.Contains("salary"))
        {
            return Q6;
        }
        return null;
    }

    /// <summary>Returns an error message when the SQL is not allowed, else null.</summary>
    private static string? Validate(string sql)
    {
        string s = sql.Trim();
        if (!s.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
        {
            return "Only SELECT queries are allowed.";
        }
        if (s.Contains(';'))
        {
            return "Only a single statement is allowed.";
        }
        if (s.Contains("--") || s.Contains("/*"))
        {
            return "Comments are not allowed in the query.";
        }
        if (BannedKeyword.IsMatch(s))
        {
            return "Only SELECT queries are allowed — write operations are blocked.";
        }
        foreach (Match match in TableReference.Matches(s))
        {
            string table = match.Groups[1].Value.ToLowerInvariant();
            if (!AllowedTables.Contains(table))
            {
                return $"Table '{table}' is not allowed. Allowed tables: {string.Join(", ", AllowedTables)}.";
            }
        }
        return null;
    }

    private async Task<NlToSqlResult> RunAsync(string sql, string source)
    {
        var connection = _db.Database.GetDbConnection();
        bool wasOpen = connection.State == ConnectionState.Open;
        if (!wasOpen)
        {
            await connection.OpenAsync();
        }
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = sql;
            await using var reader = await command.ExecuteReaderAsync();

            var columns = new List<string>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                columns.Add(reader.GetName(i));
            }

            var rows = new List<Dictionary<string, object>>();
            while (rows.Count < 50 && await reader.ReadAsync())
            {
                var row = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    object? value = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                    row[columns[i]] = value!;
                }
                rows.Add(row);
            }

            return new NlToSqlResult
            {
                Sql = sql,
                Columns = columns,
                Rows = rows,
                Source = source,
                BlockedReason = null
            };
        }
        finally
        {
            if (!wasOpen)
            {
                await connection.CloseAsync();
            }
        }
    }

    private async Task<string?> AskGeminiForSqlAsync(string question, string apiKey)
    {
        string schema =
            "Tables and columns (use ONLY these):\n" +
            "- dim_employee(employee_number, age, gender, department, job_role, education, education_field, marital_status, business_travel, distance_from_home)\n" +
            "- fact_employment(employee_number, monthly_income, daily_rate, hourly_rate, monthly_rate, percent_salary_hike, over_time, years_at_company, years_in_current_role, years_since_last_promotion, years_with_curr_manager, total_working_years, num_companies_worked, job_level, stock_option_level, training_times_last_year, job_involvement, performance_rating, tenure_band, income_band)\n" +
            "- fact_satisfaction(employee_number, environment_satisfaction, job_satisfaction, relationship_satisfaction, work_life_balance, satisfaction_score)\n" +
            "- fact_attrition(employee_number, attrition)\n" +
            "Join tables on employee_number. attrition is 1 when the employee left, 0 otherwise. over_time is 1 for Yes, 0 for No.";
        string prompt =
            "Write ONE SQLite/PostgreSQL SELECT query that answers this HR question. " +
            "Use only the tables and columns below. Never write data, never use more than one statement.\n\n" +
            schema + "\n\nQuestion: " + question + "\n\n" +
            "Reply with ONLY the SQL query, no explanation, no markdown fences.";

        using var request = new HttpRequestMessage(
            HttpMethod.Post, $"{GeminiUrl}?key={Uri.EscapeDataString(apiKey)}");
        request.Content = JsonContent.Create(new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            }
        });

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        using var response = await _http.SendAsync(request, cts.Token);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        string json = await response.Content.ReadAsStringAsync(cts.Token);
        using var doc = JsonDocument.Parse(json);
        string? text = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        text = text.Trim();
        if (text.StartsWith("```", StringComparison.Ordinal))
        {
            int firstNewline = text.IndexOf('\n');
            text = firstNewline >= 0 ? text[(firstNewline + 1)..] : string.Empty;
            int fence = text.LastIndexOf("```", StringComparison.Ordinal);
            if (fence >= 0)
            {
                text = text[..fence];
            }
        }
        text = text.Trim().TrimEnd(';', ' ', '\r', '\n').Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static NlToSqlResult Blocked(string reason) => new()
    {
        Sql = null,
        Columns = new List<string>(),
        Rows = new List<Dictionary<string, object>>(),
        Source = "blocked",
        BlockedReason = reason
    };
}
