using MassTransit;
using AuditService.Data;
using AuditService.Models;
using MemberService.Contracts;
using MemberService.Contracts;
using Orchestrator.Shared.Contracts;
using Orchestrator.Shared.Models;

namespace AuditService.Consumers;

public class AuditConsumers : 
    IConsumer<MemberStatusChanged>,
    IConsumer<WalletUpdated>,
    IConsumer<ComplianceStatusChanged>
{
    private readonly AuditContext _db;
    private readonly ILogger<AuditConsumers> _logger;

    public AuditConsumers(AuditContext db, ILogger<AuditConsumers> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<MemberStatusChanged> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Audit: Member {Id} status changed from {Old} to {New}", msg.MembershipId, msg.OldStatus, msg.NewStatus);
        
        _db.AuditLogs.Add(new AuditLog
        {
            EntityId = msg.MembershipId,
            EntityType = "Member",
            Action = "StatusChange",
            PreviousState = msg.OldStatus,
            NewState = msg.NewStatus,
            Source = "MemberService",
            Timestamp = msg.OccurredAt
        });
        await _db.SaveChangesAsync();
    }

    public async Task Consume(ConsumeContext<WalletUpdated> context)
    {
        var msg = context.Message;
        // Logic to track status changes primarily
        _db.AuditLogs.Add(new AuditLog
        {
            EntityId = msg.MembershipId,
            EntityType = "Wallet",
            Action = "Update",
            PreviousState = msg.PreviousStatus.ToString(), 
            NewState = $"{msg.Status} (Balance: {msg.Balance})",
            Source = "WalletService",
            Timestamp = msg.UpdatedAt
        });
        await _db.SaveChangesAsync();
    }

    public async Task Consume(ConsumeContext<ComplianceStatusChanged> context)
    {
        var msg = context.Message;
        _db.AuditLogs.Add(new AuditLog
        {
            EntityId = msg.MembershipId,
            EntityType = "Compliance",
            Action = "StatusChange",
            PreviousState = $"{msg.PreviousStatus} (Risk: {msg.PreviousRiskLevel})",
            NewState = $"{msg.NewStatus} (Risk: {msg.RiskLevel})",
            Source = "ComplianceService",
            Timestamp = msg.UpdatedAt
        });
        await _db.SaveChangesAsync();
    }
}
