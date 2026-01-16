using System.Text.Json;
using System.Text;
using OrchestratorService.Data;
using OrchestratorService.Models;
using OrchestratorService.Services;
using Orchestrator.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

using Microsoft.Extensions.Configuration;

namespace OrchestratorService.Services;

public class WorkflowScheduler : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<WorkflowScheduler> _logger;
    private readonly string _memberServiceUrl;

    public WorkflowScheduler(IServiceProvider serviceProvider, ILogger<WorkflowScheduler> logger, IConfiguration config)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _memberServiceUrl = config["ServiceUrls:MemberService"] ?? throw new InvalidOperationException("Config missing");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Workflow Scheduler Started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessScheduledWorkflows(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing scheduled workflows");
            }

            // Run every 1 minute for POC (Daily in real world)
            try 
            {
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Graceful shutdown
                break;
            }
        }
    }

    private async Task ProcessScheduledWorkflows(CancellationToken stoppingToken)
    {
        using (var scope = _serviceProvider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<OrchestratorContext>();
            var evaluator = scope.ServiceProvider.GetRequiredService<WorkflowEvaluator>();
            var httpClient = scope.ServiceProvider.GetRequiredService<HttpClient>();
            var actionService = scope.ServiceProvider.GetRequiredService<ActionExecutionService>();

            // 1. Fetch Scheduled Rules
            var rules = await db.WorkflowDefinitions
                .Where(w => w.IsActive && w.TriggerEvent == "Scheduled")
                .ToListAsync(stoppingToken);

            if (!rules.Any()) return;

            _logger.LogInformation("Found {Count} scheduled rules to process.", rules.Count);

            // 2. Fetch All Members (Optimized: in real world, filter via API)
            // For POC: Fetch all and filter in memory
            List<JsonElement> members = new();
            try 
            {
                members = await httpClient.GetFromJsonAsync<List<JsonElement>>(_memberServiceUrl, stoppingToken) ?? new();
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to fetch members: {Message}", ex.Message);
                return;
            }

            foreach (var rule in rules)
            {
                foreach (var member in members)
                {
                    var memberId = member.GetProperty("membershipId").GetString();
                    if (string.IsNullOrEmpty(memberId)) continue;
                    
                    // 3. Evaluate Rule for Member (Async)
                    RuleEvaluationResponse evaluationResult;
                    try 
                    {
                        evaluationResult = await evaluator.EvaluateAsync(rule, memberId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Evaluator failed for rule {RuleName} on member {MemberId}", rule.Name, memberId);
                        continue;
                    }
                    
                    if (evaluationResult.IsMatch)
                    {
                         await ExecuteWorkflowActions(db, actionService, rule, memberId, evaluationResult, true, stoppingToken);
                    }
                    else
                    {
                        // Optional: Support NoMatch actions for scheduled jobs?
                        // Usually scheduled jobs are "Find matching users and do X". 
                        // But "Find non-matching users" is handled by the initial query typically?
                        // Actually, if the rule filters a subset of users, then NoMatch means "User processed but didn't match specific criteria".
                        // Let's support it for consistency if configured.
                        if (!string.IsNullOrEmpty(rule.OnNoMatchActionsJson))
                        {
                            await ExecuteWorkflowActions(db, actionService, rule, memberId, evaluationResult, false, stoppingToken);
                        }
                    }
                }
            }
        }
    }

    private async Task ExecuteWorkflowActions(
        OrchestratorContext db, 
        ActionExecutionService actionService, 
        WorkflowDefinition rule, 
        string memberId, 
        RuleEvaluationResponse evaluationResult,
        bool isMatch,
        CancellationToken token)
    {
        _logger.LogInformation("✅ Scheduled Rule {Rule} evaluated for Member {Member}. Match: {Match}", 
            rule.Name, memberId, isMatch);
        
        // Fix: Ensure evaluationResult is not null (it shouldn't be here)
        var outcome = evaluationResult?.Outcome ?? "Unknown";
        var reasons = evaluationResult?.Reasons ?? new List<string>();
        var facts = evaluationResult?.Facts ?? new Dictionary<string, object>();

        var logTrace = new ExecutionTrace
        {
            Trigger = "Scheduled",
            TriggerData = new { MemberId = memberId }
        };
        
        logTrace.Steps.Add(new TraceStep 
        { 
            StepName = "Rule Evaluation", 
            Status = "Success",
            Details = new EvaluationTraceDetail 
            { 
                RuleName = rule.Name, 
                Condition = rule.RuleSet ?? "N/A", 
                IsMatch = isMatch,
                Outcome = outcome,
                Reasons = reasons,
                Facts = facts
            } 
        });

        // Determine Actions to Run
        var stage = isMatch ? "OnMatch" : "OnNoMatch";
        var actionsJson = isMatch ? rule.OnMatchActionsJson : rule.OnNoMatchActionsJson;

        await RunActionsLoop(actionService, rule, memberId, actionsJson ?? string.Empty, logTrace, stage);

        var execution = new WorkflowExecution
        {
            WorkflowDefinitionId = rule.Id,
            TraceId = Guid.NewGuid().ToString(),
            Status = "Completed",
            Logs = JsonSerializer.Serialize(logTrace),
            ExecutedAt = DateTime.Now
        };

        db.WorkflowExecutions.Add(execution);
        await db.SaveChangesAsync(token);
    }

    private async Task RunActionsLoop(
        ActionExecutionService actionService, 
        WorkflowDefinition rule, 
        string memberId, 
        string actionsJson, 
        ExecutionTrace trace, 
        string stage)
    {
        // [Fallback] Backward Compatibility 
        if (string.IsNullOrEmpty(actionsJson) && stage == "OnMatch" && !string.IsNullOrEmpty(rule.ActionType))
        {
             var legacyAction = new WorkflowActionConfig { Type = rule.ActionType };
             var actionTrace = await actionService.ExecuteActionAsync(legacyAction, memberId, null);
             trace.Steps.Add(new TraceStep { StepName = $"Legacy Action: {legacyAction.Type}", Status = "Executed", Details = actionTrace });
             return;
        }

        if (string.IsNullOrEmpty(actionsJson)) return;

        try 
        {
            var actions = JsonSerializer.Deserialize<List<WorkflowActionConfig>>(actionsJson);
            if (actions == null) return;

            foreach (var action in actions)
            {
                 var actionTrace = await actionService.ExecuteActionAsync(action, memberId, null); 
                 trace.Steps.Add(new TraceStep { StepName = $"{stage} Action: {action.Type}", Status = "Executed", Details = actionTrace });
            }
        }
        catch (Exception ex)
        {
            trace.Steps.Add(new TraceStep { StepName = "Action Execution", Status = "Error", Details = new { Error = ex.Message } });
        }
    }
}
