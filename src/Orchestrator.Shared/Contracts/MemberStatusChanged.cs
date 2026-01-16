using Orchestrator.Shared.Models;

namespace Orchestrator.Shared.Contracts;

public record MemberStatusChanged(
    string MembershipId,
    MemberStatus OldStatus,
    MemberStatus NewStatus,
    DateTime OccurredAt
);
