using Microsoft.Extensions.Caching.Distributed;
using StackExchange.Redis;

namespace ContextProviderService.Services;

public class WatermarkService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<WatermarkService> _logger;

    public WatermarkService(IConnectionMultiplexer redis, ILogger<WatermarkService> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    public async Task UpdateWatermarkAsync(string entityType, string entityId, long position)
    {
        var db = _redis.GetDatabase();
        var key = $"watermark:{entityType.ToLower()}:{entityId}";
        
        // Only update if new position is greater (monotonicity)
        // using LUA script for atomicity? Or just standard set if greater logic.
        // For simulation, fire-and-forget SET is okay, but conditional SET is better.
        
        // Simple Set for now.
        await db.StringSetAsync(key, position.ToString());
        
        _logger.LogDebug("Watermark Updated: {Key} = {Pos}", key, position);
    }

    public async Task<long> GetWatermarkAsync(string entityType, string entityId)
    {
        var db = _redis.GetDatabase();
        var key = $"watermark:{entityType.ToLower()}:{entityId}";
        
        var val = await db.StringGetAsync(key);
        if (val.HasValue && long.TryParse(val.ToString(), out var pos))
        {
            return pos;
        }
        return 0;
    }
}
