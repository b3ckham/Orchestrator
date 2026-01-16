using System.ComponentModel.DataAnnotations;

namespace OrchestratorService.Models;

public class ManualTriggerRequest
{
    [Required]
    public int WorkflowId { get; set; }

    public string? MembershipId { get; set; }
    
    public List<string>? TargetMemberIds { get; set; }
    
    public bool RunAll { get; set; } = false;
}
