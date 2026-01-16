using Microsoft.AspNetCore.Mvc;
using AuditService.Data;
using AuditService.Models;
using Microsoft.EntityFrameworkCore; // Added for ToListAsync

namespace AuditService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ErrorsController : ControllerBase
{
    private readonly AuditContext _context;
    private readonly ILogger<ErrorsController> _logger;

    public ErrorsController(AuditContext context, ILogger<ErrorsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> LogError([FromBody] SystemError error)
    {
        error.Timestamp = DateTime.UtcNow;
        
        _logger.LogError("Global Error Report: [{Category}] {ErrorCode}: {Message}", error.Category, error.ErrorCode, error.Message);
        
        _context.SystemErrors.Add(error);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(LogError), new { id = error.Id }, error);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SystemError>>> GetErrors()
    {
        return await _context.SystemErrors
            .OrderByDescending(e => e.Timestamp)
            .Take(100)
            .ToListAsync();
    }
}
