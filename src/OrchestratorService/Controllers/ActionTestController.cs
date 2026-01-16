using Microsoft.AspNetCore.Mvc;
using OrchestratorService.Models;
using OrchestratorService.Services;
using Orchestrator.Shared.Contracts;
using System.Text.Json;

namespace OrchestratorService.Controllers;

[ApiController]
[Route("api/test/action")]
public class ActionTestController : ControllerBase
{
    private readonly ActionExecutionService _actionService;
    private readonly ILogger<ActionTestController> _logger;

    public ActionTestController(ActionExecutionService actionService, ILogger<ActionTestController> logger)
    {
        _actionService = actionService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<ActionTraceDetail>> RunTest([FromBody] TestActionRequest request)
    {
        _logger.LogInformation("Manually testing action {ActionType} for {MemberId}", request.ActionType, request.MembershipId);

        var config = new WorkflowActionConfig
        {
            Type = request.ActionType,
            Params = request.Params ?? new Dictionary<string, string>()
        };

        try 
        {
            var result = await _actionService.ExecuteActionAsync(config, request.MembershipId, "ManualTest");
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }
}

public class TestActionRequest
{
    public string ActionType { get; set; } = string.Empty;
    public string MembershipId { get; set; } = string.Empty;
    public Dictionary<string, string>? Params { get; set; }
}
