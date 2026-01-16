using Orchestrator.Shared.Models;

namespace Orchestrator.Shared.Contracts;

public record ComplianceStatusChanged(
    string MembershipId,
    KycLevel NewStatus,
    KycLevel PreviousStatus,
    RiskLevel? RiskLevel,
    RiskLevel? PreviousRiskLevel,
    DateTime UpdatedAt
) : IAuditableEvent
{
    public string EntityType => "Compliance";
    public string PreviousState => $"{PreviousStatus} (Risk: {PreviousRiskLevel})";
    public string NewState => $"{NewStatus} (Risk: {RiskLevel})";
}
