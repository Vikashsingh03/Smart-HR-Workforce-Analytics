using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using SmartHR.Core.Dtos;

namespace SmartHR.Core;

/// <summary>
/// Explains analytical figures in plain English. With a Gemini API key it
/// calls gemini-2.0-flash; without a key (or if the call fails) it builds an
/// honest explanation from the given facts only. It never invents numbers:
/// every figure in the output comes from the facts passed in.
/// </summary>
public class AiService
{
    private const string GeminiUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    private readonly HttpClient _http;
    private readonly IConfiguration _config;

    public AiService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _config = config;
    }

    public async Task<AiExplainResult> ExplainAsync(
        string title, IEnumerable<(string Label, object Value)> facts)
    {
        var factList = facts.ToList();
        string? apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            apiKey = _config["Gemini:ApiKey"];
        }

        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            try
            {
                var result = await ExplainWithGeminiAsync(title, factList, apiKey);
                if (result != null)
                {
                    return result;
                }
            }
            catch
            {
                // Any failure falls through to the rule-based fallback below.
            }
        }

        return BuildFallback(title, factList);
    }

    private async Task<AiExplainResult?> ExplainWithGeminiAsync(
        string title, List<(string Label, object Value)> facts, string apiKey)
    {
        string factText = string.Join("\n", facts.Select(f => $"- {f.Label}: {f.Value}"));
        string prompt =
            "You are an HR analytics assistant. Explain these figures in plain English " +
            "in 3-4 sentences and suggest one concrete HR action. Use ONLY the figures " +
            "below; do not invent any numbers.\n\n" +
            $"Title: {title}\nFigures:\n{factText}\n\n" +
            "Reply in exactly this format:\nExplanation: <your explanation>\nAction: <one suggested action>";

        using var request = new HttpRequestMessage(
            HttpMethod.Post, $"{GeminiUrl}?key={Uri.EscapeDataString(apiKey)}");
        request.Content = JsonContent.Create(new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            }
        });

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        using var response = await _http.SendAsync(request, cts.Token);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        string json = await response.Content.ReadAsStringAsync(cts.Token);
        using var doc = JsonDocument.Parse(json);
        string? text = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        string explanation = text.Trim();
        string action = "Review the figures and pick the group with the highest attrition for stay interviews.";
        const string marker = "Action:";
        int index = text.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (index >= 0)
        {
            explanation = text[..index]
                .Replace("Explanation:", "", StringComparison.OrdinalIgnoreCase).Trim();
            action = text[(index + marker.Length)..].Trim();
        }
        else
        {
            explanation = text.Replace("Explanation:", "", StringComparison.OrdinalIgnoreCase).Trim();
        }
        if (string.IsNullOrWhiteSpace(explanation))
        {
            return null;
        }
        return new AiExplainResult { Explanation = explanation, Action = action, Source = "gemini" };
    }

    private static AiExplainResult BuildFallback(string title, List<(string Label, object Value)> facts)
    {
        (string Label, double Value)? highest = null;
        foreach (var fact in facts)
        {
            string? raw = Convert.ToString(fact.Value, CultureInfo.InvariantCulture);
            if (raw != null && double.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out double number))
            {
                if (highest == null || number > highest.Value.Value)
                {
                    highest = (fact.Label, number);
                }
            }
        }

        string factText = facts.Count == 0
            ? "no figures were provided"
            : string.Join("; ", facts.Select(f => $"{f.Label}: {f.Value}"));

        string explanation = highest != null
            ? $"{title}. The figures show: {factText}. The highest figure is {highest.Value.Label} at {highest.Value.Value}, which is where the pattern is strongest."
            : $"{title}. The figures show: {factText}.";

        string action = highest != null
            ? $"Start with {highest.Value.Label}: run stay interviews there, check overtime and pay against similar roles, and review the figures again next month."
            : "Review the underlying figures first, then pick the group with the highest attrition and run stay interviews there.";

        return new AiExplainResult { Explanation = explanation, Action = action, Source = "fallback" };
    }
}
