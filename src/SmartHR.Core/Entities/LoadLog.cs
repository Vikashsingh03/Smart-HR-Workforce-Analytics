namespace SmartHR.Core.Entities;

/// <summary>One row per ingestion run. Maps to table load_log.</summary>
public class LoadLog
{
    public int Id { get; set; }
    public string RunStartedAt { get; set; } = string.Empty;
    public string SourceFile { get; set; } = string.Empty;
    public string SourceChecksum { get; set; } = string.Empty;
    public int RowsRead { get; set; }
    public int RowsLoaded { get; set; }
    public int RowsQuarantined { get; set; }
    public string Status { get; set; } = string.Empty;
}
