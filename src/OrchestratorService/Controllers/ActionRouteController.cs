using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrchestratorService.Data;
using OrchestratorService.Models;
using OrchestratorService.Services; // [NEW] For N8nService

namespace OrchestratorService.Controllers;

[ApiController]
[Route("api/routes")]
public class ActionRouteController : ControllerBase
{
    private readonly OrchestratorContext _db;
    private readonly ILogger<ActionRouteController> _logger;

    public ActionRouteController(OrchestratorContext db, ILogger<ActionRouteController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ActionRouteConfig>>> GetRoutes()
    {
        return await _db.ActionRoutes.ToListAsync();
    }

    [HttpGet("{actionType}")]
    public async Task<ActionResult<ActionRouteConfig>> GetRoute(string actionType)
    {
        var route = await _db.ActionRoutes.FindAsync(actionType);
        if (route == null) return NotFound();
        return route;
    }

    [HttpPost]
    public async Task<ActionResult<ActionRouteConfig>> CreateRoute([FromBody] ActionRouteConfig route)
    {
        if (await _db.ActionRoutes.AnyAsync(r => r.ActionType == route.ActionType))
        {
            return Conflict($"Route for {route.ActionType} already exists");
        }

        _db.ActionRoutes.Add(route);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetRoute), new { actionType = route.ActionType }, route);
    }

    [HttpPost("batch")]
    public async Task<IActionResult> BatchRegister([FromBody] IEnumerable<ActionRouteConfig> routes)
    {
        int count = 0;
        foreach (var route in routes)
        {
            var existing = await _db.ActionRoutes.FindAsync(route.ActionType);
            if (existing == null)
            {
                _db.ActionRoutes.Add(route);
            }
            else
            {
                existing.TargetUrl = route.TargetUrl;
                existing.HttpMethod = route.HttpMethod;
                existing.PayloadTemplate = route.PayloadTemplate;
                // existing.AuthSecret = route.AuthSecret; // Optional update
            }
            count++;
        }
        await _db.SaveChangesAsync();
        _logger.LogInformation($"Batch registered {count} routes.");
        return Ok(new { registered = count });
    }

    [HttpPut("{actionType}")]
    public async Task<IActionResult> UpdateRoute(string actionType, [FromBody] ActionRouteConfig updatedRoute)
    {
        if (actionType != updatedRoute.ActionType) return BadRequest();

        var route = await _db.ActionRoutes.FindAsync(actionType);
        if (route == null) return NotFound();

        route.TargetUrl = updatedRoute.TargetUrl;
        route.PayloadTemplate = updatedRoute.PayloadTemplate;
        route.AuthSecret = updatedRoute.AuthSecret;

        await _db.SaveChangesAsync();
        _logger.LogInformation("Route for {ActionType} updated", actionType);

        return NoContent();
    }

    [HttpDelete("{actionType}")]
    public async Task<IActionResult> DeleteRoute(string actionType)
    {
        var route = await _db.ActionRoutes.FindAsync(actionType);
        if (route == null) return NotFound();

        _db.ActionRoutes.Remove(route);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("n8n-projects")]
    public async Task<IActionResult> GetN8nProjects([FromServices] N8nService n8n)
    {
        try { return Ok(await n8n.GetProjectsAsync()); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("n8n-workflows")]
    public async Task<IActionResult> GetN8nWorkflows([FromServices] N8nService n8n, [FromQuery] string? projectId)
    {
        try { return Ok(await n8n.GetWorkflowsAsync(projectId)); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }
}
