using System.ComponentModel.DataAnnotations;

namespace AuditService.Models;

public class SystemError
{
    [Key]
    public int Id { get; set; }
    public string TraceId { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Severity { get; set; } = "Error"; // Critical, Error, Warning
    
    // Categorization
    public string Category { get; set; } = "General"; // Connectivity, Database, Business, etc.
    public string ErrorCode { get; set; } = "UNKNOWN_ERROR";
    
    public string Message { get; set; } = string.Empty;
    public string? StackTrace { get; set; }
    
    // Context stored as JSON string
    public string ContextJson { get; set; } = "{}";
}
