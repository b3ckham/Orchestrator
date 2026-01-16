using AuditService.Data;
using Microsoft.EntityFrameworkCore;
using MassTransit;
using AuditService.Consumers;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "server=localhost;port=3306;database=Audit;user=root;password=password;";

builder.Services.AddDbContext<AuditContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

builder.Services.AddControllers();

// MassTransit
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<AuditConsumers>();

    x.UsingRabbitMq((context, cfg) =>
    {
        var rabbitMqSection = builder.Configuration.GetSection("RabbitMQ");
        cfg.Host(rabbitMqSection["Host"] ?? "localhost", "/", h =>
        {
            h.Username(rabbitMqSection["Username"] ?? "guest");
            h.Password(rabbitMqSection["Password"] ?? "guest");
        });

        // Unique queue for Audit Service
        cfg.ReceiveEndpoint("audit-service-logs", e =>
        {
            e.ConfigureConsumer<AuditConsumers>(context);
        });
    });
});


// Allow all CORS for internal dev convenience
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Ensure DB Created
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AuditContext>();
    db.Database.EnsureCreated();
}

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

app.Run();
