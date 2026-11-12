namespace SmartHR.Core.Entities;

/// <summary>A source row that failed validation. Kept for inspection, never deleted quietly. Maps to table quarantine.</summary>
public class QuarantineRow
{
    public int Id { get; set; }
    public int? EmployeeNumber { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string RawLine { get; set; } = string.Empty;
}
