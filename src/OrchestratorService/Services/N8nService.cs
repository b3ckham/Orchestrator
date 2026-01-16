using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using OrchestratorService.Data;

namespace OrchestratorService.Services;

public class N8nService
{
    private readonly OrchestratorContext _db;
    private readonly HttpClient _http;
    private readonly ILogger<N8nService> _logger;

    public N8nService(OrchestratorContext db, IHttpClientFactory httpFactory, ILogger<N8nService> logger)
    {
        _db = db;
        _http = httpFactory.CreateClient();
        _logger = logger;
    }

    private async Task<(string BaseUrl, string ApiKey)> GetCredentials()
    {
        var config = await _db.ActionAdapterConfigs.FirstOrDefaultAsync(a => a.AdapterName == "N8n");
        if (config == null) throw new InvalidOperationException("N8n adapter not configured in ActionAdapterConfigs.");
        if (string.IsNullOrEmpty(config.ApiKey)) throw new InvalidOperationException("N8n API Key is missing in configuration.");
        
        // Ensure BaseUrl is the root (remove /webhook if present for management API calls)
        var rootUrl = config.BaseUrl;
        if (rootUrl.EndsWith("/webhook")) rootUrl = rootUrl.Replace("/webhook", "");
        if (rootUrl.EndsWith("/")) rootUrl = rootUrl.TrimEnd('/');
        
        return (rootUrl, config.ApiKey);
    }

    public async Task<JsonNode> GetProjectsAsync()
    {
        var (baseUrl, apiKey) = await GetCredentials();
        var request = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/api/v1/projects?limit=100");
        request.Headers.Add("X-N8N-API-KEY", apiKey);

        var response = await _http.SendAsync(request);
        response.EnsureSuccessStatusCode();
        
        var json = await response.Content.ReadAsStringAsync();
        return JsonNode.Parse(json)!;
    }

    public async Task<List<N8nWorkflowDto>> GetWorkflowsAsync(string? projectId = null)
    {
        var (baseUrl, apiKey) = await GetCredentials();
        // n8n API doesn't support filtering by project in GET /workflows yet easily, 
        // so we fetch all and filter client side if needed, or just return all.
        // Public API: GET /api/v1/workflows
        
        var request = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/api/v1/workflows?limit=100");
        request.Headers.Add("X-N8N-API-KEY", apiKey);

        var response = await _http.SendAsync(request);
        response.EnsureSuccessStatusCode();
        
        var json = await response.Content.ReadAsStringAsync();
        var root = JsonNode.Parse(json);
        var data = root?["data"]?.AsArray();

        var result = new List<N8nWorkflowDto>();
        if (data == null) return result;

        foreach (var w in data)
        {
            var id = w?["id"]?.ToString();
            var name = w?["name"]?.ToString();
            var isActive = w?["active"]?.GetValue<bool>() ?? false;
            var tags = w?["tags"]?.AsArray().Select(t => t?["name"]?.ToString()).Where(x => x != null).Select(x => x!).ToList() ?? new List<string>();
            
            // Parse nodes to find Webhooks
            var nodes = w?["nodes"]?.AsArray();
            var webhooks = new List<string>();
            
            if (nodes != null)
            {
                foreach (var node in nodes)
                {
                    if (node == null) continue;
                    var type = node["type"]?.ToString();
                    if (type != null && type.Contains("webhook") && type.Contains("n8n-nodes-base"))
                    {
                        // Check if it's a POST webhook
                        var method = node["parameters"]?["httpMethod"]?.ToString() ?? "GET";
                        var path = node["parameters"]?["path"]?.ToString();
                        
                        if (path != null)
                        {
                            var fullUrl = $"{baseUrl}/webhook/{path}";
                            // If user explicitly asks for Test URL, n8n uses /webhook-test/, but for Prod we use /webhook/
                            webhooks.Add($"{method}: {fullUrl} ({node["name"]})");
                        }
                    }
                }
            }

            if (webhooks.Any())
            {
                result.Add(new N8nWorkflowDto
                {
                    Id = id!,
                    Name = name!,
                    IsActive = isActive,
                    Tags = tags!,
                    Webhooks = webhooks
                });
            }
        }
        
        // Debug Log
        foreach(var wf in result)
        {
             foreach(var wh in wf.Webhooks) 
             {
                 Console.WriteLine($"[N8n Discovery] Found: {wf.Name} -> {wh} (Valid: {wf.IsActive})");
             }
        }

        return result;
    }
}

public class N8nWorkflowDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public List<string> Tags { get; set; } = new();
    public List<string> Webhooks { get; set; } = new();
}
