using System.ComponentModel.DataAnnotations;

namespace OrchestratorService.Models;

public class ActionAdapterConfig
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public string AdapterName { get; set; } = string.Empty; // e.g. "N8n", "Team"
    
    [Required]
    public string BaseUrl { get; set; } = string.Empty; // e.g. "http://localhost:5678/webhook"
    
    public string? AuthToken { get; set; } // Optional Token

    public string? ApiKey { get; set; } // [NEW] For management API access (GET /workflows)
    
    public string DefaultHeadersJson { get; set; } = "{}"; // JSON dictionary for headers

    public bool IsActive { get; set; } = true;

    // Helper to get Headers as Dictionary
    public Dictionary<string, string> GetHeaders()
    {
        if (string.IsNullOrEmpty(DefaultHeadersJson)) return new Dictionary<string, string>();
        try 
        {
            return System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(DefaultHeadersJson) 
                   ?? new Dictionary<string, string>();
        }
        catch
        {
            return new Dictionary<string, string>();
        }
    }
}
