namespace ContextProviderService.Models;

public class FactPayload
{
    public MemberFact? Member { get; set; }
    public WalletFact? Wallet { get; set; }
    public ComplianceFact? Compliance { get; set; }
}

public class MemberFact
{
    public string MembershipId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Risk_Level { get; set; } = string.Empty;
    public string KYC_Level { get; set; } = string.Empty;
    public bool Email_Verified { get; set; }
    public bool Phone_Verified { get; set; }
    public string GameStatus { get; set; } = string.Empty;
}

public class WalletFact
{
    public int Id { get; set; }
    public string MembershipId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // Locked, Unlocked
    public string Currency { get; set; } = string.Empty;
    public decimal Balance { get; set; }
}

public class ComplianceFact
{
    public string Status { get; set; } = string.Empty;
    public List<string> Flags { get; set; } = new();
}
