using MassTransit;
using OrchestratorService.Consumers;
using Microsoft.EntityFrameworkCore;
using OrchestratorService.Data;
using OrchestratorService.Data;
using OrchestratorService.Models;
using OrchestratorService.Services;
using OrchestratorService.Services.Adapters;
using OrchestratorService.Contracts;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Add services to the container.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<OrchestratorContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));
builder.Services.AddControllers(); // Enable controllers for API
// builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen();

builder.Services.AddHttpClient(); // Register HttpClient for making external calls
builder.Services.AddScoped<WorkflowEvaluator>();
builder.Services.AddScoped<ActionExecutionService>();
builder.Services.AddScoped<ConsistencyGateClient>();
builder.Services.AddScoped<ConsistencyGateClient>();
// [Universal Router] Generic adapter is used dynamically via ActionExecutionService
builder.Services.AddScoped<GenericHttpAdapter>(); 
builder.Services.AddScoped<TriggerRegistryService>();
builder.Services.AddScoped<DependencyGraphService>();
builder.Services.AddHostedService<WorkflowScheduler>();
builder.Services.AddScoped<DrlGenerationService>();
builder.Services.AddScoped<N8nService>(); // [NEW] Discovery Service

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.AllowAnyOrigin() // For POC, allow all. In prod, lock to specific origin
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<MemberStatusChangedConsumer>();
    x.AddConsumer<WalletUpdatedConsumer>();
    x.AddConsumer<ComplianceStatusChangedConsumer>();
    
    x.UsingRabbitMq((context, cfg) =>
    {
        var rabbitMqSection = builder.Configuration.GetSection("RabbitMQ");
        cfg.Host(rabbitMqSection["Host"] ?? throw new InvalidOperationException("RabbitMQ Host missing"), "/", h =>
        {
            h.Username(rabbitMqSection["Username"] ?? throw new InvalidOperationException("RabbitMQ Username missing"));
            h.Password(rabbitMqSection["Password"] ?? throw new InvalidOperationException("RabbitMQ Password missing"));
        });

        cfg.ReceiveEndpoint("member-status-changed", e =>
        {
            e.ConfigureConsumer<MemberStatusChangedConsumer>(context);
        });

        cfg.ReceiveEndpoint("wallet-updated", e =>
        {
            e.ConfigureConsumer<WalletUpdatedConsumer>(context);
        });

        cfg.ReceiveEndpoint("compliance-status-changed", e =>
        {
            e.ConfigureConsumer<ComplianceStatusChangedConsumer>(context);
        });
    });
});

// builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen();

var app = builder.Build();

// Bootstrap Database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OrchestratorContext>();
    var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    // DEV ONLY: Reset Database to ensure new tables are created
    // db.Database.EnsureDeleted();
    db.Database.EnsureCreated();
    
    // Seed default workflow if empty
    if (!db.WorkflowDefinitions.Any())
    {
        db.WorkflowDefinitions.Add(new WorkflowDefinition 
        { 
            Name = "Confiscation Protocol", 
            EntityType = "Member",
            Version = 1,
            TriggerEvent = "MemberStatusChanged", 
            TriggerKey = "confiscation_protocol_v1",
            ConditionCriteria = "NewStatus == Confiscated", 
            ActionType = "LOCK_WALLET",
            RuleSet = "policy_confiscation_v1",
            ContextProfile = "Standard"
        });
        db.WorkflowDefinitions.Add(new WorkflowDefinition 
        { 
            Name = "Welcome Back", 
            EntityType = "Member",
            Version = 1,
            TriggerEvent = "MemberStatusChanged", 
            TriggerKey = "welcome_back_v1",
            ConditionCriteria = "NewStatus == Active", 
            ActionType = "UNLOCK_WALLET",
            RuleSet = "policy_welcome_back_v1",
            ContextProfile = "Standard"
        });
        db.SaveChanges();
    }

    // Helper to get base Authority (scheme://host:port) to avoid double-path issues
    string GetAuthority(string url) {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri)) return uri.GetLeftPart(UriPartial.Authority);
        return url; // Fallback if simple string
    }

    var n8nUrl = config["ServiceUrls:N8n"] ?? "http://localhost:5678/webhook";
    var memBase = GetAuthority(config["ServiceUrls:MemberService"] ?? "http://localhost:5119");
    var walBase = GetAuthority(config["ServiceUrls:WalletService"] ?? "http://localhost:5250");
    var comBase = GetAuthority(config["ServiceUrls:ComplianceService"] ?? "http://localhost:5300");

    void EnsureAdapter(string name, string url)
    {
        var adapter = db.ActionAdapterConfigs.FirstOrDefault(a => a.AdapterName == name);
        if (adapter != null)
        {
            adapter.BaseUrl = url;
            adapter.IsActive = true;
        }
        else
        {
            db.ActionAdapterConfigs.Add(new ActionAdapterConfig 
            { 
                AdapterName = name, 
                BaseUrl = url, 
                IsActive = true, 
                DefaultHeadersJson = "{}" 
            });
        }
    }

    EnsureAdapter("N8n", n8nUrl);
    // EnsureAdapter("MemberService", memBase + "/api/members"); // Replaced by Service Discovery
    // EnsureAdapter("WalletService", walBase + "/api/wallets"); // Replaced by Service Discovery
    // EnsureAdapter("ComplianceService", comBase + "/api/compliance"); // Replaced by Service Discovery
    
    db.SaveChanges();

    // SYNC RULES TO ENGINE ON STARTUP
    var activeWorkflows = db.WorkflowDefinitions.Where(w => w.IsActive).ToList();
    if (activeWorkflows.Any())
    {
        // RETRY SYNC RULES TO ENGINE ON STARTUP
        int retries = 5;
        for (int i = 0; i < retries; i++)
        {
            try
            {
                var drlGen = scope.ServiceProvider.GetRequiredService<DrlGenerationService>();
                var http = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>().CreateClient();
                var ruleServiceUrl = config["ServiceUrls:RuleService"] 
                    ?? throw new InvalidOperationException("Configuration 'ServiceUrls:RuleService' is missing.");
                
                bool allSynced = true;
                foreach (var w in activeWorkflows)
                {
                    try
                    {
                        var drl = drlGen.GenerateDrl(w);
                        var payload = new { ruleSetName = w.RuleSet, drlContent = drl };
                        var response = http.PostAsJsonAsync($"{ruleServiceUrl}/deploy", payload).Result; // Sync wait
                        
                        if (response.IsSuccessStatusCode) Console.WriteLine($" - Synced: {w.Name} ({w.RuleSet})");
                        else 
                        {
                            Console.WriteLine($" - FAILED: {w.Name} ({response.StatusCode})");
                            allSynced = false;
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($" - ERROR: {w.Name} - {ex.Message}");
                        allSynced = false;
                    }
                }
                
                if (allSynced) 
                {
                    Console.WriteLine("✅ All rules synced successfully.");
                    break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Startup] Rule Sync Attempt {i+1} failed: {ex.Message}");
            }
            
            Console.WriteLine($"❌ Rule Service not ready. Retrying in 5s... ({i+1}/{retries})");
            System.Threading.Thread.Sleep(5000);
        }
    }

}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    // app.UseSwagger();
    // app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");

app.UseMiddleware<OrchestratorService.Middleware.GlobalExceptionMiddleware>();

app.MapControllers(); // Enable Mapping

app.Run();
