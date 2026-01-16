using Microsoft.EntityFrameworkCore;
using OrchestratorService.Data;
using OrchestratorService.Models;

namespace OrchestratorService.Services;

public class DependencyGraphService
{
    private readonly OrchestratorContext _db;
    private readonly ILogger<DependencyGraphService> _logger;

    // Simple In-Memory Cache for now (Version Pointer)
    // Map: TriggerType -> List<WorkflowDefinition>
    private static Dictionary<string, List<WorkflowDefinition>> _cache = new();

    public DependencyGraphService(OrchestratorContext db, ILogger<DependencyGraphService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<List<WorkflowDefinition>> GetImpactedWorkflowsAsync(string triggerType, string entityType)
    {
        // 1. Check Cache
        var cacheKey = $"{triggerType}:{entityType}";
        if (_cache.ContainsKey(cacheKey))
        {
            return _cache[cacheKey];
        }

        // 2. Query DB (Dependency Graph Resolution)
        // We look for definitions that match the TriggerEvent AND EntityType
        // We take the latest VERSION (if we had multiple versions, we'd order by Version Desc or use a pointer table)
        // For now, we assume active definitions in DB are the "Pointers".
        
        _logger.LogInformation("Re-building Dependency Graph for {Key}", cacheKey);

        var definitions = await _db.WorkflowDefinitions
            .Where(w => w.IsActive 
                     && w.TriggerEvent == triggerType 
                     && (w.EntityType == entityType || w.EntityType == "Any"))
            .ToListAsync();

        // 3. Update Cache
        _cache[cacheKey] = definitions;

        return definitions;
    }

    public void InvalidateCache()
    {
        _cache.Clear();
        _logger.LogInformation("Dependency Graph Cache Invalidated");
    }
}
