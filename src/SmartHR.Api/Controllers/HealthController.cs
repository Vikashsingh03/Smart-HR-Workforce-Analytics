using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHR.Core;

namespace SmartHR.Api.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    private readonly HrDbContext _db;
    private readonly IConfiguration _config;

    public HealthController(HrDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var rows = await _db.DimEmployees.CountAsync();
        var provider = _config["Database:Provider"] ?? "Sqlite";
        return Ok(new { status = "ok", rows, provider });
    }
}
