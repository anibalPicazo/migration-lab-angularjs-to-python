using System.Text.Json.Serialization;

namespace RoslynAnalyzer;

public class AnalysisResult
{
    public string? Error { get; set; }
    public string Mode { get; set; } = "";
    public string InputPath { get; set; } = "";
    public string? AnalyzedAt { get; set; }
    public List<ProjectSummary>? Projects { get; set; }
    public int TotalFiles { get; set; }
    public int TotalSymbols { get; set; }
    public int TotalEdges { get; set; }
    public List<FileAnalysis> Files { get; set; } = new();
    public List<Edge> Edges { get; set; } = new();
}

public class ProjectSummary
{
    public string Name { get; set; } = "";
    public string Language { get; set; } = "";
    public string? FilePath { get; set; }
    public int FileCount { get; set; }
    public int SymbolCount { get; set; }
}

public class FileAnalysis
{
    public string File { get; set; } = "";
    public string? FileHash { get; set; }
    public string Language { get; set; } = "";
    public int SymbolCount { get; set; }
    public bool HasSemanticModel { get; set; }
    public List<SymbolInfo> Symbols { get; set; } = new();
    [JsonIgnore]
    public List<Edge> Edges { get; set; } = new();
}

public class SymbolInfo
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "";
    public string File { get; set; } = "";
    public int Line { get; set; }
    public int? EndLine { get; set; }
    public string Confidence { get; set; } = "high";
    public string Source { get; set; } = "roslyn";
    public string? FullyQualifiedName { get; set; }
    public string? ContainingType { get; set; }
    public List<string>? Modifiers { get; set; }
    public string? Extends { get; set; }
    public List<string>? Implements { get; set; }
    public List<string>? Attributes { get; set; }
    public List<string>? Members { get; set; }
    public List<ParameterInfo>? Parameters { get; set; }
    public string? ReturnType { get; set; }
    public string? PropertyType { get; set; }
    public List<string>? Accessors { get; set; }
    public List<string>? Calls { get; set; }
    public bool? IsPartial { get; set; }
    public bool? IsStatic { get; set; }
    public bool? IsAbstract { get; set; }
    public bool? IsAsync { get; set; }
    public bool? IsOverride { get; set; }
    public bool? IsVirtual { get; set; }
    public bool? IsGeneric { get; set; }
    public List<string>? GenericParams { get; set; }
    public string? HttpMethod { get; set; }
    public string? RouteTemplate { get; set; }
    public string? DiMethod { get; set; }
    public string? DiServiceType { get; set; }
    public string? DiImplType { get; set; }
}

public class ParameterInfo
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
}

public class Edge
{
    public string Source { get; set; } = "";
    public string Target { get; set; } = "";
    public string Type { get; set; } = "";
    public string Confidence { get; set; } = "high";
    public string? File { get; set; }
    public string? TargetFile { get; set; }
    public int? Line { get; set; }
    public List<string>? Sources { get; set; }
}
