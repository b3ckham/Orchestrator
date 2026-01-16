using Orchestrator.Shared.Models;

namespace Orchestrator.Shared.Contracts;

public record MemberUpdated(
    string MembershipId,
    string Email,
    string FirstName,
    string LastName,
    string Phone,
    string Status,
    string Risk_Level,
    string KYC_Level,
    bool Email_Verified,
    bool Phone_Verified,
    string WalletStatus,
    string GameStatus,
    DateTime UpdatedAt
);
