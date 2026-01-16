using Orchestrator.Shared.Infrastructure;

namespace MemberService.Infrastructure;

public class ServiceRegistration : BaseServiceRegistration
{
    public ServiceRegistration(
        IHttpClientFactory httpClientFactory, 
        IConfiguration config, 
        ILogger<ServiceRegistration> logger) 
        : base(httpClientFactory, config, logger, "MemberService")
    {
    }

    protected override IEnumerable<ActionRouteConfig> GetRoutes()
    {
        var baseUrl = "http://localhost:5119"; // Default MemberService Port
        
        return new[]
        {
            new ActionRouteConfig 
            { 
                ActionType = "GAME_LOCK", 
                TargetUrl = $"{baseUrl}/api/members/{{{{membershipId}}}}/game-lock", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"isLocked\": true }" 
            },
            new ActionRouteConfig 
            { 
                ActionType = "GAME_UNLOCK", 
                TargetUrl = $"{baseUrl}/api/members/{{{{membershipId}}}}/game-lock", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"isLocked\": false }" 
            },
            new ActionRouteConfig 
            { 
                ActionType = "SET_BONUS_ELIGIBILITY", 
                TargetUrl = $"{baseUrl}/api/members/{{{{membershipId}}}}/eligibility", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"bonusEligibility\": true }" 
            },
            new ActionRouteConfig 
            { 
                ActionType = "SET_DEPOSIT_ELIGIBILITY", 
                TargetUrl = $"{baseUrl}/api/members/{{{{membershipId}}}}/eligibility", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"depositEligibility\": true }" 
            },
            new ActionRouteConfig 
            { 
                ActionType = "SET_WITHDRAWAL_ELIGIBILITY", 
                TargetUrl = $"{baseUrl}/api/members/{{{{membershipId}}}}/eligibility", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"withdrawalEligibility\": true }" 
            },
            new ActionRouteConfig 
            { 
                ActionType = "SET_BANK_MGMT_LEVEL", 
                TargetUrl = $"{baseUrl}/api/members/{{{{membershipId}}}}/eligibility", 
                HttpMethod = "PUT", 
                PayloadTemplate = "{ \"bankAccountMgmtLevel\": \"VIP\" }" 
            }
        };
    }
}
