using MassTransit;
using Microsoft.EntityFrameworkCore;
using OrchestratorService.Data;
using OrchestratorService.Models;
using OrchestratorService.Services;
using Orchestrator.Shared.Contracts;
using Orchestrator.Shared.Models;
using System.Text;
using System.Text.Json;

namespace OrchestratorService.Consumers;

public class MemberStatusChangedConsumer : IConsumer<MemberStatusChanged>
{
    private readonly ILogger<MemberStatusChangedConsumer> _logger;
    private readonly OrchestratorContext _db;
    private readonly WorkflowEvaluator _evaluator;
    private readonly ActionExecutionService _actionExecutor;
    private readonly TriggerRegistryService _triggerRegistry;
    private readonly DependencyGraphService _dependencyGraph;
    
    public MemberStatusChangedConsumer(
        ILogger<MemberStatusChangedConsumer> logger, 
        OrchestratorContext db, 
        WorkflowEvaluator evaluator,
        ActionExecutionService actionExecutor,
        TriggerRegistryService triggerRegistry,
        DependencyGraphService dependencyGraph)
    {
        _logger = logger;
        _db = db;
        _evaluator = evaluator;
        _actionExecutor = actionExecutor;
        _triggerRegistry = triggerRegistry;
        _dependencyGraph = dependencyGraph;
    }

    public async Task Consume(ConsumeContext<MemberStatusChanged> context)
    {
        var message = context.Message;
        _logger.LogInformation("Event Received: Member {MembershipId} changed status from {OldStatus} to {NewStatus}", 
            message.MembershipId, message.OldStatus, message.NewStatus);

        // 1. Trigger Registry (Normalize & Dedupe)
        var trigger = await _triggerRegistry.RegisterTriggerAsync(
            "MemberStatusChanged", 
            "Member", 
            message.MembershipId, 
            message
        );

        if (trigger == null) return; // Duplicate or Error

        // 2. Dependency Graph (Who Cares?)
        var rules = await _dependencyGraph.GetImpactedWorkflowsAsync(trigger.TriggerType, trigger.EntityType);
        
        if (!rules.Any())
        {
            _logger.LogInformation("No workflows found for trigger {TriggerType}", trigger.TriggerType);
            return;
        }

        foreach (var rule in rules)
        {
            // 2b. Enhanced Trigger Logic Check (Pre-filtering)
            if (!EvaluateTriggerCondition(rule.TriggerConditionJson, message))
            {
                _logger.LogInformation("Skipping rule {RuleName} due to Trigger Condition mismatch.", rule.Name);
                continue;
            }

            // Initialize Structured Log (TRACE)
            var logTrace = new ExecutionTrace
            {
                Trigger = "MemberStatusChanged",
                TriggerData = message
            };

            // 3. Evaluator (Async Call to Context + Rules)
            RuleEvaluationResponse evaluationResult;
            try 
            {
                evaluationResult = await _evaluator.EvaluateAsync(rule, message.MembershipId, message.OccurredAt.Ticks, message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Evaluator failed for rule {RuleName}", rule.Name);
                
                logTrace.Steps.Add(new TraceStep 
                { 
                    StepName = "Rule Evaluation", 
                    Status = "Failed",
                    Details = new { Error = "Evaluator Exception", Message = ex.Message, StackTrace = ex.StackTrace }
                });

                SaveExecution(rule, context.MessageId, "Failed", logTrace, message.MembershipId);
                continue; 
            }
            
            logTrace.Steps.Add(new TraceStep 
            { 
                StepName = "Rule Evaluation", 
                Status = evaluationResult.IsMatch ? "Success" : "Skipped",
                Details = new EvaluationTraceDetail 
                { 
                    RuleName = rule.Name,
                    RuleSet = rule.RuleSet,
                    Condition = rule.ConditionCriteria,
                    IsMatch = evaluationResult.IsMatch,
                    Outcome = evaluationResult.Outcome,
                    Reasons = evaluationResult.Reasons,
                    Facts = evaluationResult.Facts 
                } 
            });
            
            // 4. Enhanced Action Execution (Match & NoMatch)
            if (evaluationResult.IsMatch)
            {
                _logger.LogInformation("✅ Rule Matched: {RuleName}. Executing OnMatch Actions.", rule.Name);
                await ExecuteActions(rule.OnMatchActionsJson, message, rule, logTrace, "OnMatch");
            }
            else
            {
                _logger.LogInformation("ℹ️ Rule {RuleName} No Match. Executing OnNoMatch Actions.", rule.Name);
                if (!string.IsNullOrEmpty(rule.OnNoMatchActionsJson))
                {
                    await ExecuteActions(rule.OnNoMatchActionsJson, message, rule, logTrace, "OnNoMatch");
                }
            }

             SaveExecution(rule, context.MessageId, "Completed", logTrace, message.MembershipId);
        }
        
        await _db.SaveChangesAsync();
    }

    private bool EvaluateTriggerCondition(string conditionJson, MemberStatusChanged message)
    {
        if (string.IsNullOrEmpty(conditionJson)) return true; // No condition = Always Run

        try 
        {
            var condition = JsonSerializer.Deserialize<WorkflowCondition>(conditionJson);
            if (condition == null || !condition.Criteria.Any()) return true;

            bool isMatch = condition.Logic == "AND"; // Default starting point

            foreach (var criteria in condition.Criteria)
            {
                bool criteriaMatch = false;
                string actualValue = string.Empty;

                // Simple Reflection/Property matching for now
                if (criteria.Field == "NewStatus") actualValue = message.NewStatus.ToString();
                else if (criteria.Field == "OldStatus") actualValue = message.OldStatus.ToString();
                
                if (criteria.Operator == "==") criteriaMatch = actualValue == criteria.Value;
                else if (criteria.Operator == "!=") criteriaMatch = actualValue != criteria.Value;

                if (condition.Logic == "AND") isMatch &= criteriaMatch;
                else isMatch |= criteriaMatch; // OR
            }
            return isMatch;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error evaluating trigger condition");
            return false; // Fail safe
        }
    }

    private async Task ExecuteActions(string actionsJson, MemberStatusChanged message, WorkflowDefinition rule, ExecutionTrace trace, string stage)
    {
        // [Fallback] Backward Compatibility for Legacy Rules
        if (string.IsNullOrEmpty(actionsJson) && stage == "OnMatch" && !string.IsNullOrEmpty(rule.ActionType))
        {
             _logger.LogInformation("⚠️ Legacy Rule Detected. Executing legacy ActionType: {ActionType}", rule.ActionType);
             var legacyAction = new WorkflowActionConfig { Type = rule.ActionType };
             var actionTrace = await _actionExecutor.ExecuteActionAsync(legacyAction, message.MembershipId, message.NewStatus.ToString());
             
             trace.Steps.Add(new TraceStep
             {
                 StepName = $"Legacy Action: {legacyAction.Type}",
                 Status = "Executed",
                 Details = actionTrace
             });
             return;
        }

        if (string.IsNullOrEmpty(actionsJson)) return;

        try 
        {
            var actions = JsonSerializer.Deserialize<List<WorkflowActionConfig>>(actionsJson);
            if (actions == null) return;

            foreach (var action in actions)
            {
                 var actionTrace = await _actionExecutor.ExecuteActionAsync(action, message.MembershipId, message.NewStatus.ToString()); 
                 
                 trace.Steps.Add(new TraceStep
                 {
                     StepName = $"{stage} Action: {action.Type}",
                     Status = "Executed", 
                     Details = actionTrace
                 });
            }
        }
        catch (Exception ex)
        {
            trace.Steps.Add(new TraceStep { StepName = "Action Execution", Status = "Error", Details = new { Error = ex.Message } });
        }

    }

    private void SaveExecution(WorkflowDefinition rule, Guid? messageId, string status, ExecutionTrace trace, string membershipId)
    {
        var execution = new WorkflowExecution
        {
            WorkflowDefinitionId = rule.Id,
            TraceId = messageId?.ToString() ?? Guid.NewGuid().ToString(),
            Status = status,
            Logs = JsonSerializer.Serialize(trace), // Serializing the Trace Object
            ExecutedAt = DateTime.Now,
            MembershipId = membershipId
        };
        _db.WorkflowExecutions.Add(execution);
    }
}
