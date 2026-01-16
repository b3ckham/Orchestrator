using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

using Microsoft.Extensions.Configuration;

namespace OrchestratorService.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _auditServiceUrl;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger, IHttpClientFactory httpClientFactory, IConfiguration config)
    {
        _next = next;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _auditServiceUrl = config["ServiceUrls:AuditService"] 
            ?? throw new InvalidOperationException("ServiceUrls:AuditService config missing");
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        _logger.LogError(ex, "Global Exception Caught: {Message}", ex.Message);

        var (statusCode, category, errorCode, contextData) = ClassifyException(ex, context);

        var errorPayload = new
        {
            traceId = context.TraceIdentifier,
            serviceName = "OrchestratorService",
            timestamp = DateTime.UtcNow,
            severity = "Error",
            category,
            errorCode,
            message = ex.Message,
            stackTrace = ex.StackTrace,
            contextJson = JsonSerializer.Serialize(contextData)
        };

        // Fire-and-Forget to Audit Service
        _ = Task.Run(async () =>
        {
            try
            {
                using var client = _httpClientFactory.CreateClient();
                var json = new StringContent(JsonSerializer.Serialize(errorPayload), Encoding.UTF8, "application/json");
                await client.PostAsync(_auditServiceUrl, json);
            }
            catch (Exception auditEx)
            {
                // Fallback log if AuditService is down
                Console.WriteLine($"Failed to report error to AuditService: {auditEx.Message}");
            }
        });

        // Return JSON to caller
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;
        
        var response = new 
        { 
            error = errorCode, 
            message = ex.Message, 
            traceId = context.TraceIdentifier 
        };
        
        await context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }

    private (int statusCode, string category, string errorCode, Dictionary<string, string> contextData) ClassifyException(Exception ex, HttpContext httpContext)
    {
        var contextData = new Dictionary<string, string>
        {
            { "Path", httpContext.Request.Path },
            { "Method", httpContext.Request.Method }
        };

        // 1. Database Errors
        if (ex.GetType().Name.Contains("MySql") || ex.GetType().Name.Contains("DbUpdate"))
        {
            contextData.Add("DB_Provider", "MySQL");
            return (500, "Database", "DB_FAILURE", contextData);
        }

        // 2. Connectivity / HTTP Errors
        if (ex is HttpRequestException httpEx)
        {
            return (502, "Connectivity", "API_UNREACHABLE", contextData);
        }

        // 3. Timeouts
        if (ex is TaskCanceledException || ex is TimeoutException)
        {
            return (504, "Performance", "TIMEOUT", contextData);
        }

        // Default
        return (500, "General", "INTERNAL_SERVER_ERROR", contextData);
    }
}
