using MassTransit;
using MemberService.Data;
using Microsoft.EntityFrameworkCore;
using Orchestrator.Shared.Contracts;
using Orchestrator.Shared.Models;

namespace MemberService.Consumers;

public class WalletUpdatedConsumer : IConsumer<WalletUpdated>
{
    private readonly MemberContext _context;
    private readonly ILogger<WalletUpdatedConsumer> _logger;

    public WalletUpdatedConsumer(MemberContext context, ILogger<WalletUpdatedConsumer> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<WalletUpdated> context)
    {
        _logger.LogInformation("Received WalletUpdated event for MembershipId: {MembershipId}, Status: {Status}", 
            context.Message.MembershipId, context.Message.Status);

        var member = await _context.Members.FirstOrDefaultAsync(m => m.MembershipId == context.Message.MembershipId);
        
        if (member != null)
        {
            if (Enum.TryParse<WalletStatus>(context.Message.Status.ToString(), true, out var status))
            {
                member.WalletStatus = status;
                await _context.SaveChangesAsync();
                _logger.LogInformation("Updated Member {MembershipId} WalletStatus to {Status}", member.MembershipId, member.WalletStatus);
            }
            else
            {
                _logger.LogWarning("Failed to parse WalletStatus {Status}", context.Message.Status);
            }
        }
        else
        {
            _logger.LogWarning("Member with MembershipId {MembershipId} not found", context.Message.MembershipId);
        }
    }
}
