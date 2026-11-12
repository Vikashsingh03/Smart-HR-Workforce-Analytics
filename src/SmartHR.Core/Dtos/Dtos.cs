namespace SmartHR.Core.Dtos;

/// <summary>One grouped attrition rate row. Rate is a percentage rounded to 1 decimal.</summary>
public class RateRow
{
    public string Group { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Left { get; set; }
    public double Rate { get; set; }
}

/// <summary>Dashboard headline figures.</summary>
public class SummaryDto
{
    public int TotalEmployees { get; set; }
    public int AttritionCount { get; set; }
    public double AttritionRate { get; set; }
    public int DepartmentCount { get; set; }
    public double AvgMonthlyIncome { get; set; }
}

/// <summary>Average satisfaction scores for one attrition value (0 = stayed, 1 = left).</summary>
public class SatisfactionRow
{
    public int Attrition { get; set; }
    public double AvgJobSatisfaction { get; set; }
    public double AvgEnvironmentSatisfaction { get; set; }
    public double AvgRelationshipSatisfaction { get; set; }
    public double AvgWorkLifeBalance { get; set; }
    public int Headcount { get; set; }
}

/// <summary>One department x job-role row for the "where HR should act first" list.</summary>
public class ActionRow
{
    public string Department { get; set; } = string.Empty;
    public string JobRole { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Left { get; set; }
    public double Rate { get; set; }
}

/// <summary>One employee row for the paged employee list.</summary>
public class EmployeeRow
{
    public int EmployeeNumber { get; set; }
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string JobRole { get; set; } = string.Empty;
    public int MonthlyIncome { get; set; }
    public int YearsAtCompany { get; set; }
    public int Attrition { get; set; }
}

/// <summary>A page of results with the total count for the pager.</summary>
public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

/// <summary>Result of the AI explanation endpoint.</summary>
public class AiExplainResult
{
    public string Explanation { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
}

/// <summary>Result of the natural-language-to-SQL endpoint.</summary>
public class NlToSqlResult
{
    public string? Sql { get; set; }
    public List<string> Columns { get; set; } = new();
    public List<Dictionary<string, object>> Rows { get; set; } = new();
    public string Source { get; set; } = string.Empty;
    public string? BlockedReason { get; set; }
}

/// <summary>One department x job-role cell for the heatmap (all cells, no headcount filter).</summary>
public class MatrixRow
{
    public string Department { get; set; } = string.Empty;
    public string JobRole { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Left { get; set; }
    public double Rate { get; set; }
}

/// <summary>Full employee profile for the detail drawer (all stored fields + derived bands).</summary>
public class EmployeeDetailDto
{
    public int EmployeeNumber { get; set; }
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string JobRole { get; set; } = string.Empty;
    public int Education { get; set; }
    public string EducationField { get; set; } = string.Empty;
    public string MaritalStatus { get; set; } = string.Empty;
    public string BusinessTravel { get; set; } = string.Empty;
    public int DistanceFromHome { get; set; }
    public int MonthlyIncome { get; set; }
    public int DailyRate { get; set; }
    public int HourlyRate { get; set; }
    public int MonthlyRate { get; set; }
    public int PercentSalaryHike { get; set; }
    public int OverTime { get; set; }
    public int YearsAtCompany { get; set; }
    public int YearsInCurrentRole { get; set; }
    public int YearsSinceLastPromotion { get; set; }
    public int YearsWithCurrManager { get; set; }
    public int TotalWorkingYears { get; set; }
    public int NumCompaniesWorked { get; set; }
    public int JobLevel { get; set; }
    public int StockOptionLevel { get; set; }
    public int TrainingTimesLastYear { get; set; }
    public int JobInvolvement { get; set; }
    public int PerformanceRating { get; set; }
    public int EnvironmentSatisfaction { get; set; }
    public int JobSatisfaction { get; set; }
    public int RelationshipSatisfaction { get; set; }
    public int WorkLifeBalance { get; set; }
    public double SatisfactionScore { get; set; }
    public string TenureBand { get; set; } = string.Empty;
    public string IncomeBand { get; set; } = string.Empty;
    public int Attrition { get; set; }
}
