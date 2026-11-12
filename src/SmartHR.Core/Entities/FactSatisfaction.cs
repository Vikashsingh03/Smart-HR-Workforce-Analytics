namespace SmartHR.Core.Entities;

/// <summary>Satisfaction facts for one employee. Maps to table fact_satisfaction.</summary>
public class FactSatisfaction
{
    public int EmployeeNumber { get; set; }
    public int EnvironmentSatisfaction { get; set; }
    public int JobSatisfaction { get; set; }
    public int RelationshipSatisfaction { get; set; }
    public int WorkLifeBalance { get; set; }
    public double SatisfactionScore { get; set; }

    public DimEmployee? Employee { get; set; }
}
