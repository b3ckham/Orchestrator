using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrchestratorService.Data;
using OrchestratorService.Models;
using OrchestratorService.Services;
using Orchestrator.Shared.Contracts;
using System.Text.Json;

namespace OrchestratorService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkflowsController : ControllerBase
{
    private readonly OrchestratorContext _context;
    private readonly WorkflowEvaluator _evaluator;
    private readonly ActionExecutionService _actionService;
    private readonly IHttpClientFactory _clientFactory;
    private readonly DrlGenerationService _drlService;
    private readonly IConfiguration _config;
    private readonly string _memberServiceUrl;
    private readonly string _ruleServiceUrl;

    private readonly DependencyGraphService _dependencyGraph;

    public WorkflowsController(OrchestratorContext context, WorkflowEvaluator evaluator, ActionExecutionService actionService, IHttpClientFactory clientFactory, DrlGenerationService drlService, IConfiguration config, DependencyGraphService dependencyGraph)
    {
        _context = context;
        _evaluator = evaluator;
        _actionService = actionService;
        _clientFactory = clientFactory;
        _drlService = drlService;
        _config = config;
        _dependencyGraph = dependencyGraph;
        _memberServiceUrl = _config["ServiceUrls:MemberService"] ?? throw new InvalidOperationException("Configuration for MemberServiceUrl is missing.");
        _ruleServiceUrl = _config["ServiceUrls:RuleService"] ?? throw new InvalidOperationException("Configuration for RuleServiceUrl is missing.");
    }

    [HttpGet("definitions")]
    public async Task<ActionResult<IEnumerable<WorkflowDefinition>>> GetDefinitions()
    {
        return await _context.WorkflowDefinitions.ToListAsync();
    }

    [HttpPost("definitions")]
    public async Task<ActionResult<WorkflowDefinition>> CreateDefinition([FromBody] WorkflowDefinition definition)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { Message = "Invalid Model State", Detailed = ModelState });
        }
        
        // Auto-generate RuleSet ID if missing
        if (string.IsNullOrWhiteSpace(definition.RuleSet))
        {
            definition.RuleSet = $"policy_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        }

        // Auto-generate TriggerKey if missing (Required by DB)
        if (string.IsNullOrWhiteSpace(definition.TriggerKey))
        {
            definition.TriggerKey = $"key_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        }

        _context.WorkflowDefinitions.Add(definition);
        await _context.SaveChangesAsync();
        
        // Dynamic Deployment
        await DeployRule(definition);
        _dependencyGraph.InvalidateCache();

        return CreatedAtAction(nameof(GetDefinitions), new { id = definition.Id }, definition);
    }

    [HttpPut("definitions/{id}")]
    public async Task<IActionResult> UpdateDefinition(int id, [FromBody] WorkflowDefinition definition)
    {
        if (id != definition.Id) return BadRequest(new { Message = $"Route ID {id} does not match Body ID {definition.Id}" });

        var existing = await _context.WorkflowDefinitions.FindAsync(id);
        if (existing == null) return NotFound(new { Message = $"Workflow Definition with ID {id} not found" });

        existing.Name = definition.Name;
        existing.TriggerEvent = definition.TriggerEvent;
        existing.ConditionCriteria = definition.ConditionCriteria;
        existing.ActionType = definition.ActionType;
        existing.IsActive = definition.IsActive;
        existing.RuleSet = definition.RuleSet; // support updating rule set name if provided
        existing.ContextProfile = definition.ContextProfile;
        
        // [Fixed] Update JSON fields for Dynamic Rules
        existing.TriggerConditionJson = definition.TriggerConditionJson;
        existing.OnMatchActionsJson = definition.OnMatchActionsJson;
        existing.OnNoMatchActionsJson = definition.OnNoMatchActionsJson;

        // Ensure RuleSet ID exists
        if (string.IsNullOrWhiteSpace(existing.RuleSet))
        {
             existing.RuleSet = $"policy_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        }

        await _context.SaveChangesAsync();
        
        // Dynamic Deployment
        await DeployRule(existing);
        _dependencyGraph.InvalidateCache();

        return NoContent();
    }
    
    private async Task DeployRule(WorkflowDefinition definition)
    {
        try
        {
            var drl = _drlService.GenerateDrl(definition);
            
            var payload = new 
            {
                ruleSetName = definition.RuleSet,
                drlContent = drl
            };

            var client = _clientFactory.CreateClient();
            var response = await client.PostAsJsonAsync($"{_ruleServiceUrl}/deploy", payload);
            
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[Error] Failed to deploy DRL for {definition.Name}: {response.StatusCode}");
            }
            else
            {
                Console.WriteLine($"[Success] Deployed DRL for {definition.Name} (RuleSet: {definition.RuleSet})");
            }
        }
        catch (Exception ex)
        {
             Console.WriteLine($"[Exception] Failed to deploy DRL: {ex.Message}");
        }
    }

    [HttpDelete("definitions/{id}")]
    public async Task<IActionResult> DeleteDefinition(int id)
    {
        var definition = await _context.WorkflowDefinitions.FindAsync(id);
        if (definition == null) return NotFound(new { Message = $"Workflow Definition with ID {id} not found" });

        _context.WorkflowDefinitions.Remove(definition);
        await _context.SaveChangesAsync();
        _dependencyGraph.InvalidateCache();

        return NoContent();
    }
    
    [HttpGet("executions")]
    public async Task<IActionResult> GetExecutions()
    {
        var executions = await _context.WorkflowExecutions
            .Include(e => e.WorkflowDefinition)
            .OrderByDescending(e => e.ExecutedAt)
            .Take(50)
            .Select(e => new 
            {
                e.Id,
                e.WorkflowDefinitionId,
                e.MembershipId,
                e.TraceId,
                e.Status,
                e.Logs,
                e.ExecutedAt,
                WorkflowName = e.WorkflowDefinition != null ? e.WorkflowDefinition.Name : "N/A"
            })
            .ToListAsync();
            
        return Ok(executions);
    }

    [HttpGet("executions/{id}/trace")]
    public async Task<ActionResult<ExecutionTrace>> GetExecutionTrace(int id)
    {
        var execution = await _context.WorkflowExecutions.FindAsync(id);
        if (execution == null) return NotFound("Execution not found");

        if (string.IsNullOrEmpty(execution.Logs)) 
            return Ok(new ExecutionTrace { Trigger = "Unknown", Steps = new() });

        try 
        {
            var trace = JsonSerializer.Deserialize<ExecutionTrace>(execution.Logs);
            return Ok(trace);
        }
        catch 
        {
            return StatusCode(500, "Failed to parse execution logs");
        }
    }

    [HttpPost("trigger")]
    public async Task<IActionResult> TriggerWorkflow([FromBody] ManualTriggerRequest request)
    {
        // 1. Fetch Workflow
        var rule = await _context.WorkflowDefinitions.FindAsync(request.WorkflowId);
        if (rule == null) return NotFound(new { Message = $"Workflow {request.WorkflowId} not found" });
        if (!rule.IsActive) return BadRequest(new { Message = "Workflow is inactive" });

        // 2. Determine Targets
        List<string> targets = new();
        if (request.RunAll)
        {
            try 
            {
                var client = _clientFactory.CreateClient();
                var ids = await client.GetFromJsonAsync<List<string>>($"{_memberServiceUrl}/ids");
                if (ids != null) targets.AddRange(ids);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Failed to fetch all member IDs", Details = ex.Message });
            }
        }
        else if (request.TargetMemberIds != null && request.TargetMemberIds.Any())
        {
            targets.AddRange(request.TargetMemberIds);
        }
        else if (!string.IsNullOrEmpty(request.MembershipId))
        {
            targets.Add(request.MembershipId);
        }

        if (!targets.Any()) return BadRequest("No target members specified.");

        // 3. Execute (Batch)
        var results = new List<object>();
        int successCount = 0;
        int matchCount = 0;

        foreach (var id in targets)
        {
            var result = await ExecuteWorkflowForMember(rule, id, request);
            results.Add(result);
            // Basic tracking (assuming result structure)
            // Ideally we returned a structured object
        }

        return Ok(new 
        { 
            Message = $"Workflow Executed for {targets.Count} members", 
            Count = targets.Count, 
            Results = results.Take(10) // Limit response size 
        });
    }

    private async Task<object> ExecuteWorkflowForMember(WorkflowDefinition rule, string membershipId, ManualTriggerRequest request)
    {
        var logTrace = new ExecutionTrace
        {
            Trigger = "Manual Trigger",
            TriggerData = new { Request = request, Context = new { MemberId = membershipId, RuleSet = rule.RuleSet } }
        };

        // Evaluate
        RuleEvaluationResponse evaluationResult;
        try 
        {
            evaluationResult = await _evaluator.EvaluateAsync(rule, membershipId);
        }
        catch (Exception ex)
        {
            evaluationResult = new RuleEvaluationResponse { IsMatch = false, Outcome = "Error", Reasons = new() { ex.Message } };
        }

        logTrace.Steps.Add(new TraceStep 
        { 
            StepName = "Rule Evaluation", 
            Status = evaluationResult.IsMatch ? "Success" : "Skipped",
            Details = new EvaluationTraceDetail 
            { 
                RuleName = rule.Name, 
                RuleSet = rule.RuleSet ?? "N/A", 
                ContextProfile = rule.ContextProfile ?? "N/A", 
                Condition = rule.ConditionCriteria ?? "N/A", 
                IsMatch = evaluationResult.IsMatch,
                Outcome = evaluationResult.Outcome ?? "Unknown",
                Reasons = evaluationResult.Reasons ?? new List<string>(),
                Facts = evaluationResult.Facts ?? new Dictionary<string, object>()
            } 
        });

        if (evaluationResult.IsMatch)
        {
            _ = ExecuteActions(rule.OnMatchActionsJson ?? string.Empty, membershipId, rule, logTrace, "OnMatch");
        }
        else
        {
            if (!string.IsNullOrEmpty(rule.OnNoMatchActionsJson))
            {
                _ = ExecuteActions(rule.OnNoMatchActionsJson ?? string.Empty, membershipId, rule, logTrace, "OnNoMatch");
            }
             logTrace.Steps.Add(new TraceStep
            {
                StepName = "Summary",
                Status = "Converted",
                Details = evaluationResult.IsMatch ? "Match Actions Executed" : "No Match Actions Executed"
            });
        }

        // Save Log
        var execution = new WorkflowExecution
        {
            WorkflowDefinitionId = rule.Id,
            MembershipId = membershipId,
            TraceId = Guid.NewGuid().ToString(),
            Status = "Completed",
            Logs = JsonSerializer.Serialize(logTrace),
            ExecutedAt = DateTime.UtcNow
        };
        
        // Note: In heavy batch, we should consider bulk insert or separate DB context factory to avoid concurrency issues
        // Since this method awaits, it's sequential on the same context, which IS NOT THREAD SAFE if we generated tasks.
        // But here we are iterating sequentially in the caller loop, so it is safe.
        _context.WorkflowExecutions.Add(execution);
        await _context.SaveChangesAsync();
        _context.ChangeTracker.Clear(); // prevent tracking bloat

        return new { MemberId = membershipId, IsMatch = evaluationResult.IsMatch, TraceId = execution.TraceId };
    }

    private async Task ExecuteActions(string actionsJson, string membershipId, WorkflowDefinition rule, ExecutionTrace trace, string stage)
    {
        // [Fallback] Backward Compatibility for Legacy Rules
        if (string.IsNullOrEmpty(actionsJson) && stage == "OnMatch" && !string.IsNullOrEmpty(rule.ActionType))
        {
             var legacyAction = new WorkflowActionConfig { Type = rule.ActionType };
             // Use new execute action method but we need to construct it carefully or rely on legacy override? 
             // Ideally we call the NEW ExecuteActionAsync which takes action config.
             // But wait, the controller has reference to ActionExecutionService.
             
             // Since we marked the other one obsolete, let's use the new one here manually constructing config
             // or calling the obsolete one if we want to be lazy. Let's use new one.
             
             var actionTrace = await _actionService.ExecuteActionAsync(legacyAction, membershipId, null);
             
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
                 var actionTrace = await _actionService.ExecuteActionAsync(action, membershipId, null); 
                 
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

    [HttpPost("actions/test")]
    public async Task<IActionResult> TestAction([FromBody] WorkflowActionConfig action)
    {
        try
        {
            // Use a dummy member ID for testing if not provided in params
            var memberId = action.Params.ContainsKey("membershipId") ? action.Params["membershipId"] : "TEST-USER-001";
            
            var trace = await _actionService.ExecuteActionAsync(action, memberId, "Testing");
            return Ok(trace);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Message = "Action Execution Failed", Error = ex.Message });
        }
    }
}
