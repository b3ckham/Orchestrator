using Microsoft.AspNetCore.Mvc;
using Orchestrator.Shared.Contracts;
using ContextProviderService.Services;

namespace ContextProviderService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConsistencyController : ControllerBase
{
    private readonly WatermarkService _watermark;
    private readonly ILogger<ConsistencyController> _logger;

    public ConsistencyController(WatermarkService watermark, ILogger<ConsistencyController> logger)
    {
        _watermark = watermark;
        _logger = logger;
    }

    [HttpGet("ping")]
    public string Ping() => "Pong";

    [HttpPost("wait")]
    public async Task<ActionResult<ConsistencyResponse>> WaitForConsistency([FromBody] ConsistencyWaitRequest request)
    {
        var startTime = DateTime.UtcNow;
        var timeout = TimeSpan.FromMilliseconds(request.TimeoutMs);
        
        while (DateTime.UtcNow - startTime < timeout)
        {
            var currentPos = await _watermark.GetWatermarkAsync(request.EntityType, request.EntityId);
            
            if (currentPos >= request.RequiredMinPos)
            {
                return new ConsistencyResponse 
                { 
                    IsConsistent = true, 
                    CurrentPos = currentPos,
                    Status = "Success"
                };
            }

            await Task.Delay(100); // Polling interval
        }

        var finalPos = await _watermark.GetWatermarkAsync(request.EntityType, request.EntityId);
        _logger.LogWarning("Consistency Wait Timeout for {Type}:{Id}. Required: {Req}, Current: {Curr}", 
            request.EntityType, request.EntityId, request.RequiredMinPos, finalPos);

        return new ConsistencyResponse 
        { 
            IsConsistent = false, 
            CurrentPos = finalPos,
            Status = "Timeout"
        };
    }
}
