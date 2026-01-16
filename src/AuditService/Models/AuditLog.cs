using System.ComponentModel.DataAnnotations;

namespace AuditService.Models;

public class AuditLog
{
    [Key]
    public int Id { get; set; }
    
    public string EntityId { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty; // Member, Wallet, Compliance
    public string Action { get; set; } = string.Empty; // StatusChange, Unlock, etc.
    public string PreviousState { get; set; } = string.Empty;
    public string NewState { get; set; } = string.Empty;
    public string Source { get; set; } = "System"; // Orchestrator, Manual, etc.
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
