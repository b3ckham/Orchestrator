using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Net.Http.Json;
using Orchestrator.Shared.Models;

namespace Orchestrator.Shared.Infrastructure;

public abstract class BaseServiceRegistration : IHostedService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger _logger;
    private readonly string _serviceName;

    protected BaseServiceRegistration(
        IHttpClientFactory httpClientFactory, 
        IConfiguration config, 
        ILogger logger,
        string serviceName)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
        _serviceName = serviceName;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation($"[{_serviceName}] Registering routes with Orchestrator...");
        try
        {
            var orchestratorUrl = _config["ServiceUrls:Orchestrator"] ?? "http://localhost:5200";
            var client = _httpClientFactory.CreateClient();
            var routes = GetRoutes();

            var response = await client.PostAsJsonAsync($"{orchestratorUrl}/api/routes/batch", routes, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation($"[{_serviceName}] Registration Successful ({routes.Count()} routes).");
            }
            else
            {
                _logger.LogError($"[{_serviceName}] Registration Failed: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"[{_serviceName}] Registration Error");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    protected abstract IEnumerable<ActionRouteConfig> GetRoutes();
}

public class ActionRouteConfig
{
    public string ActionType { get; set; } = string.Empty;
    public string TargetUrl { get; set; } = string.Empty;
    public string HttpMethod { get; set; } = "POST";
    public string PayloadTemplate { get; set; } = "{}";
    public string? AuthSecret { get; set; }
}
