using System.Text.Json;
using StackExchange.Redis;

namespace OrchestratorService.Services;

public record TriggerEvent(string TriggerType, string EntityType, string EntityId, string TriggerKey, DateTime TriggerTimestamp, object Payload);

public class TriggerRegistryService
{
    private readonly ILogger<TriggerRegistryService> _logger;
    private readonly IConnectionMultiplexer? _redis;
    private readonly IDatabase? _db;

    public TriggerRegistryService(ILogger<TriggerRegistryService> logger, IConfiguration configuration)
    {
        _logger = logger;
        try 
        {
            var redisConnectionString = configuration.GetConnectionString("Redis") 
                ?? throw new InvalidOperationException("Redis ConnectionString missing");
            var redisOptions = ConfigurationOptions.Parse(redisConnectionString);
            redisOptions.AbortOnConnectFail = false; 
            _redis = ConnectionMultiplexer.Connect(redisOptions);
            _db = _redis.GetDatabase();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to Redis. Deduplication will be disabled.");
        }
    }

    public async Task<TriggerEvent?> RegisterTriggerAsync(string triggerType, string entityType, string entityId, object payload)
    {
        var triggerKey = $"{triggerType}:{entityType}:{entityId}:{DateTime.Now:yyyyMMddHHmmss}"; // Seconds-based key to prevent false deduplication
        var eventId = Guid.NewGuid().ToString();
        var timestamp = DateTime.Now;

        // Idempotency Check (Redis)
        if (_db != null)
        {
            var exists = await _db.StringGetAsync(triggerKey);
            if (!exists.IsNull)
            {
                _logger.LogWarning("Duplicate Trigger Detected: {TriggerKey}. Skipping.", triggerKey);
                return null;
            }

            // Set key with 5 minute expiry
            await _db.StringSetAsync(triggerKey, eventId, TimeSpan.FromMinutes(5));
        }

        var trigger = new TriggerEvent(triggerType, entityType, entityId, triggerKey, timestamp, payload);
        
        _logger.LogInformation("Trigger Registered: [{TriggerType}] for {EntityType} {EntityId}. Key: {Key}", 
            triggerType, entityType, entityId, triggerKey);

        return trigger;
    }
}
