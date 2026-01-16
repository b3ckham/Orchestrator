namespace MemberService.Contracts;

public record MemberStatusChanged(
    string MembershipId,
    string OldStatus,
    string NewStatus,
    DateTime OccurredAt
);
