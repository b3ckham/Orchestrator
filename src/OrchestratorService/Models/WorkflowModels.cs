using System.ComponentModel.DataAnnotations;

namespace OrchestratorService.Models;

using System.Text.Json.Serialization;


public class WorkflowDefinition
{
    public int Id { get; set; }
    
    [Required]
    public string Name { get; set; } = string.Empty;

    public string? RuleSet { get; set; }
    public string? ContextProfile { get; set; }

    public string? EntityType { get; set; } = "Member"; // New: For Dependency Graph (e.g. Member, Wallet)
    
    public int Version { get; set; } = 1; // New: For Deterministic Replay
    
    [Required]
    public string TriggerEvent { get; set; } = string.Empty; // e.g., "MemberStatusChanged"
    
    public string? TriggerKey { get; set; } // New: Unique Key for dedupe/versioning logic
    

    
    // [Enhanced Policy]
    public string? TriggerConditionJson { get; set; } // Logic: AND/OR criteria
    public string? OnMatchActionsJson { get; set; }   // List of Actions
    public string? OnNoMatchActionsJson { get; set; } // List of Actions



    // [Deprecated] Kept for backward compatibility during refactor
    public string ConditionCriteria { get; set; } = string.Empty; 
    public string ActionType { get; set; } = string.Empty; 
    
    public bool IsActive { get; set; } = true;
}

public class WorkflowExecution
{
    public int Id { get; set; }
    
    public int WorkflowDefinitionId { get; set; }

    public string MembershipId { get; set; } = string.Empty;
    
    public string TraceId { get; set; } = string.Empty;
    
    public string Status { get; set; } = "Completed"; // Started, Completed, Failed
    
    public string Logs { get; set; } = string.Empty; // JSON or text log of logic
    
    public DateTime ExecutedAt { get; set; } = DateTime.Now;

    public virtual WorkflowDefinition? WorkflowDefinition { get; set; }
}

public class RuleEvaluationRequest
{
    public string RuleSetName { get; set; } = string.Empty;
    public object Facts { get; set; } = new();
}

public class RuleEvaluationResponse
{
    [JsonPropertyName("match")]
    public bool IsMatch { get; set; }

    [JsonPropertyName("outcome")]
    public string Outcome { get; set; } = string.Empty;

    [JsonPropertyName("reasons")]
    public List<string> Reasons { get; set; } = new();

    [JsonPropertyName("facts")]
    public object? Facts { get; set; }
}


// Shared Models (ExecutionTrace, TraceStep, etc.) are now in Orchestrator.Shared.Contracts
