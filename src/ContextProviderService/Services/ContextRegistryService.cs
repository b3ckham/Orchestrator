using ContextProviderService.Models;
using Microsoft.Extensions.Configuration;

namespace ContextProviderService.Services;

public class ContextRegistryService
{
    private readonly List<ContextProfileDefinition> _profiles;

    public ContextRegistryService(IConfiguration configuration)
    {
        _profiles = configuration.GetSection("ContextProfiles").Get<List<ContextProfileDefinition>>() 
                    ?? new List<ContextProfileDefinition>();
    }

    public List<ContextProfileDefinition> GetProfiles()
    {
        return _profiles;
    }

    public ContextProfileDefinition? GetProfile(string name)
    {
        return _profiles.FirstOrDefault(p => p.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
    }
}
