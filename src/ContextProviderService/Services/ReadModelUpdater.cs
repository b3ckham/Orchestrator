using MassTransit;
using MemberService.Contracts;
using Orchestrator.Shared.Contracts;

namespace ContextProviderService.Services;

// Simulates CDC: Listens to Domain Events and updates Watermark
public class ReadModelUpdater : IConsumer<MemberStatusChanged>
{
    private readonly WatermarkService _watermark;
    private readonly ILogger<ReadModelUpdater> _logger;

    public ReadModelUpdater(WatermarkService watermark, ILogger<ReadModelUpdater> logger)
    {
        _watermark = watermark;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<MemberStatusChanged> context)
    {
        // Simulation: treat Message Creation Time (Ticks) as the "Binlog Position"
        // In real world, this comes from CDC metadata.
        var position = context.Message.OccurredAt.Ticks;
        
        await _watermark.UpdateWatermarkAsync("Member", context.Message.MembershipId, position);
        
        _logger.LogInformation("CDC Simulation: Member Watermark moved to {Pos}", position);
    }
}
