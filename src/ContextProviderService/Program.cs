using ContextProviderService.Services;
using MassTransit;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000") // Allow Vite/React default ports
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient();
builder.Services.AddScoped<ContextAggregator>();
builder.Services.AddTransient<ContextRegistryService>();
builder.Services.AddSingleton<WatermarkService>();

// Redis
builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(sp => 
{
    var config = builder.Configuration.GetConnectionString("Redis") ?? "localhost";
    return StackExchange.Redis.ConnectionMultiplexer.Connect(config);
});

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<ReadModelUpdater>();
    x.UsingRabbitMq((context, cfg) =>
    {
        var rabbitHost = builder.Configuration["ServiceUrls:RabbitMqMgr"]?.Replace("http://", "").Replace(":15672/api", "") ?? "localhost";
        // Or better: use specific RabbitMQ section if available.
        // Falling back to "localhost" for dev simplicity if config missing.
        
        cfg.Host(builder.Configuration["RabbitMQ:Host"] ?? "localhost", "/", h => {
            h.Username(builder.Configuration["RabbitMQ:Username"] ?? "guest");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? "guest");
        });
        
        cfg.ConfigureEndpoints(context);
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.MapControllers();

app.MapGet("/", () => "Context Provider Service is Running. Go to /swagger to view APIs.");

app.Run();
