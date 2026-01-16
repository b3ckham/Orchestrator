using Orchestrator.Shared.Models;

namespace Orchestrator.Shared.Contracts;

public record WalletUpdated(
    string MembershipId,
    decimal Balance,
    Currency Currency,
    WalletStatus Status,
    WalletStatus PreviousStatus,
    DateTime UpdatedAt
) : IAuditableEvent
{
    public string EntityType => "Wallet";
    public string PreviousState => PreviousStatus.ToString();
    public string NewState => $"{Status} (Balance: {Balance})";
}
