using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration; // Added this import

namespace OrchestratorService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QueueController : ControllerBase
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config; // Added this field
    private readonly string _rabbitMqUrl; // Changed from const to readonly
    private readonly string _rabbitUser;
    private readonly string _rabbitPass;

    public QueueController(HttpClient http, IConfiguration config) // Modified constructor signature
    {
        _http = http;
        _config = config; // Initialized IConfiguration
        _rabbitMqUrl = config["ServiceUrls:RabbitMqMgr"] ?? throw new InvalidOperationException("RabbitMQ Mgr Config Missing");
        _rabbitUser = config["RabbitMQ:Username"] ?? throw new InvalidOperationException("RabbitMQ Username Missing");
        _rabbitPass = config["RabbitMQ:Password"] ?? throw new InvalidOperationException("RabbitMQ Password Missing");
    }

    [HttpGet]
    public async Task<IActionResult> GetQueues()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"{_rabbitMqUrl}/queues");
        SetAuthHeader(request);

        try
        {
            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode) return StatusCode((int)response.StatusCode, "Failed to fetch queues");

            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(502, $"RabbitMQ unreachable: {ex.Message}");
        }
    }

    [HttpGet("{name}/messages")]
    public async Task<IActionResult> PeekMessages(string name, [FromQuery] int count = 10)
    {
        // RabbitMQ Management API "get" is actually a POST
        // We use ackmode: ack_requeue_true to peek without consuming
        var payload = new 
        { 
            count = count, 
            ackmode = "ack_requeue_true", 
            encoding = "auto",
            truncate = 50000 
        };

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_rabbitMqUrl}/queues/%2F/{Uri.EscapeDataString(name)}/get");
        SetAuthHeader(request);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode) return StatusCode((int)response.StatusCode, "Failed to peek messages");

            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(502, $"RabbitMQ unreachable: {ex.Message}");
        }
    }

    private void SetAuthHeader(HttpRequestMessage request)
    {
        var authValue = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_rabbitUser}:{_rabbitPass}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", authValue);
    }
}
