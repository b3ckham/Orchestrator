using Microsoft.EntityFrameworkCore;
using MemberService.Data;
using MassTransit;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<MemberContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

builder.Services.AddControllers()
    .AddJsonOptions(options => 
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// MassTransit config
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<MemberService.Consumers.WalletUpdatedConsumer>();
    x.AddConsumer<MemberService.Consumers.ComplianceStatusChangedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        var rabbitMqSection = builder.Configuration.GetSection("RabbitMQ");
        cfg.Host(rabbitMqSection["Host"] ?? throw new InvalidOperationException("RabbitMQ Host missing"), "/", h =>
        {
            h.Username(rabbitMqSection["Username"] ?? throw new InvalidOperationException("RabbitMQ Username missing"));
            h.Password(rabbitMqSection["Password"] ?? throw new InvalidOperationException("RabbitMQ Password missing"));
        });

        cfg.ReceiveEndpoint("member-wallet-events", e =>
        {
            e.ConfigureConsumer<MemberService.Consumers.WalletUpdatedConsumer>(context);
            e.ConfigureConsumer<MemberService.Consumers.ComplianceStatusChangedConsumer>(context);
        });
    });
});

builder.Services.AddHttpClient();
builder.Services.AddHostedService<MemberService.Infrastructure.ServiceRegistration>(); // Service Discovery

builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen();

var app = builder.Build();

    // app.UseHttpsRedirection(); // Disable for local dev to avoid certificate issues

    app.UseCors(x => x
        .AllowAnyMethod()
        .AllowAnyHeader()
        .WithOrigins(builder.Configuration["ServiceUrls:Frontend"] ?? throw new InvalidOperationException("ServiceUrls:Frontend missing"))
        .AllowCredentials());

app.UseAuthorization();

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MemberContext>();
    db.Database.EnsureCreated();
}

app.Run();
