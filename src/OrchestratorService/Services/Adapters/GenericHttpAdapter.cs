using System.Text;
using System.Text.Json;
using OrchestratorService.Contracts;
using OrchestratorService.Models;
using Orchestrator.Shared.Contracts;

namespace OrchestratorService.Services.Adapters;

public class GenericHttpAdapter
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<GenericHttpAdapter> _logger;

    public GenericHttpAdapter(IHttpClientFactory httpFactory, ILogger<GenericHttpAdapter> logger)
    {
        _httpFactory = httpFactory;
        _logger = logger;
    }

    public async Task<ActionTraceDetail> ExecuteWithRouteAsync(WorkflowActionConfig action, ActionRouteConfig route, string membershipId, string? contextStatus)
    {
        var targetUrl = route.TargetUrl;
        var method = new HttpMethod(route.HttpMethod ?? "POST"); // Default POST
        var authToken = route.AuthSecret;

        // 1. Template Replacement
        var template = route.PayloadTemplate ?? "{}";
        // Also support URL replacement!
        targetUrl = ReplaceTokens(targetUrl, action, membershipId, contextStatus);
        var finalPayloadJson = ReplaceTokens(template, action, membershipId, contextStatus);

        // [Fix] Handle Double Braces accident from Seeding
        if (finalPayloadJson.Trim() == "{{}}") finalPayloadJson = "{}";

        var details = new ActionTraceDetail { 
            ActionType = action.Type, 
            Endpoint = targetUrl,
            // Request set later inside try
        };

        try
        {
            // Parse Request JSON safely
            try 
            {
                 details.Request = JsonDocument.Parse(string.IsNullOrWhiteSpace(finalPayloadJson) ? "{}" : finalPayloadJson).RootElement;
            }
            catch 
            {
                 details.Request = "Invalid JSON Payload generated"; 
            }

            var client = _httpFactory.CreateClient();
            var request = new HttpRequestMessage(method, targetUrl);

            // Add Auth
            if (!string.IsNullOrEmpty(authToken))
            {
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authToken);
            }

            // Add Content (only if not GET, though GET with body is legal in some weird places, usually not)
            if (method != HttpMethod.Get && !string.IsNullOrWhiteSpace(finalPayloadJson))
            {
                request.Content = new StringContent(finalPayloadJson, Encoding.UTF8, "application/json");
            }

            _logger.LogInformation("GenericAdapter: {Method} {Url} for {Action}", method, targetUrl, action.Type);
            var response = await client.SendAsync(request);
            
            details.StatusCode = (int)response.StatusCode;
            var respContent = await response.Content.ReadAsStringAsync();
            
            if (response.IsSuccessStatusCode)
            {
                details.Response = !string.IsNullOrEmpty(respContent) ? respContent : "Request Accepted";
            }
            else
            {
                details.Response = new { Error = respContent, Status = response.ReasonPhrase };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GenericAdapter Failed for {Action}", action.Type);
            details.Response = new { Error = ex.Message };
            details.StatusCode = 500;
        }

        return details;
    }

    private string ReplaceTokens(string input, WorkflowActionConfig action, string membershipId, string? contextStatus)
    {
        if (string.IsNullOrEmpty(input)) return input;
        
        var output = input.Replace("{{membershipId}}", membershipId)
                          .Replace("{{actionType}}", action.Type)
                          .Replace("{{contextStatus}}", contextStatus ?? "")
                          .Replace("{{timestamp}}", DateTime.UtcNow.ToString("O"));

        if (action.Params != null)
        {
            foreach (var param in action.Params)
            {
                output = output.Replace($"{{{{{param.Key}}}}}", param.Value);
            }
        }
        return output;
    }
}
