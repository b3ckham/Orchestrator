using MassTransit;
using Orchestrator.Shared.Contracts;
using WalletService.Data;
using WalletService.Models;
using Orchestrator.Shared.Models;

namespace WalletService.Consumers;

public class MemberCreatedConsumer : IConsumer<MemberCreated>
{
    private readonly WalletContext _context;
    private readonly ILogger<MemberCreatedConsumer> _logger;

    public MemberCreatedConsumer(WalletContext context, ILogger<MemberCreatedConsumer> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<MemberCreated> context)
    {
        var message = context.Message;
        _logger.LogInformation("Creating Wallet for Member: {MembershipId}", message.MembershipId);

        var wallet = new Wallet
        {
            MembershipId = message.MembershipId,
            Balance = 0,
            Currency = message.Currency,
            Status = message.WalletStatus
        };

        _context.Wallets.Add(wallet);
        await _context.SaveChangesAsync();

        _logger.LogInformation("✅ Wallet Created for {MembershipId}", message.MembershipId);
    }
}
