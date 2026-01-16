using System.ComponentModel.DataAnnotations;

using Orchestrator.Shared.Models;

namespace MemberService.Models;

public class Member
{
    public int Id { get; set; }
    
    [Required]
    public string MembershipId { get; set; } = string.Empty;
    
    [Required]
    public string FirstName { get; set; } = string.Empty;
    
    [Required]
    public string LastName { get; set; } = string.Empty;
    
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
    
    [Required]
    [Phone]
    public string Phone { get; set; } = string.Empty;
    
    [Required]
    public MemberStatus Status { get; set; } = MemberStatus.Active;
    
    [Required]
    public RiskLevel Risk_Level { get; set; } = RiskLevel.Low;
    
    [Required]
    public KycLevel KYC_Level { get; set; } = KycLevel.Pending;
    
    [Required]
    public bool Email_Verified { get; set; } = false;
    
    [Required]
    public bool Phone_Verified { get; set; } = false;

    public WalletStatus WalletStatus { get; set; } = WalletStatus.Unlocked;
    
    public GameStatus GameStatus { get; set; } = GameStatus.Unlocked;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime? LastPasswordChangedAt { get; set; }
    
    public DateTime? LastSkipSecurityUpdateAt { get; set; }

    // --- New Eligibility Fields ---
    public bool BonusEligibility { get; set; } = true;
    public bool DepositEligibility { get; set; } = true;
    public bool WithdrawalEligibility { get; set; } = true;

    // --- New Permission Fields ---
    public BankAccountMgmtLevel BankAccountMgmtLevel { get; set; } = BankAccountMgmtLevel.Standard;
}
