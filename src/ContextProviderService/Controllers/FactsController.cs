using Microsoft.AspNetCore.Mvc;
using ContextProviderService.Services;
using ContextProviderService.Models;

namespace ContextProviderService.Controllers;

[ApiController]
[Route("api/facts")]
public class FactsController : ControllerBase
{
    private readonly ContextAggregator _aggregator;

    public FactsController(ContextAggregator aggregator)
    {
        _aggregator = aggregator;
    }

    [HttpGet("resolve")]
    public async Task<ActionResult<FactPayload>> Resolve([FromQuery] string membershipId, [FromQuery] string profile)
    {
        if (string.IsNullOrEmpty(membershipId)) return BadRequest("MembershipId is required");
        
        var facts = await _aggregator.ResolveContextAsync(membershipId, profile);
        return Ok(facts);
    }

    [HttpGet("ping")]
    public string Ping() => "Pong";

    [HttpPost("evaluate")]
    public async Task<IActionResult> Evaluate([FromBody] EvaluateRequest request)
    {
        var facts = await _aggregator.ResolveContextAsync(request.MembershipId, request.ContextProfile);
        return Ok(facts);
    }
}

public record EvaluateRequest(string MembershipId, string ContextProfile, string RuleSet);
