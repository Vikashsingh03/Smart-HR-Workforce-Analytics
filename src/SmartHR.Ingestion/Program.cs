using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SmartHR.Core;

const string CsvFileName = "WA_Fn-UseC_-HR-Employee-Attrition.csv";

var appDir = AppContext.BaseDirectory;
var arguments = args.ToList();
bool force = arguments.Remove("--force");
string? csvArg = arguments.FirstOrDefault();

string? csvPath;
if (csvArg != null)
{
    csvPath = Path.GetFullPath(csvArg);
}
else
{
    csvPath = FindSolutionFile(appDir, Path.Combine("data", CsvFileName));
    if (csvPath == null)
    {
        Console.WriteLine($"CSV file not found. Expected: data/{CsvFileName} under the solution root.");
        Console.WriteLine($"Searched upwards from: {appDir}");
        return 1;
    }
}
if (!File.Exists(csvPath))
{
    Console.WriteLine($"CSV file not found: {csvPath}");
    return 1;
}

// Connection: appsettings.json next to the API project if present, else this
// app's own appsettings.json, else the SQLite default.
string? apiSettings = FindSolutionFile(appDir, Path.Combine("src", "SmartHR.Api", "appsettings.json"));
string ownSettings = Path.Combine(appDir, "appsettings.json");
string? settingsPath = apiSettings ?? (File.Exists(ownSettings) ? ownSettings : null);

var configBuilder = new ConfigurationBuilder();
if (settingsPath != null)
{
    configBuilder.AddJsonFile(settingsPath, optional: false);
}
configBuilder.AddEnvironmentVariables();
var config = configBuilder.Build();

string provider = config["Database:Provider"] ?? "Sqlite";
string connectionString = provider.Equals("Postgres", StringComparison.OrdinalIgnoreCase)
    ? (config.GetConnectionString("Postgres") ?? "Host=localhost;Port=5432;Database=smarthr;Username=postgres;Password=postgres")
    : (config.GetConnectionString("Sqlite") ?? "Data Source=smarthr.db");

Console.WriteLine($"Provider: {provider}");
Console.WriteLine($"Database: {MaskPassword(connectionString)}");
Console.WriteLine($"Loading {csvPath} ...");

await using var db = HrDbContextFactory.Create(provider, connectionString);
await db.Database.EnsureCreatedAsync();

var result = await new CsvLoader().LoadAsync(csvPath, db, force);

Console.WriteLine($"Rows read: {result.RowsRead}");
if (result.AlreadyLoaded)
{
    Console.WriteLine($"Already loaded, skipping (checksum {result.Checksum})");
}
else
{
    Console.WriteLine($"Rows loaded: {result.RowsLoaded}");
    Console.WriteLine($"Rows quarantined: {result.RowsQuarantined}");
}
Console.WriteLine($"Done in {result.DurationMs} ms.");
return 0;

static string? FindSolutionFile(string startDir, string relativePath)
{
    var dir = new DirectoryInfo(startDir);
    while (dir != null)
    {
        string candidate = Path.Combine(dir.FullName, relativePath);
        if (File.Exists(candidate))
        {
            return candidate;
        }
        dir = dir.Parent;
    }
    return null;
}

static string MaskPassword(string connectionString) =>
    Regex.Replace(connectionString, @"(Password\s*=\s*)[^;]*", "$1***", RegexOptions.IgnoreCase);
