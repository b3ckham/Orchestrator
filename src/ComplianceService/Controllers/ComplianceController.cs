using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Orchestrator.Shared.Contracts;
using ComplianceService.Models;
using ComplianceService.Data;
using Orchestrator.Shared.Models;

using MassTransit;
using System.Text.Json.Serialization;

namespace ComplianceService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ComplianceController : ControllerBase
{
    private readonly ComplianceContext _context;
    private readonly IPublishEndpoint _publishEndpoint;

    public ComplianceController(ComplianceContext context, IPublishEndpoint publishEndpoint)
    {
        _context = context;
        _publishEndpoint = publishEndpoint;
    }

    [HttpGet("{membershipId}")]
    public async Task<ActionResult<ComplianceProfile>> GetProfile(string membershipId)
    {
        var profile = await _context.Profiles
            .FirstOrDefaultAsync(p => p.MembershipId == membershipId);

        if (profile == null) return NotFound();

        return profile;
    }

    [HttpPut("{membershipId}/status")]
    public async Task<IActionResult> UpdateStatus(string membershipId, [FromBody] UpdateComplianceStatusRequest request)
    {
        var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.MembershipId == membershipId);
        if (profile == null) return NotFound();

        var oldKyc = profile.KycStatus;
        var oldRisk = profile.RiskLevel;

        profile.KycStatus = request.Status;
        if (request.RiskLevel.HasValue) profile.RiskLevel = request.RiskLevel.Value;
        
        await _context.SaveChangesAsync();

        await _publishEndpoint.Publish(new ComplianceStatusChanged(
            profile.MembershipId,
            profile.KycStatus,
            oldKyc,
            profile.RiskLevel,
            oldRisk,
            DateTime.Now
        ));

        return NoContent();
    }
}

public class UpdateComplianceStatusRequest
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public KycLevel Status { get; set; } = KycLevel.Pending;
    public RiskLevel? RiskLevel { get; set; }
}
