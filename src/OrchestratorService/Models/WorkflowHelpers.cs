
public class WorkflowCondition
{
    // "AND", "OR"
    public string Logic { get; set; } = "AND";
    public List<WorkflowCriteria> Criteria { get; set; } = new();
}

public class WorkflowCriteria
{
    public string Field { get; set; } = string.Empty; // "NewStatus"
    public string Operator { get; set; } = "=="; // "==", "!=", ">", etc.
    public string Value { get; set; } = string.Empty; // "Suspended"
}

public class WorkflowActionConfig
{
    public string Type { get; set; } = string.Empty; // "LOCK_WALLET"
    public Dictionary<string, string> Params { get; set; } = new();
}
