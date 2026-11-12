using Microsoft.AspNetCore.Mvc;
using SmartHR.Core;
using SmartHR.Core.Dtos;

namespace SmartHR.Api.Controllers;

[ApiController]
[Route("api/employees")]
public class EmployeesController : ControllerBase
{
    private readonly AnalyticsService _analytics;

    public EmployeesController(AnalyticsService analytics)
    {
        _analytics = analytics;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<EmployeeRow>>> Get(
        [FromQuery] string? search,
        [FromQuery] string? department,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
        => Ok(await _analytics.GetEmployeesAsync(search, department, page, pageSize));

    [HttpGet("{employeeNumber:int}")]
    public async Task<ActionResult<EmployeeDetailDto>> GetById(int employeeNumber)
    {
        var detail = await _analytics.GetEmployeeDetailAsync(employeeNumber);
        if (detail is null)
        {
            return NotFound();
        }
        return Ok(detail);
    }
}
