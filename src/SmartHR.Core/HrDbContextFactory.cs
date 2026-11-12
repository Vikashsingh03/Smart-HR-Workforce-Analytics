using Microsoft.EntityFrameworkCore;

namespace SmartHR.Core;

/// <summary>
/// Creates an HrDbContext for the configured provider. Both providers use
/// the same schema; nothing in the calling code is provider-specific.
/// </summary>
public static class HrDbContextFactory
{
    public static HrDbContext Create(string provider, string connectionString)
    {
        var options = new DbContextOptionsBuilder<HrDbContext>();
        if (string.Equals(provider, "Postgres", StringComparison.OrdinalIgnoreCase))
        {
            options.UseNpgsql(connectionString);
        }
        else if (string.Equals(provider, "Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            options.UseSqlite(ResolveSqlitePath(connectionString));
        }
        else
        {
            throw new ArgumentException(
                $"Unknown database provider '{provider}'. Use 'Postgres' or 'Sqlite'.",
                nameof(provider));
        }
        return new HrDbContext(options.Options);
    }

    /// <summary>
    /// A relative SQLite file (e.g. "Data Source=smarthr.db") must resolve to
    /// ONE shared database no matter which folder the process started from:
    /// "dotnet run --project" starts the app in the project folder, while the
    /// ingestion run starts in the solution folder. Walk up from the app
    /// directory until a folder holding SmartHR.sln is found and put the
    /// database there. Absolute paths are left untouched.
    /// </summary>
    private static string ResolveSqlitePath(string connectionString)
    {
        const string prefix = "Data Source=";
        var idx = connectionString.IndexOf(prefix, StringComparison.OrdinalIgnoreCase);
        if (idx < 0)
        {
            return connectionString;
        }

        var after = connectionString[(idx + prefix.Length)..].Trim();
        var sep = after.IndexOf(';');
        var filePart = (sep >= 0 ? after[..sep] : after).Trim().Trim('"');
        var remainder = sep >= 0 ? after[sep..] : string.Empty;
        if (string.IsNullOrEmpty(filePart) || Path.IsPathRooted(filePart))
        {
            return connectionString;
        }

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "SmartHR.sln")))
            {
                var resolved = Path.Combine(dir.FullName, filePart);
                return connectionString[..(idx + prefix.Length)] + resolved + remainder;
            }
            dir = dir.Parent;
        }

        return connectionString;
    }
}
