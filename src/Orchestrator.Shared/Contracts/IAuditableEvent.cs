namespace Orchestrator.Shared.Contracts;

public interface IAuditableEvent
{
    string MembershipId { get; } // Maps to EntityId
    string EntityType { get; }
    string PreviousState { get; }
    string NewState { get; }
    DateTime UpdatedAt { get; }
}
