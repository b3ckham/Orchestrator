using Orchestrator.Shared.Infrastructure;

namespace ComplianceService.Infrastructure;

public class ServiceRegistration : BaseServiceRegistration
{
    public ServiceRegistration(
        IHttpClientFactory httpClientFactory, 
        IConfiguration config, 
        ILogger<ServiceRegistration> logger) 
        : base(httpClientFactory, config, logger, "ComplianceService")
    {
    }

    protected override IEnumerable<ActionRouteConfig> GetRoutes()
    {
        var baseUrl = "http://localhost:5300"; // Default
        
        return new[]
        {
            new ActionRouteConfig 
            { 
                ActionType = "SET_KYC_LEVEL", 
                TargetUrl = $"{baseUrl}/api/compliance/{{{{membershipId}}}}/status", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"status\": \"Verified\" }" 
            },
            new ActionRouteConfig 
            { 
                ActionType = "SET_RISK_LEVEL", 
                TargetUrl = $"{baseUrl}/api/compliance/{{{{membershipId}}}}/status", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"riskLevel\": \"High\" }" 
            }
        };
    }
}
