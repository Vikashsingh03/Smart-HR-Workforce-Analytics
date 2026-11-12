using Microsoft.AspNetCore.Mvc;
using SmartHR.Core;
using SmartHR.Core.Dtos;

namespace SmartHR.Api.Controllers;

[ApiController]
[Route("api/analytics")]
public class AnalyticsController : ControllerBase
{
    private readonly AnalyticsService _analytics;

    public AnalyticsController(AnalyticsService analytics)
    {
        _analytics = analytics;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<SummaryDto>> GetSummary()
        => Ok(await _analytics.GetSummaryAsync());

    [HttpGet("attrition-by-department")]
    public async Task<ActionResult<List<RateRow>>> GetAttritionByDepartment()
        => Ok(await _analytics.GetAttritionByDepartmentAsync());

    [HttpGet("overtime")]
    public async Task<ActionResult<List<RateRow>>> GetOvertime([FromQuery] bool byDepartment = false)
        => Ok(byDepartment
            ? await _analytics.GetOvertimeByDepartmentAsync()
            : await _analytics.GetOvertimeAsync());

    [HttpGet("attrition-by-role")]
    public async Task<ActionResult<List<RateRow>>> GetAttritionByRole()
        => Ok(await _analytics.GetAttritionByRoleAsync());

    [HttpGet("satisfaction")]
    public async Task<ActionResult<List<SatisfactionRow>>> GetSatisfaction()
        => Ok(await _analytics.GetSatisfactionAsync());

    [HttpGet("tenure")]
    public async Task<ActionResult<List<RateRow>>> GetTenure()
        => Ok(await _analytics.GetTenureAsync());

    [HttpGet("income")]
    public async Task<ActionResult<List<RateRow>>> GetIncome([FromQuery] bool byDepartment = false)
        => Ok(byDepartment
            ? await _analytics.GetIncomeByDepartmentAsync()
            : await _analytics.GetIncomeAsync());

    [HttpGet("action-first")]
    public async Task<ActionResult<List<ActionRow>>> GetActionFirst()
        => Ok(await _analytics.GetActionFirstAsync());

    [HttpGet("age-bands")]
    public async Task<ActionResult<List<RateRow>>> GetAgeBands()
        => Ok(await _analytics.GetAgeBandsAsync());

    [HttpGet("distance")]
    public async Task<ActionResult<List<RateRow>>> GetDistanceBands()
        => Ok(await _analytics.GetDistanceBandsAsync());

    [HttpGet("job-level")]
    public async Task<ActionResult<List<RateRow>>> GetJobLevel()
        => Ok(await _analytics.GetJobLevelAsync());

    [HttpGet("department-role-matrix")]
    public async Task<ActionResult<List<MatrixRow>>> GetDepartmentRoleMatrix()
        => Ok(await _analytics.GetDepartmentRoleMatrixAsync());
}
