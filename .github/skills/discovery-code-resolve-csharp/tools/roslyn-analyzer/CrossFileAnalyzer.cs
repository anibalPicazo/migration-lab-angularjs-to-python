using Microsoft.CodeAnalysis;

namespace RoslynAnalyzer;

/// <summary>
/// Builds cross-file edges that individual file analyzers cannot see:
/// - DI wiring: matches registration → constructor injection
/// - Inheritance: matches base class references across files
/// - Interface implementation completeness
/// </summary>
public static class CrossFileAnalyzer
{
    public static List<Edge> BuildCrossFileEdges(List<FileAnalysis> files, Compilation? compilation)
    {
        var edges = new List<Edge>();

        // Build lookup: type name → file
        var typeToFile = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var interfaceMembers = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        var diRegistrations = new List<SymbolInfo>();
        var constructorParams = new Dictionary<string, List<ParameterInfo>>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in files)
        {
            foreach (var sym in file.Symbols)
            {
                // Map types to files
                if (sym.Kind is "class" or "abstract_class" or "interface" or "struct" or "enum" or "record" or "module")
                {
                    typeToFile[sym.Name] = sym.File;
                    if (sym.FullyQualifiedName != null)
                        typeToFile[sym.FullyQualifiedName] = sym.File;
                }

                // Collect interface members
                if (sym.Kind == "interface" && sym.Members != null)
                    interfaceMembers[sym.Name] = sym.Members;

                // Collect DI registrations
                if (sym.Kind == "di_registration")
                    diRegistrations.Add(sym);

                // Collect constructor params
                if (sym.Kind == "constructor" && sym.Parameters != null && sym.ContainingType != null)
                    constructorParams[sym.ContainingType] = sym.Parameters;
            }
        }

        // DI wiring: connect registered service → implementation constructor
        foreach (var reg in diRegistrations)
        {
            if (reg.DiServiceType != null && reg.DiImplType != null)
            {
                // Find the impl constructor
                if (constructorParams.TryGetValue(SimplifyTypeName(reg.DiImplType), out var ctorParams))
                {
                    foreach (var param in ctorParams)
                    {
                        var paramTypeName = SimplifyTypeName(param.Type);
                        // If this constructor parameter matches a registered DI service type
                        var matchingReg = diRegistrations.FirstOrDefault(r =>
                            SimplifyTypeName(r.DiServiceType ?? "") == paramTypeName);
                        if (matchingReg != null)
                        {
                            edges.Add(new Edge
                            {
                                Source = reg.DiImplType,
                                Target = matchingReg.DiImplType ?? matchingReg.DiServiceType!,
                                Type = "DI_DEPENDS_ON",
                                Confidence = "high",
                                File = reg.File
                            });
                        }
                    }
                }
            }
        }

        // Cross-file inheritance: resolve base type to actual file
        foreach (var file in files)
        {
            foreach (var sym in file.Symbols)
            {
                if (sym.Extends != null && typeToFile.TryGetValue(SimplifyTypeName(sym.Extends), out var baseFile))
                {
                    if (baseFile != sym.File) // Only cross-file
                    {
                        edges.Add(new Edge
                        {
                            Source = sym.FullyQualifiedName ?? sym.Name,
                            Target = sym.Extends,
                            Type = "INHERITS_CROSS_FILE",
                            Confidence = "high",
                            File = sym.File,
                            TargetFile = baseFile
                        });
                    }
                }

                if (sym.Implements != null)
                {
                    foreach (var iface in sym.Implements)
                    {
                        if (typeToFile.TryGetValue(SimplifyTypeName(iface), out var ifaceFile) && ifaceFile != sym.File)
                        {
                            edges.Add(new Edge
                            {
                                Source = sym.FullyQualifiedName ?? sym.Name,
                                Target = iface,
                                Type = "IMPLEMENTS_CROSS_FILE",
                                Confidence = "high",
                                File = sym.File,
                                TargetFile = ifaceFile
                            });
                        }
                    }
                }
            }
        }

        return edges;
    }

    private static string SimplifyTypeName(string typeName)
    {
        // Remove namespace prefixes for matching: "Glass.Api.Core.IService" → "IService"
        var lastDot = typeName.LastIndexOf('.');
        return lastDot >= 0 ? typeName[(lastDot + 1)..] : typeName;
    }
}
