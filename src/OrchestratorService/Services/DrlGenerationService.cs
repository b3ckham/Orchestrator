using System.Text;
using OrchestratorService.Models;

namespace OrchestratorService.Services;

public class DrlGenerationService
{
    private readonly ILogger<DrlGenerationService> _logger;

    public DrlGenerationService(ILogger<DrlGenerationService> logger)
    {
        _logger = logger;
    }

    public string GenerateDrl(WorkflowDefinition definition)
    {
        var ruleName = $"Rule_{definition.Id}_{DateTime.UtcNow.Ticks}";
        
        // Basic Condition Parsing
        // We support parsing "Field Operator Value" strings like: "Member.Status == Suspended"
        
        var condition = definition.ConditionCriteria;
        var drlCondition = ConvertToDrlCondition(condition);

        var drlBuilder = new StringBuilder();
        drlBuilder.AppendLine("package rules;");
        drlBuilder.AppendLine("import com.orchestrator.rules.model.Member;");
        drlBuilder.AppendLine("import com.orchestrator.rules.model.Wallet;");
        drlBuilder.AppendLine("import com.orchestrator.rules.model.Compliance;");
        drlBuilder.AppendLine("global com.orchestrator.rules.model.RuleEvaluationResponse response;");
        drlBuilder.AppendLine("");
        drlBuilder.AppendLine($"rule \"{ruleName}\"");
        // IMPORTANT: Agenda Group ensures isolation. Only rules in this group fire when requested.
        drlBuilder.AppendLine($"    agenda-group \"{definition.RuleSet}\"");
        drlBuilder.AppendLine("    when");
        drlBuilder.AppendLine($"        {drlCondition}");
        drlBuilder.AppendLine("    then");
        drlBuilder.AppendLine("        response.setMatch(true);");
        drlBuilder.AppendLine($"        response.setOutcome(\"{definition.ActionType}\");");
        drlBuilder.AppendLine($"        response.addReason(\"Matched Condition: {condition}\");");
        drlBuilder.AppendLine("end");

        return drlBuilder.ToString();
    }

    private string ConvertToDrlCondition(string criteria)
    {
        // Example Input: "NewStatus == Suspended" or "Member.Status == Suspended"
        // Target DRL: $m : Member( status == "Suspended" )

        if (string.IsNullOrWhiteSpace(criteria)) return "$m : Member()"; // Match any

        var parts = criteria.Split(new[] { "==", "!=", ">", "<" }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2) return "$m : Member()"; // Fallback

        var field = parts[0].Trim();
        var value = parts[1].Trim().Replace("\"", ""); // User might input quotes, remove them for safe reprocessing
        
        // Identify Logic
        string operatorSymbol = "==";
        if (criteria.Contains("!=")) operatorSymbol = "!=";
        else if (criteria.Contains(">")) operatorSymbol = ">";
        else if (criteria.Contains("<")) operatorSymbol = "<";

        // Map Field to Object
        // For POC, we assume simple mapping:
        // NewStatus -> Member.status
        // WalletStatus -> Wallet.status
        // RiskLevel -> Compliance.riskLevel
        // KYC_Level -> Member.kyC_Level (Note: property casing matters in DRL getter)

        if (field.Equals("NewStatus", StringComparison.OrdinalIgnoreCase) || field.Equals("Member.Status", StringComparison.OrdinalIgnoreCase))
        {
            return $"$m : Member( status {operatorSymbol} \"{value}\" )";
        }
        else if (field.Equals("WalletStatus", StringComparison.OrdinalIgnoreCase) || field.Equals("Wallet.Status", StringComparison.OrdinalIgnoreCase))
        {
            return $"$w : Wallet( status {operatorSymbol} \"{value}\" )";
        }
        else if (field.Equals("RiskLevel", StringComparison.OrdinalIgnoreCase) || field.Equals("Compliance.RiskLevel", StringComparison.OrdinalIgnoreCase))
        {
            // Compliance risk is on Compliance object
            return $"$c : Compliance( riskLevel {operatorSymbol} \"{value}\" )";
        }
        else if (field.Equals("KYC_Level", StringComparison.OrdinalIgnoreCase))
        {
            // KYC Level is on Member object
            return $"$m : Member( kyC_Level {operatorSymbol} \"{value}\" )";
        }

        // Default Fallback
        return $"$m : Member( status {operatorSymbol} \"{value}\" )";
    }
}
