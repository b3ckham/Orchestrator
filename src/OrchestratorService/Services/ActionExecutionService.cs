using System.Text;
using System.Text.Json;
using OrchestratorService.Models;
using Orchestrator.Shared.Contracts;
using OrchestratorService.Contracts;
using Microsoft.Extensions.Configuration;

namespace OrchestratorService.Services;

public class ActionExecutionService
{
    private readonly IEnumerable<IWorkflowActionAdapter> _adapters;
    private readonly ILogger<ActionExecutionService> _logger;
    private readonly OrchestratorService.Data.OrchestratorContext _db;
    private readonly OrchestratorService.Services.Adapters.GenericHttpAdapter _genericAdapter;

    public ActionExecutionService(
        IEnumerable<IWorkflowActionAdapter> adapters, 
        ILogger<ActionExecutionService> logger,
        OrchestratorService.Data.OrchestratorContext db,
        OrchestratorService.Services.Adapters.GenericHttpAdapter genericAdapter)
    {
        _adapters = adapters;
        _logger = logger;
        _db = db;
        _genericAdapter = genericAdapter;
    }

    // [Enhancement] Generic Action Executor with Universal Router
    public async Task<ActionTraceDetail> ExecuteActionAsync(WorkflowActionConfig action, string membershipId, string? contextStatus)
    {
        // 1. Universal Router: Check if a specific route exists in DB
        // Query route (cached or direct) - Scoped DB context is fine
        var route = await _db.ActionRoutes.FindAsync(action.Type);
        
        if (route != null)
        {
            _logger.LogInformation("UniversalRouter: Routing {ActionType} via GenericAdapter to {Url}", action.Type, route.TargetUrl);
            return await _genericAdapter.ExecuteWithRouteAsync(action, route, membershipId, contextStatus);
        }

        // 2. Fallback: Code-based Adapters (Member, Wallet, etc.)
        var adapter = _adapters.FirstOrDefault(a => a.CanHandle(action.Type));

        if (adapter == null)
        {
            // If no code adapter found, check if we should default to N8n legacy or just fail?
            // For now, fail if not configured. User should add a route if they want n8n.
            // But to keep back-compat with the previous "N8nAdapter" logic which had a fallback to "N8n Config"...
            // The GenericHttpAdapter can also load the "N8n" legacy config if we wanted, but we are moving to Route-based.
            // Let's assume migration is done via Routes for custom actions.
            
            _logger.LogWarning("No adapter and no route found for Action Type: {ActionType}", action.Type);
            return new ActionTraceDetail { 
                ActionType = action.Type, 
                Response = new { Error = $"No adapter registered and no route configured for {action.Type}", Status = "Skipped" }
            };
        }

        try 
        {
            return await adapter.ExecuteAsync(action, membershipId, contextStatus);
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, "Adapter {Adapter} failed to execute {Action}", adapter.GetType().Name, action.Type);
             return new ActionTraceDetail { ActionType = action.Type, Response = new { Error = ex.Message, StackTrace = ex.StackTrace } };
        }
    }

    // [Deprecated] Kept for backward compatibility
    [Obsolete("Use ExecuteActionAsync(WorkflowActionConfig...) instead. This method relies on the legacy ActionType column.")]
    public async Task<ActionTraceDetail> ExecuteActionAsync(WorkflowDefinition rule, string membershipId, string? contextStatus)
    {
        // Convert Legacy Rule to Modern Config
        var config = new WorkflowActionConfig 
        { 
            Type = rule.ActionType ?? "NULL", 
            Params = new Dictionary<string, string>() 
        };

        return await ExecuteActionAsync(config, membershipId, contextStatus);
    }
}
