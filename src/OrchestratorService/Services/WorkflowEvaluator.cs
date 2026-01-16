using System.Text.Json;
using OrchestratorService.Models;

namespace OrchestratorService.Services;

public class WorkflowEvaluator
{
    private readonly ILogger<WorkflowEvaluator> _logger;
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ConsistencyGateClient _gate;

    public WorkflowEvaluator(ILogger<WorkflowEvaluator> logger, HttpClient http, IConfiguration _config, ConsistencyGateClient gate)
    {
        _logger = logger;
        _http = http;
        this._config = _config;
        _gate = gate;
    }

    public async Task<RuleEvaluationResponse> EvaluateAsync(WorkflowDefinition rule, string membershipId, long minPos = 0, object? triggerData = null)
    {
        // 0. Consistency Gate (Wait for CDC Propagation)
        if (minPos > 0)
        {
            _logger.LogInformation("⏳ Waiting for Causal Consistency. Entity: {Id}, RequiredPos: {Pos}", membershipId, minPos);
            var isConsistent = await _gate.WaitForConsistencyAsync("Member", membershipId, minPos);
            
            if (!isConsistent)
            {
                _logger.LogWarning("❌ Consistency Timeout. Evaluation Aborted. Rule: {Rule}", rule.Name);
                return new RuleEvaluationResponse { IsMatch = false, Outcome = "ConsistencyTimeout" };
            }
            _logger.LogInformation("✅ Consistency Met. Proceeding with Evaluation.");
        }

        // 1. Resolve Context (Data Aggregation)
        var contextUrl = _config["ServiceUrls:ContextProvider"] 
            ?? throw new InvalidOperationException("ServiceUrls:ContextProvider missing");
        var contextProfile = rule.ContextProfile; 

        System.Text.Json.Nodes.JsonObject facts = new(); // Initialize to empty

        try 
        {
            _logger.LogInformation("Fetching Context for {MembershipId} with profile {Profile}", membershipId, contextProfile);
            var requestUrl = $"{contextUrl}/facts/evaluate";
            var payload = new 
            { 
                membershipId = membershipId, 
                contextProfile = rule.ContextProfile, 
                ruleSet = rule.RuleSet
            };

            var response = await _http.PostAsJsonAsync(requestUrl, payload);

            if (response.IsSuccessStatusCode)
            {
                facts = await response.Content.ReadFromJsonAsync<System.Text.Json.Nodes.JsonObject>() ?? new System.Text.Json.Nodes.JsonObject();
            }
            else
            {
                _logger.LogError("Context Service returned {StatusCode} for {MembershipId} with profile {Profile}", response.StatusCode, membershipId, contextProfile);
                return new RuleEvaluationResponse { IsMatch = false, Outcome = "ContextFetchFailed" };
            }

            // MERGE TRIGGER DATA (Smart Mapping to Context Structure)
            // Java RuleService IGNORES root-level trigger keys. We must update the nested 'member'/'wallet' objects.
            if (triggerData != null)
            {
                 var triggerJson = JsonSerializer.SerializeToNode(triggerData)?.AsObject();
                 if (triggerJson != null)
                 {
                     // 1. Map Member Status (MemberStatusChanged)
                     if (triggerJson.ContainsKey("NewStatus") && facts["member"] != null)
                     {
                         facts["member"]!["status"] = triggerJson["NewStatus"]?.DeepClone();
                     }

                     // 2. Map Wallet Status/Balance (WalletUpdated)
                     if (facts["wallet"] != null)
                     {
                         if (triggerJson.ContainsKey("Status")) facts["wallet"]!["status"] = triggerJson["Status"]?.DeepClone();
                         if (triggerJson.ContainsKey("Balance")) facts["wallet"]!["balance"] = triggerJson["Balance"]?.DeepClone();
                     }
                     
                     // 3. Map Compliance Risk (ComplianceStatusChanged) - Assuming trigger has RiskLevel/KycStatus
                     if (facts["compliance"] != null)
                     {
                         if (triggerJson.ContainsKey("RiskLevel")) facts["compliance"]!["riskLevel"] = triggerJson["RiskLevel"]?.DeepClone();
                         if (triggerJson.ContainsKey("KycStatus")) facts["compliance"]!["kycStatus"] = triggerJson["KycStatus"]?.DeepClone();
                     }
                 }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch context. Rule evaluation aborted.");
            return new RuleEvaluationResponse { IsMatch = false, Outcome = "ContextFetchError" };
        }

        // 2. Execute Rules (Decision Engine)
        var ruleServiceUrl = _config["ServiceUrls:RuleService"] 
             ?? throw new InvalidOperationException("ServiceUrls:RuleService missing");
        var ruleSet = rule.RuleSet ?? "default_policy";

        try 
        {
            var request = new RuleEvaluationRequest 
            { 
                RuleSetName = ruleSet,
                Facts = facts
            };

            _logger.LogInformation("Executing RuleSet {RuleSet} against Rule Service", ruleSet);
            var response = await _http.PostAsJsonAsync($"{ruleServiceUrl}/evaluate", request);
            
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<RuleEvaluationResponse>();
                if (result != null) 
                {
                    result.Facts = facts; // Ensure facts are attached even if RuleService didn't echo them
                }
                return result ?? new RuleEvaluationResponse { IsMatch = false };
            }
            else 
            {
                _logger.LogError("Rule Service returned {StatusCode}", response.StatusCode);
                return new RuleEvaluationResponse { IsMatch = false, Outcome = "RuleExecutionFailed" };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to execute rules.");
            return new RuleEvaluationResponse { IsMatch = false, Outcome = "RuleExecutionError" };
        }
    }
}
