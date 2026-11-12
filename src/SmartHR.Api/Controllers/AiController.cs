using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SmartHR.Core;
using SmartHR.Core.Dtos;
using SmartHR.Api.Models;

namespace SmartHR.Api.Controllers;

[ApiController]
[Route("api/ai")]
public class AiController : ControllerBase
{
    private readonly AiService _ai;
    private readonly NlToSqlService _nlToSql;

    public AiController(AiService ai, NlToSqlService nlToSql)
    {
        _ai = ai;
        _nlToSql = nlToSql;
    }

    [HttpPost("explain")]
    public async Task<ActionResult<AiExplainResult>> Explain([FromBody] ExplainRequest request)
    {
        var facts = request.Facts.Select(f => (f.Label, ConvertValue(f.Value)));
        return Ok(await _ai.ExplainAsync(request.Title, facts));
    }

    [HttpPost("ask")]
    public async Task<ActionResult<NlToSqlResult>> Ask([FromBody] AskRequest request)
        => Ok(await _nlToSql.AskAsync(request.Question));

    private static object ConvertValue(JsonElement element)
        => element.ValueKind switch
        {
            JsonValueKind.String => element.GetString() ?? string.Empty,
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null or JsonValueKind.Undefined => string.Empty,
            _ => element.GetRawText()
        };
}
