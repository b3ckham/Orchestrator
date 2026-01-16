using MassTransit;
using MemberService.Data;
using Orchestrator.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using Orchestrator.Shared.Contracts;
using Orchestrator.Shared.Models;

namespace MemberService.Consumers;

public class ComplianceStatusChangedConsumer : IConsumer<ComplianceStatusChanged>
{
    private readonly MemberContext _context;
    private readonly ILogger<ComplianceStatusChangedConsumer> _logger;
    private readonly IPublishEndpoint _publishEndpoint;

    public ComplianceStatusChangedConsumer(MemberContext context, ILogger<ComplianceStatusChangedConsumer> logger, IPublishEndpoint publishEndpoint)
    {
        _context = context;
        _logger = logger;
        _publishEndpoint = publishEndpoint;
    }

    public async Task Consume(ConsumeContext<ComplianceStatusChanged> context)
    {
        var message = context.Message;
        _logger.LogInformation("Processing compliance status update for member: {MembershipId}. New KYC: {NewStatus}, Risk: {RiskLevel}", 
            message.MembershipId, message.NewStatus, message.RiskLevel);

        var member = await _context.Members.FirstOrDefaultAsync(m => m.MembershipId == message.MembershipId);

        if (member == null)
        {
            _logger.LogWarning("Member not found for compliance update. MembershipId: {MembershipId}", message.MembershipId);
            return;
        }

        // Map status
        member.KYC_Level = message.NewStatus;
        if (message.RiskLevel.HasValue)
        {
            member.Risk_Level = message.RiskLevel.Value;
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("Updated member {MembershipId} compliance status successfully.", message.MembershipId);
        
        // Calculate New Status
        var newStatus = message.NewStatus == KycLevel.Verified ? MemberStatus.Active : MemberStatus.Pending;

        // Publish MemberUpdated event to propagate this change further
        // Use Shared Contract
        await context.Publish(new MemberUpdated(
            member.MembershipId,
            member.Email,
            member.FirstName,
            member.LastName,
            member.Phone,
            newStatus.ToString(), // Status
            member.Risk_Level.ToString(),
            member.KYC_Level.ToString(),
            member.Email_Verified,
            member.Phone_Verified,
            member.WalletStatus.ToString(),
            member.GameStatus.ToString(),
            DateTime.Now
        ));
    }
}
