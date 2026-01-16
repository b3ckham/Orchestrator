using Microsoft.AspNetCore.Mvc;
using AuditService.Data;
using AuditService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuditService.Controllers;

[ApiController]
[Route("api/audit")]
public class AuditController : ControllerBase
{
    private readonly AuditContext _context;

    public AuditController(AuditContext context)
    {
        _context = context;
    }

    [HttpGet("logs")]
    public async Task<ActionResult<IEnumerable<AuditLog>>> GetLogs(
        [FromQuery] string? entityId, 
        [FromQuery] string? entityType)
    {
        var query = _context.AuditLogs.AsQueryable();

        if (!string.IsNullOrEmpty(entityId))
        {
            query = query.Where(l => l.EntityId == entityId);
        }

        if (!string.IsNullOrEmpty(entityType) && entityType != "All")
        {
            query = query.Where(l => l.EntityType == entityType);
        }

        return await query
            .OrderByDescending(l => l.Timestamp)
            .Take(100)
            .ToListAsync();
    }
}
