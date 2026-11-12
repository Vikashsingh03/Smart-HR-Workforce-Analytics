using SmartHR.Core;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// DbContext is created through the Core factory so the provider
// (Postgres or Sqlite) and connection string always come from config.
builder.Services.AddScoped(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var provider = config["Database:Provider"] ?? "Sqlite";
    var connectionString = provider.Equals("Postgres", StringComparison.OrdinalIgnoreCase)
        ? config.GetConnectionString("Postgres")
        : config.GetConnectionString("Sqlite");
    return HrDbContextFactory.Create(provider, connectionString!);
});

builder.Services.AddScoped<AnalyticsService>();
builder.Services.AddHttpClient<AiService>();
builder.Services.AddHttpClient<NlToSqlService>();

var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:4200" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("web", policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

builder.WebHost.UseUrls("http://localhost:5000");

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("web");
app.MapControllers();

app.Run();
