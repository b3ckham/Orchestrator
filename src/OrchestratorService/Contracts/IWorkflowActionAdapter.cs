using OrchestratorService.Models;
using Orchestrator.Shared.Contracts;

namespace OrchestratorService.Contracts;

public interface IWorkflowActionAdapter
{
    /// <summary>
    /// Checks if this adapter can handle the specific Action Type (e.g., "SEND_EMAIL").
    /// </summary>
    bool CanHandle(string actionType);

    /// <summary>
    /// Executes the action.
    /// </summary>
    /// <param name="action">Configuration including generic Params dictionary.</param>
    /// <param name="membershipId">Target member.</param>
    /// <param name="contextStatus">Optional context status (e.g. "Suspended") for messaging.</param>
    Task<ActionTraceDetail> ExecuteAsync(WorkflowActionConfig action, string membershipId, string? contextStatus);
}
