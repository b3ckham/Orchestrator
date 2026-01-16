using ContextProviderService.Models;
using System.Text.Json;

namespace ContextProviderService.Services;

public class ContextAggregator
{
    private readonly HttpClient _http;
    private readonly ILogger<ContextAggregator> _logger;
    private readonly IConfiguration _config;
    private readonly ContextRegistryService _registry;

    public ContextAggregator(HttpClient http, ILogger<ContextAggregator> logger, IConfiguration config, ContextRegistryService registry)
    {
        _http = http;
        _logger = logger;
        _config = config;
        _registry = registry;
    }

    public async Task<FactPayload> ResolveContextAsync(string membershipId, string profileName)
    {
        _logger.LogInformation("Resolving Context for {MembershipId} using profile {Profile}", membershipId, profileName);
        
        var profile = _registry.GetProfile(profileName);
        if (profile == null)
        {
            _logger.LogWarning("Profile {ProfileName} not found. Falling back to 'Standard'", profileName);
            profile = _registry.GetProfile("Standard");
            // Fallback definition if Standard is also missing
            if (profile == null) profile = new ContextProfileDefinition("Fallback", "Default", new[] { "Member", "Wallet", "Compliance" });
        }

        var facts = new FactPayload();
        
        // Define Service URLs (Start Config Driven)
        var memberUrl = _config["ServiceUrls:MemberService"] ?? throw new InvalidOperationException("Config 'ServiceUrls:MemberService' missing");
        var walletUrl = _config["ServiceUrls:WalletService"] ?? throw new InvalidOperationException("Config 'ServiceUrls:WalletService' missing");
        var complianceUrl = _config["ServiceUrls:ComplianceService"] ?? throw new InvalidOperationException("Config 'ServiceUrls:ComplianceService' missing");

        // Parallel Fetching
        var tasks = new List<Task>();

        // 1. Fetch Member
        if (profile.DataSources.Contains("Member", StringComparer.OrdinalIgnoreCase))
        {
            tasks.Add(Task.Run(async () => {
                try {
                    // MemberService: GET /api/members/by-membership/{membershipId}
                    var member = await _http.GetFromJsonAsync<JsonElement>($"{memberUrl}/by-membership/{membershipId}");
                    
                    facts.Member = new MemberFact {
                        MembershipId = membershipId,
                        Status = member.GetProperty("status").GetString() ?? "Unknown",
                        Email = member.GetProperty("email").GetString() ?? "",
                        Phone = member.GetProperty("phone").GetString() ?? "",
                        Risk_Level = member.GetProperty("risk_Level").GetString() ?? "Low",
                        KYC_Level = member.GetProperty("kyC_Level").GetString() ?? "Pending",
                        Email_Verified = member.GetProperty("email_Verified").GetBoolean(),
                        Phone_Verified = member.GetProperty("phone_Verified").GetBoolean(),
                        GameStatus = member.GetProperty("gameStatus").GetString() ?? "Unlocked"
                    };
                } catch (Exception ex) { _logger.LogError(ex, "Failed to fetch Member facts for {MembershipId}", membershipId); }
            }));
        }

        // 2. Fetch Wallet
        if (profile.DataSources.Contains("Wallet", StringComparer.OrdinalIgnoreCase))
        {
            tasks.Add(Task.Run(async () => {
                try {
                    // WalletService: GET /api/wallets/{membershipId}
                    var wallet = await _http.GetFromJsonAsync<WalletFact>($"{walletUrl}/{membershipId}");
                    if (wallet != null) facts.Wallet = wallet;
                } catch (Exception ex) { _logger.LogError(ex, "Failed to fetch Wallet facts"); }
            }));
        }

        // 3. Fetch Compliance
        if (profile.DataSources.Contains("Compliance", StringComparer.OrdinalIgnoreCase))
        {
            tasks.Add(Task.Run(async () => {
                try {
                    // ComplianceService: GET /api/compliance/{membershipId}
                    var compliance = await _http.GetFromJsonAsync<ComplianceFact>($"{complianceUrl}/{membershipId}");
                    if (compliance != null) facts.Compliance = compliance;
                } catch (Exception ex) { _logger.LogError(ex, "Failed to fetch Compliance facts"); }
            }));
        }

        await Task.WhenAll(tasks);
        
        return facts;
    }
}
