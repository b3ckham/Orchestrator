using MassTransit;
using Orchestrator.Shared.Contracts;
using WalletService.Data;
using WalletService.Models;
using Microsoft.EntityFrameworkCore;

namespace WalletService.Consumers;

public class MemberUpdatedConsumer : IConsumer<MemberUpdated>
{
    private readonly WalletContext _context;
    private readonly ILogger<MemberUpdatedConsumer> _logger;

    public MemberUpdatedConsumer(WalletContext context, ILogger<MemberUpdatedConsumer> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<MemberUpdated> context)
    {
        _logger.LogInformation("Updating wallet status for Member: {MembershipId}", context.Message.MembershipId);

        var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.MembershipId == context.Message.MembershipId);

        if (wallet != null)
        {
            // [FIX] Disabled due to Race Condition. MemberService sends stale WalletStatus before Orchestrator runs.
            // rely on Orchestrator Rules to update WalletStatus based on MemberStatus changes.
            /* 
            if (Enum.TryParse<WalletStatus>(context.Message.WalletStatus, true, out var parsedStatus))
            {
                wallet.Status = parsedStatus;
                await _context.SaveChangesAsync();
                _logger.LogInformation("Wallet status updated to {Status} for {MembershipId}", wallet.Status, context.Message.MembershipId);
            }
            else
            {
                _logger.LogWarning("Failed to parse WalletStatus '{Status}' for member {MembershipId}", context.Message.WalletStatus, context.Message.MembershipId);
            }
            */
            _logger.LogInformation("Skipping Wallet Status Sync from MemberUpdated event to avoid Race Condition.");
        }
        else
        {
            _logger.LogWarning("Wallet not found for member {MembershipId}", context.Message.MembershipId);
        }
    }
}
