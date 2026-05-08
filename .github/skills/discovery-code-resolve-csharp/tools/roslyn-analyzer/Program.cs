using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.MSBuild;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace RoslynAnalyzer;

public static class Program
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public static async Task<int> Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: RoslynAnalyzer <mode> <path> [output-dir]");
            Console.Error.WriteLine("  mode: solution | project | file");
            Console.Error.WriteLine("  path: path to .sln, .csproj/.vbproj, or .cs/.vb file");
            Console.Error.WriteLine("  output-dir: optional output directory (default: .static-code-analysis/symbols)");
            return 1;
        }

        var mode = args[0].ToLower();
        var inputPath = Path.GetFullPath(args[1]);
        var outputDir = args.Length > 2 ? args[2] : null;

        if (!File.Exists(inputPath) && !Directory.Exists(inputPath))
        {
            Console.Error.WriteLine($"Error: Path not found: {inputPath}");
            return 1;
        }

        try
        {
            // Register MSBuild — required for workspace APIs
            if (mode is "solution" or "project")
            {
                if (!MSBuildLocator.IsRegistered)
                {
                    var instances = MSBuildLocator.QueryVisualStudioInstances().ToList();
                    if (instances.Count == 0)
                    {
                        Console.Error.WriteLine("Warning: No MSBuild instances found. Falling back to standalone file parsing.");
                        mode = "fallback-standalone";
                    }
                    else
                    {
                        MSBuildLocator.RegisterInstance(instances.OrderByDescending(i => i.Version).First());
                    }
                }
            }

            switch (mode)
            {
                case "solution":
                    await AnalyzeSolution(inputPath, outputDir);
                    break;
                case "project":
                    await AnalyzeProject(inputPath, outputDir);
                    break;
                case "file":
                    await AnalyzeSingleFile(inputPath, outputDir);
                    break;
                case "fallback-standalone":
                    await AnalyzeStandalone(inputPath, outputDir);
                    break;
                default:
                    Console.Error.WriteLine($"Unknown mode: {mode}");
                    return 1;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error: {ex.Message}");
            // Output partial results as error JSON
            var errorResult = new AnalysisResult
            {
                Error = ex.Message,
                Mode = mode,
                InputPath = inputPath
            };
            Console.WriteLine(JsonSerializer.Serialize(errorResult, JsonOpts));
            return 1;
        }

        return 0;
    }

    private static async Task AnalyzeSolution(string slnPath, string? outputDir)
    {
        Console.Error.WriteLine($"📂 Opening solution: {slnPath}");
        using var workspace = MSBuildWorkspace.Create();
        workspace.WorkspaceFailed += (_, e) =>
            Console.Error.WriteLine($"  ⚠️ Workspace: {e.Diagnostic.Message}");

        var solution = await workspace.OpenSolutionAsync(slnPath);
        Console.Error.WriteLine($"  Found {solution.Projects.Count()} projects");

        var allFileResults = new List<FileAnalysis>();
        var allEdges = new List<Edge>();
        var projectSummaries = new List<ProjectSummary>();

        foreach (var project in solution.Projects)
        {
            Console.Error.WriteLine($"  📦 Analyzing project: {project.Name} ({project.Language})");
            var (fileResults, edges) = await AnalyzeProjectInternal(project, slnPath);
            allFileResults.AddRange(fileResults);
            allEdges.AddRange(edges);
            projectSummaries.Add(new ProjectSummary
            {
                Name = project.Name,
                Language = project.Language,
                FilePath = project.FilePath,
                FileCount = fileResults.Count,
                SymbolCount = fileResults.Sum(f => f.Symbols.Count)
            });
        }

        // Emit results
        var result = new AnalysisResult
        {
            Mode = "solution",
            InputPath = slnPath,
            AnalyzedAt = DateTime.UtcNow.ToString("o"),
            Projects = projectSummaries,
            TotalFiles = allFileResults.Count,
            TotalSymbols = allFileResults.Sum(f => f.Symbols.Count),
            TotalEdges = allEdges.Count,
            Files = allFileResults,
            Edges = allEdges
        };

        if (outputDir != null)
        {
            await WriteOutputFiles(result, outputDir, slnPath);
        }
        else
        {
            Console.WriteLine(JsonSerializer.Serialize(result, JsonOpts));
        }
    }

    private static async Task AnalyzeProject(string projPath, string? outputDir)
    {
        Console.Error.WriteLine($"📦 Opening project: {projPath}");
        using var workspace = MSBuildWorkspace.Create();
        workspace.WorkspaceFailed += (_, e) =>
            Console.Error.WriteLine($"  ⚠️ Workspace: {e.Diagnostic.Message}");

        var project = await workspace.OpenProjectAsync(projPath);
        var (fileResults, edges) = await AnalyzeProjectInternal(project, projPath);

        var result = new AnalysisResult
        {
            Mode = "project",
            InputPath = projPath,
            AnalyzedAt = DateTime.UtcNow.ToString("o"),
            TotalFiles = fileResults.Count,
            TotalSymbols = fileResults.Sum(f => f.Symbols.Count),
            TotalEdges = edges.Count,
            Files = fileResults,
            Edges = edges
        };

        if (outputDir != null)
            await WriteOutputFiles(result, outputDir, projPath);
        else
            Console.WriteLine(JsonSerializer.Serialize(result, JsonOpts));
    }

    private static async Task<(List<FileAnalysis>, List<Edge>)> AnalyzeProjectInternal(
        Project project, string rootPath)
    {
        var compilation = await project.GetCompilationAsync();
        if (compilation == null)
        {
            Console.Error.WriteLine($"  ⚠️ Could not compile project: {project.Name}");
            return (new List<FileAnalysis>(), new List<Edge>());
        }

        // Report diagnostics summary
        var errors = compilation.GetDiagnostics()
            .Where(d => d.Severity == DiagnosticSeverity.Error).ToList();
        if (errors.Count > 0)
            Console.Error.WriteLine($"  ⚠️ {errors.Count} compilation errors (analysis will continue with available info)");

        var fileResults = new List<FileAnalysis>();
        var allEdges = new List<Edge>();
        var rootDir = Path.GetDirectoryName(rootPath) ?? ".";

        foreach (var doc in project.Documents)
        {
            if (doc.FilePath == null) continue;
            var syntaxTree = await doc.GetSyntaxTreeAsync();
            var semanticModel = compilation.GetSemanticModel(syntaxTree!);
            var relativePath = Path.GetRelativePath(rootDir, doc.FilePath);

            var fileAnalysis = project.Language switch
            {
                LanguageNames.CSharp => CSharpFileAnalyzer.Analyze(syntaxTree!, semanticModel, relativePath),
                LanguageNames.VisualBasic => VBFileAnalyzer.Analyze(syntaxTree!, semanticModel, relativePath),
                _ => null
            };

            if (fileAnalysis != null)
            {
                fileResults.Add(fileAnalysis);
                allEdges.AddRange(fileAnalysis.Edges);
            }
        }

        // Cross-file edges (DI, inheritance across files, etc.)
        var crossEdges = CrossFileAnalyzer.BuildCrossFileEdges(fileResults, compilation);
        allEdges.AddRange(crossEdges);

        return (fileResults, allEdges);
    }

    /// <summary>
    /// Fallback: analyze files standalone without MSBuild (no semantic model, syntax only)
    /// </summary>
    private static async Task AnalyzeStandalone(string inputPath, string? outputDir)
    {
        Console.Error.WriteLine($"📂 Standalone analysis (syntax only, no semantic model): {inputPath}");
        var files = new List<string>();
        
        if (inputPath.EndsWith(".sln", StringComparison.OrdinalIgnoreCase))
        {
            // Parse .sln to find project paths, then find source files
            var slnDir = Path.GetDirectoryName(inputPath)!;
            var slnContent = await File.ReadAllTextAsync(inputPath);
            foreach (var line in slnContent.Split('\n'))
            {
                if (!line.TrimStart().StartsWith("Project(")) continue;
                var parts = line.Split('"');
                if (parts.Length < 6) continue;
                var projRelPath = parts[5].Replace('\\', Path.DirectorySeparatorChar);
                var projAbsPath = Path.Combine(slnDir, projRelPath);
                if (File.Exists(projAbsPath))
                {
                    var projDir = Path.GetDirectoryName(projAbsPath)!;
                    files.AddRange(Directory.GetFiles(projDir, "*.cs", SearchOption.AllDirectories));
                    files.AddRange(Directory.GetFiles(projDir, "*.vb", SearchOption.AllDirectories));
                }
            }
        }
        else
        {
            var dir = Path.GetDirectoryName(inputPath) ?? ".";
            files.AddRange(Directory.GetFiles(dir, "*.cs", SearchOption.AllDirectories));
            files.AddRange(Directory.GetFiles(dir, "*.vb", SearchOption.AllDirectories));
        }

        files = files.Distinct()
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                     && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}"))
            .ToList();

        Console.Error.WriteLine($"  Found {files.Count} source files");
        var rootDir = Path.GetDirectoryName(inputPath) ?? ".";
        var allFileResults = new List<FileAnalysis>();

        foreach (var file in files)
        {
            var source = await File.ReadAllTextAsync(file);
            var relativePath = Path.GetRelativePath(rootDir, file);
            var ext = Path.GetExtension(file).ToLower();

            FileAnalysis? fa = null;
            if (ext == ".cs")
            {
                var tree = CSharpSyntaxTree.ParseText(source, path: file);
                fa = CSharpFileAnalyzer.Analyze(tree, semanticModel: null, relativePath);
            }
            else if (ext == ".vb")
            {
                var tree = Microsoft.CodeAnalysis.VisualBasic.SyntaxFactory.ParseSyntaxTree(source, path: file);
                fa = VBFileAnalyzer.Analyze(tree, semanticModel: null, relativePath);
            }

            if (fa != null) allFileResults.Add(fa);
        }

        var result = new AnalysisResult
        {
            Mode = "standalone",
            InputPath = inputPath,
            AnalyzedAt = DateTime.UtcNow.ToString("o"),
            TotalFiles = allFileResults.Count,
            TotalSymbols = allFileResults.Sum(f => f.Symbols.Count),
            TotalEdges = allFileResults.Sum(f => f.Edges.Count),
            Files = allFileResults,
            Edges = allFileResults.SelectMany(f => f.Edges).ToList()
        };

        if (outputDir != null)
            await WriteOutputFiles(result, outputDir, inputPath);
        else
            Console.WriteLine(JsonSerializer.Serialize(result, JsonOpts));
    }

    private static async Task AnalyzeSingleFile(string filePath, string? outputDir)
    {
        var source = await File.ReadAllTextAsync(filePath);
        var ext = Path.GetExtension(filePath).ToLower();
        var relativePath = Path.GetFileName(filePath);

        FileAnalysis? fa = null;
        if (ext == ".cs")
        {
            var tree = CSharpSyntaxTree.ParseText(source, path: filePath);
            fa = CSharpFileAnalyzer.Analyze(tree, semanticModel: null, relativePath);
        }
        else if (ext == ".vb")
        {
            var tree = Microsoft.CodeAnalysis.VisualBasic.SyntaxFactory.ParseSyntaxTree(source, path: filePath);
            fa = VBFileAnalyzer.Analyze(tree, semanticModel: null, relativePath);
        }

        if (fa != null)
            Console.WriteLine(JsonSerializer.Serialize(fa, JsonOpts));
    }

    private static async Task WriteOutputFiles(AnalysisResult result, string outputDir, string rootPath)
    {
        Directory.CreateDirectory(outputDir);

        // Write per-file symbol JSONs
        foreach (var file in result.Files)
        {
            var hash = Convert.ToHexString(
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes(file.File)))[..16].ToLower();
            var outPath = Path.Combine(outputDir, $"{hash}.json");
            var fileOutput = new
            {
                file = file.File,
                file_hash = file.FileHash,
                language = file.Language,
                category = "source",
                parsed_at = result.AnalyzedAt,
                parser = new { primary = "roslyn", resolver = (string?)null },
                symbols = file.Symbols
            };
            await File.WriteAllTextAsync(outPath, JsonSerializer.Serialize(fileOutput, JsonOpts));
        }

        // Write consolidated index.json
        var allSymbols = result.Files.SelectMany(f => f.Symbols).ToList();
        var byLanguage = result.Files
            .GroupBy(f => f.Language)
            .ToDictionary(
                g => g.Key,
                g => new { files = g.Count(), symbols = g.Sum(f => f.Symbols.Count) }
            );

        var index = new
        {
            version = 2,
            generated_at = result.AnalyzedAt,
            total_files = result.TotalFiles,
            total_symbols = result.TotalSymbols,
            by_source = new Dictionary<string, int> { ["roslyn"] = result.TotalSymbols },
            by_language = byLanguage,
            symbols = allSymbols.Select(s => new
            {
                id = s.Id,
                name = s.Name,
                kind = s.Kind,
                file = s.File,
                line = s.Line,
                category = "source",
                source = "roslyn",
                confidence = "high"
            })
        };
        await File.WriteAllTextAsync(
            Path.Combine(outputDir, "index.json"),
            JsonSerializer.Serialize(index, JsonOpts));

        // Write edges
        var graphDir = Path.Combine(Path.GetDirectoryName(outputDir)!, "graph");
        Directory.CreateDirectory(graphDir);
        await File.WriteAllTextAsync(
            Path.Combine(graphDir, "edges.json"),
            JsonSerializer.Serialize(new
            {
                version = 1,
                generated_at = result.AnalyzedAt,
                total_edges = result.Edges.Count,
                edges = result.Edges
            }, JsonOpts));

        // Summary to stderr
        Console.Error.WriteLine($"\n📊 Roslyn analysis complete");
        Console.Error.WriteLine($"├── Files: {result.TotalFiles}");
        Console.Error.WriteLine($"├── Symbols: {result.TotalSymbols}");
        Console.Error.WriteLine($"├── Edges: {result.TotalEdges}");
        Console.Error.WriteLine($"├── Languages: {string.Join(", ", byLanguage.Select(kv => $"{kv.Key} ({kv.Value.files} files)"))}");
        Console.Error.WriteLine($"└── Output: {outputDir}");

        // Also output JSON summary to stdout for pipeline consumption
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            status = "completed",
            total_files = result.TotalFiles,
            total_symbols = result.TotalSymbols,
            total_edges = result.TotalEdges,
            by_language = byLanguage
        }, JsonOpts));
    }
}
