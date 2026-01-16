using Microsoft.AspNetCore.Mvc;

namespace OrchestratorService.Controllers;

[ApiController]
[Route("api/context")]
public class ContextController : ControllerBase
{
    private readonly IHttpClientFactory _clientFactory;
    private readonly IConfiguration _config;
    // Determine the service URL. If not config, default to localhost:5222
    private readonly string _serviceUrl;

    public ContextController(IHttpClientFactory clientFactory, IConfiguration config)
    {
        _clientFactory = clientFactory;
        _config = config;
        _serviceUrl = _config["ServiceUrls:ContextProviderService"] ?? "http://localhost:5222";
    }

    [HttpGet("profiles")]
    public async Task<IActionResult> GetProfiles()
    {
        try
        {
            var client = _clientFactory.CreateClient();
            // Proxy to the actual microservice
            var response = await client.GetAsync($"{_serviceUrl}/api/context/profiles");
            
            if (!response.IsSuccessStatusCode)
            {
                // Fallback or error
                return StatusCode((int)response.StatusCode, $"Upstream Error: {response.ReasonPhrase}");
            }

            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }
        catch (Exception ex)
        {
            // If service is down, return empty list or error?
            // Returning empty list allows UI to render without crashing, but error warns user.
            // Let's return error so we know.
            return StatusCode(500, new { Message = "Failed to reach ContextProviderService", Error = ex.Message });
        }
    }
}
