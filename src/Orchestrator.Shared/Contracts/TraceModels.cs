using System.Text.Json.Serialization;

namespace Orchestrator.Shared.Contracts;

public class ExecutionTrace
{
    public string Trigger { get; set; } = string.Empty;
    public object TriggerData { get; set; } = new();
    public List<TraceStep> Steps { get; set; } = new();
}

public class TraceStep
{
    public string StepName { get; set; } = string.Empty;
    public string Status { get; set; } = "Success";
    public object Details { get; set; } = new();
    public DateTime Timestamp { get; set; } = DateTime.Now;
}

public class EvaluationTraceDetail
{
    public string RuleName { get; set; } = string.Empty;
    public string RuleSet { get; set; } = string.Empty;
    public string ContextProfile { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public bool IsMatch { get; set; }
    public string Outcome { get; set; } = string.Empty;
    public List<string> Reasons { get; set; } = new();
    
    // The "View of Data Available"
    public object? Facts { get; set; }
}

public class ActionTraceDetail
{
    public string ActionType { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public object Request { get; set; } = new();
    public object Response { get; set; } = new();
    public int StatusCode { get; set; }
}
