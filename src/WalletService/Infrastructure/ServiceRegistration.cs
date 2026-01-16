using Orchestrator.Shared.Infrastructure;

namespace WalletService.Infrastructure;

public class ServiceRegistration : BaseServiceRegistration
{
    public ServiceRegistration(
        IHttpClientFactory httpClientFactory, 
        IConfiguration config, 
        ILogger<ServiceRegistration> logger) 
        : base(httpClientFactory, config, logger, "WalletService")
    {
    }

    protected override IEnumerable<ActionRouteConfig> GetRoutes()
    {
        // TODO: Get BaseUrl dynamically or from config? 
        // For now, assume relative path isn't supported by BaseServiceRegistration's simple POCO, 
        // OR the Orchestrator expects absolute URLs.
        // BaseServiceRegistration uses ActionRouteConfig which is a POCO.
        // We need to construct the URL.
        
        // Actually, let's grab the self-url from config or hardcode for now as before?
        // The previous Program.cs used config["ServiceUrls:WalletService"].
        // We can do the same here.
        
        // Wait, BaseServiceRegistration has access to _config.
        // But _config is private in base.
        // I can pass it or access via IConfiguration injected here.
        // I injected IConfiguration into the constructor.
        
        var baseUrl = "http://localhost:5250"; // Default
        // In a real app, I'd read this from config "ASPNETCORE_URLS" or similar, 
        // but for now let's use the known ServiceUrl config if available, or hardcode the docker internal one.
        // Since we are running locally/docker, let's use the one that Orchestrator can reach.
        // Orchestrator ActionRouteController just saves the string.
        
        return new[]
        {
            new ActionRouteConfig 
            { 
                ActionType = "LOCK_WALLET", 
                TargetUrl = $"{baseUrl}/api/wallets/{{{{membershipId}}}}/status", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"status\": \"Locked\" }" 
            },
            new ActionRouteConfig 
            { 
                ActionType = "UNLOCK_WALLET", 
                TargetUrl = $"{baseUrl}/api/wallets/{{{{membershipId}}}}/status", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"status\": \"Unlocked\" }" 
            }
        };
    }
}
