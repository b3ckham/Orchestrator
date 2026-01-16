using System.ComponentModel.DataAnnotations;

namespace OrchestratorService.Models;

public class ActionRouteConfig
{
    [Key]
    public string ActionType { get; set; } = string.Empty; // PK: e.g. "SEND_EMAIL"

    [Required]
    public string TargetUrl { get; set; } = string.Empty; // e.g. "https://n8n.../email"

    public string HttpMethod { get; set; } = "POST"; // [NEW] GET, POST, PUT, DELETE

    public string PayloadTemplate { get; set; } = "{}"; // JSON with {{placeholders}}

    public string? AuthSecret { get; set; } // Optional bearer token
}
