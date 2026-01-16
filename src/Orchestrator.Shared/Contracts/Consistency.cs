namespace Orchestrator.Shared.Contracts;

public class ConsistencyWaitRequest
{
    /// <summary>
    /// The stream/entity type (e.g., "Member", "Wallet").
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// The unique identifier of the entity.
    /// </summary>
    public string EntityId { get; set; } = string.Empty;

    /// <summary>
    /// The minimum position (version/timestamp) required for consistency.
    /// </summary>
    public long RequiredMinPos { get; set; }

    /// <summary>
    /// How long to wait before timing out (milliseconds).
    /// </summary>
    public int TimeoutMs { get; set; } = 5000;
}

public class ConsistencyResponse
{
    public bool IsConsistent { get; set; }
    public long CurrentPos { get; set; }
    public string Status { get; set; } = "Unknown"; // "Success", "Timeout", "Error"
}
