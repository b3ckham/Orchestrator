using MassTransit;
using Orchestrator.Shared.Contracts;
using ComplianceService.Data;
using Microsoft.EntityFrameworkCore;
using Orchestrator.Shared.Models;

namespace ComplianceService.Consumers;

public class MemberUpdatedConsumer : IConsumer<MemberUpdated>
{
    private readonly ComplianceContext _context;
    private readonly ILogger<MemberUpdatedConsumer> _logger;

    public MemberUpdatedConsumer(ComplianceContext context, ILogger<MemberUpdatedConsumer> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<MemberUpdated> context)
    {
        _logger.LogInformation("Updating compliance profile for Member: {MembershipId}", context.Message.MembershipId);

        var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.MembershipId == context.Message.MembershipId);

        if (profile != null)
        {
            // Sync Risk and KYC from member
            profile.RiskLevel = Enum.Parse<RiskLevel>(context.Message.Risk_Level);
            profile.KycStatus = Enum.Parse<KycLevel>(context.Message.KYC_Level);
            profile.LastCheckedAt = DateTime.Now;
            
            await _context.SaveChangesAsync();
            _logger.LogInformation("Compliance profile updated for {MembershipId}", context.Message.MembershipId);
        }
        else
        {
            _logger.LogWarning("Compliance profile not found for member {MembershipId}", context.Message.MembershipId);
        }
    }
}
