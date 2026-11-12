namespace SmartHR.Core.Entities;

/// <summary>One row per employee. Maps to table dim_employee.</summary>
public class DimEmployee
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

    public FactEmployment? Employment { get; set; }
    public FactSatisfaction? Satisfaction { get; set; }
    public FactAttrition? Attrition { get; set; }
}
