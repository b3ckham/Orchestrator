using Orchestrator.Shared.Models;

namespace WalletService.Models;

public class Wallet
{
    public int Id { get; set; }
    public string MembershipId { get; set; } = string.Empty;
    public decimal Balance { get; set; } = 0;
    public Currency Currency { get; set; } = Currency.CNY;
    public WalletStatus Status { get; set; } = WalletStatus.Unlocked;
}
