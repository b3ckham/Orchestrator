using Orchestrator.Shared.Models;

namespace Orchestrator.Shared.Contracts;

public record MemberCreated(
    string MembershipId,
    string Email,
    string FirstName,
    string LastName,
    string Phone,
    MemberStatus Status,
    RiskLevel Risk_Level,
    KycLevel KYC_Level,
    bool Email_Verified,
    bool Phone_Verified,
    WalletStatus WalletStatus,
    GameStatus GameStatus,
    Currency Currency,
    DateTime CreatedAt
);
