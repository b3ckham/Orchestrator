using Orchestrator.Shared.Models;

namespace ComplianceService.Models;

public class ComplianceProfile
{
    public int Id { get; set; }
    public string MembershipId { get; set; } = string.Empty;
    public KycLevel KycStatus { get; set; } = KycLevel.Pending;
    public RiskLevel RiskLevel { get; set; } = RiskLevel.Low;
    public DateTime LastCheckedAt { get; set; }
}
