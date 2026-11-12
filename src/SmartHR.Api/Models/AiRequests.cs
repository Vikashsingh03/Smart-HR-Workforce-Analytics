using System.Text.Json;

namespace SmartHR.Api.Models;

public sealed class ExplainRequest
{
    public string Title { get; set; } = string.Empty;
    public List<FactItem> Facts { get; set; } = new();
}

public sealed class FactItem
{
    public string Label { get; set; } = string.Empty;
    public JsonElement Value { get; set; }
}

public sealed class AskRequest
{
    public string Question { get; set; } = string.Empty;
}
