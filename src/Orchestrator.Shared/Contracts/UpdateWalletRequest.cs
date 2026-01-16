using Orchestrator.Shared.Models;

namespace Orchestrator.Shared.Contracts;

public class UpdateWalletRequest
{
    public WalletStatus WalletStatus { get; set; } = WalletStatus.Unlocked;
}
