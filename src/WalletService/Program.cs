using WalletService.Data;
using WalletService.Consumers;
using MassTransit;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options => 
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(builder.Configuration["ServiceUrls:Frontend"] 
            ?? throw new InvalidOperationException("ServiceUrls:Frontend config missing"))
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddHttpClient();
builder.Services.AddHostedService<WalletService.Infrastructure.ServiceRegistration>(); // Service Discovery

// 1. Database Context (MySQL)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
Console.WriteLine($"[DEBUG] WalletService Environment: {builder.Environment.EnvironmentName}");
Console.WriteLine($"[DEBUG] WalletService Connection String: {connectionString}");

builder.Services.AddDbContext<WalletContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

// 2. MassTransit
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<MemberCreatedConsumer>();
    x.AddConsumer<MemberUpdatedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        var rabbitMqSection = builder.Configuration.GetSection("RabbitMQ");
        cfg.Host(rabbitMqSection["Host"] ?? throw new InvalidOperationException("RabbitMQ Host missing"), "/", h =>
        {
            h.Username(rabbitMqSection["Username"] ?? throw new InvalidOperationException("RabbitMQ Username missing"));
            h.Password(rabbitMqSection["Password"] ?? throw new InvalidOperationException("RabbitMQ Password missing"));
        });

        cfg.ReceiveEndpoint("wallet-service", e =>
        {
            e.ConfigureConsumer<MemberCreatedConsumer>(context);
            e.ConfigureConsumer<MemberUpdatedConsumer>(context);
        });
    });
});

var app = builder.Build();

// Auto-migrate
using (var scope = app.Services.CreateScope())
{
    var content = scope.ServiceProvider.GetRequiredService<WalletContext>();
    content.Database.EnsureCreated();
}

app.UseCors("AllowFrontend");
app.MapControllers();

app.Run();
