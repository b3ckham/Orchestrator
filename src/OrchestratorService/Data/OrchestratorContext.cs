using Microsoft.EntityFrameworkCore;
using OrchestratorService.Models;

namespace OrchestratorService.Data;

public class OrchestratorContext : DbContext
{
    public OrchestratorContext(DbContextOptions<OrchestratorContext> options) : base(options) { }

    public DbSet<WorkflowDefinition> WorkflowDefinitions { get; set; }
    public DbSet<WorkflowExecution> WorkflowExecutions { get; set; }
    public DbSet<ActionAdapterConfig> ActionAdapterConfigs { get; set; }
    public DbSet<ActionRouteConfig> ActionRoutes { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Seed Default N8n Configuration
        modelBuilder.Entity<ActionAdapterConfig>().HasData(new ActionAdapterConfig 
        {
            Id = 1,
            AdapterName = "N8n",
            BaseUrl = "http://localhost:5678/webhook",
            IsActive = true,
            DefaultHeadersJson = "{}"
        });

        // Seed Default Action Routes
        modelBuilder.Entity<ActionRouteConfig>().HasData(
            new ActionRouteConfig 
            { 
                ActionType = "TEAM_NOTIFY", 
                TargetUrl = "http://localhost:5678/webhook/team-notify", 
                PayloadTemplate = "{\"channel\": \"{{channel}}\", \"text\": \"{{text}}\"}"
            },
            new ActionRouteConfig 
            { 
                ActionType = "SEND_EMAIL", 
                TargetUrl = "http://localhost:5678/webhook/send-email", 
                PayloadTemplate = "{\"to\": \"{{email}}\", \"subject\": \"{{subject}}\", \"body\": \"{{template}}\"}"
            }
        );
    }
}
