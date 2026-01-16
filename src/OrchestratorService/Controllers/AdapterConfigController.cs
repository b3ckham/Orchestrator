using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrchestratorService.Data;
using OrchestratorService.Models;

namespace OrchestratorService.Controllers;

[ApiController]
[Route("api/adapters")]
public class AdapterConfigController : ControllerBase
{
    private readonly OrchestratorContext _db;
    private readonly ILogger<AdapterConfigController> _logger;

    public AdapterConfigController(OrchestratorContext db, ILogger<AdapterConfigController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ActionAdapterConfig>>> GetAdapters()
    {
        return await _db.ActionAdapterConfigs.ToListAsync();
    }

    [HttpGet("{name}")]
    public async Task<ActionResult<ActionAdapterConfig>> GetAdapter(string name)
    {
        var config = await _db.ActionAdapterConfigs.FirstOrDefaultAsync(a => a.AdapterName == name);
        if (config == null) return NotFound();
        return config;
    }

    [HttpPut("{name}")]
    public async Task<IActionResult> UpdateAdapter(string name, [FromBody] ActionAdapterConfig updatedConfig)
    {
        var config = await _db.ActionAdapterConfigs.FirstOrDefaultAsync(a => a.AdapterName == name);
        if (config == null) return NotFound();

        config.BaseUrl = updatedConfig.BaseUrl;
        config.AuthToken = updatedConfig.AuthToken;
        config.DefaultHeadersJson = updatedConfig.DefaultHeadersJson;
        config.IsActive = updatedConfig.IsActive;
        // [Fixed] Save the ApiKey provided by the user
        config.ApiKey = updatedConfig.ApiKey;

        await _db.SaveChangesAsync();
        
        // FUTURE: Invalidate Cache here using IMemoryCache
        _logger.LogInformation("Adapter {AdapterName} configuration updated.", name);

        return NoContent();
    }
}
