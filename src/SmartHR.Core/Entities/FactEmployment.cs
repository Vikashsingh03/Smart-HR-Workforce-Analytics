namespace SmartHR.Core.Entities;

/// <summary>Employment facts for one employee. Maps to table fact_employment.</summary>
public class FactEmployment
{
    public int EmployeeNumber { get; set; }
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
    public string TenureBand { get; set; } = string.Empty;
    public string IncomeBand { get; set; } = string.Empty;

    public DimEmployee? Employee { get; set; }
}
