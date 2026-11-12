namespace SmartHR.Core.Entities;

/// <summary>Attrition flag for one employee (1 = left, 0 = stayed). Maps to table fact_attrition.</summary>
public class FactAttrition
{
    public int EmployeeNumber { get; set; }
    public int Attrition { get; set; }

    public DimEmployee? Employee { get; set; }
}
