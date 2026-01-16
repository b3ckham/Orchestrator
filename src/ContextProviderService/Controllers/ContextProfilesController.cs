using ContextProviderService.Services;
using Microsoft.AspNetCore.Mvc;

namespace ContextProviderService.Controllers;

[ApiController]
[Route("api/context/profiles")]
public class ContextProfilesController : ControllerBase
{
    private readonly ContextRegistryService _registry;

    public ContextProfilesController(ContextRegistryService registry)
    {
        _registry = registry;
    }

    [HttpGet]
    public IActionResult GetProfiles()
    {
        return Ok(_registry.GetProfiles());
    }
}
