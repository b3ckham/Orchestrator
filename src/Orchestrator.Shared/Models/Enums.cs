using System.Text.Json.Serialization;

namespace Orchestrator.Shared.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WalletStatus
{
    Unlocked,
    Locked,
    Frozen
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum Currency
{
    CNY,
    THB,
    VND
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RiskLevel
{
    Low,
    Medium,
    High
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum KycLevel
{
    Pending,
    Verified,
    Rejected,
    UnderReview
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum GameStatus
{
    Active,
    Locked,
    Suspended,
    Unlocked
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MemberStatus
{
    Active,
    Inactive,
    Suspended,
    Confiscated,
    Pending
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BankAccountMgmtLevel
{
    Basic,
    VIP,
    Standard
}
