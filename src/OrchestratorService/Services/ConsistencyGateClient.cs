using Orchestrator.Shared.Contracts;

namespace OrchestratorService.Services;

public class ConsistencyGateClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<ConsistencyGateClient> _logger;

    public ConsistencyGateClient(HttpClient http, IConfiguration config, ILogger<ConsistencyGateClient> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<bool> WaitForConsistencyAsync(string entityType, string entityId, long minPos)
    {
        var contextUrl = _config["ServiceUrls:ContextProvider"] 
            ?? throw new InvalidOperationException("ServiceUrls:ContextProvider missing");

        var request = new ConsistencyWaitRequest
        {
            EntityType = entityType,
            EntityId = entityId,
            RequiredMinPos = minPos,
            TimeoutMs = 5000 // Configurable?
        };

        try 
        {
            var response = await _http.PostAsJsonAsync($"{contextUrl}/consistency/wait", request);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<ConsistencyResponse>();
                return result?.IsConsistent ?? false;
            }
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Consistency Gate Check Failed");
            return false;
        }
    }
}
