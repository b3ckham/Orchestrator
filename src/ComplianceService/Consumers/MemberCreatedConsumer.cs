using MassTransit;
using Orchestrator.Shared.Contracts;
using ComplianceService.Data;
using ComplianceService.Models;
using Orchestrator.Shared.Models;

namespace ComplianceService.Consumers;

public class MemberCreatedConsumer : IConsumer<MemberCreated>
{
    private readonly ComplianceContext _context;
    private readonly ILogger<MemberCreatedConsumer> _logger;

    public MemberCreatedConsumer(ComplianceContext context, ILogger<MemberCreatedConsumer> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<MemberCreated> context)
    {
        var message = context.Message;
        _logger.LogInformation("Creating Compliance Profile for Member: {MembershipId}", message.MembershipId);

        var profile = new ComplianceProfile
        {
            MembershipId = message.MembershipId,
            KycStatus = message.KYC_Level,
            RiskLevel = message.Risk_Level,
            LastCheckedAt = DateTime.Now
        };

        _context.Profiles.Add(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("✅ Compliance Profile Created for {MembershipId}", message.MembershipId);
    }
}
