using Microsoft.CodeAnalysis;
using VB = Microsoft.CodeAnalysis.VisualBasic;
using VBSyntax = Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace RoslynAnalyzer;

/// <summary>
/// Analyzes a single VB.NET file using Roslyn. Works with or without a semantic model.
/// Mirrors CSharpFileAnalyzer but for VB.NET syntax nodes.
/// </summary>
public static class VBFileAnalyzer
{
    public static FileAnalysis Analyze(SyntaxTree tree, SemanticModel? semanticModel, string relativePath)
    {
        var root = tree.GetRoot();
        var symbols = new List<SymbolInfo>();
        var edges = new List<Edge>();
        var sourceText = tree.GetText().ToString();
        var fileHash = "sha256:" + Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(sourceText)))[..12].ToLower();

        // Imports
        foreach (var imp in root.DescendantNodes().OfType<VBSyntax.ImportsStatementSyntax>())
        {
            foreach (var clause in imp.ImportsClauses)
            {
                var name = clause.ToString();
                symbols.Add(new SymbolInfo
                {
                    Id = $"{relativePath}::import::{name}",
                    Name = name,
                    Kind = "import",
                    File = relativePath,
                    Line = imp.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    Confidence = "high",
                    Source = "roslyn"
                });
            }
        }

        // Namespaces
        foreach (var ns in root.DescendantNodes().OfType<VBSyntax.NamespaceBlockSyntax>())
        {
            var name = ns.NamespaceStatement.Name.ToString();
            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{name}",
                Name = name,
                Kind = "namespace",
                File = relativePath,
                Line = ns.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = ns.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn"
            });
        }

        // Classes
        foreach (var cls in root.DescendantNodes().OfType<VBSyntax.ClassBlockSyntax>())
        {
            var classStmt = cls.ClassStatement;
            var className = classStmt.Identifier.Text;
            var classSymbol = semanticModel?.GetDeclaredSymbol(cls);
            var fqn = classSymbol?.ToDisplayString() ?? className;

            var baseTypes = new List<string>();
            var interfaces = new List<string>();

            foreach (var inherits in cls.DescendantNodes().OfType<VBSyntax.InheritsStatementSyntax>())
            {
                foreach (var t in inherits.Types)
                {
                    var typeName = t.ToString();
                    if (semanticModel != null)
                    {
                        var typeInfo = semanticModel.GetTypeInfo(t);
                        if (typeInfo.Type != null) typeName = typeInfo.Type.ToDisplayString();
                    }
                    baseTypes.Add(typeName);
                }
            }

            foreach (var impl in cls.DescendantNodes().OfType<VBSyntax.ImplementsStatementSyntax>())
            {
                foreach (var t in impl.Types)
                {
                    var typeName = t.ToString();
                    if (semanticModel != null)
                    {
                        var typeInfo = semanticModel.GetTypeInfo(t);
                        if (typeInfo.Type != null) typeName = typeInfo.Type.ToDisplayString();
                    }
                    interfaces.Add(typeName);
                }
            }

            var modifiers = classStmt.Modifiers.Select(m => m.Text).ToList();
            var members = cls.Members
                .Select(m => m switch
                {
                    VBSyntax.MethodBlockSyntax method => method.SubOrFunctionStatement.Identifier.Text,
                    VBSyntax.PropertyBlockSyntax prop => prop.PropertyStatement.Identifier.Text,
                    _ => null
                })
                .Where(n => n != null)
                .ToList();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{fqn}",
                Name = className,
                Kind = classStmt.Modifiers.Any(m => m.IsKind(VB.SyntaxKind.MustInheritKeyword)) ? "abstract_class" : "class",
                File = relativePath,
                Line = cls.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = cls.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                FullyQualifiedName = fqn,
                Modifiers = modifiers,
                Extends = baseTypes.Count > 0 ? baseTypes[0] : null,
                Implements = interfaces.Count > 0 ? interfaces : null,
                Members = members!,
                IsPartial = classStmt.Modifiers.Any(m => m.IsKind(VB.SyntaxKind.PartialKeyword)),
                IsAbstract = classStmt.Modifiers.Any(m => m.IsKind(VB.SyntaxKind.MustInheritKeyword))
            });

            foreach (var bt in baseTypes)
                edges.Add(new Edge { Source = fqn, Target = bt, Type = "INHERITS", Confidence = "high", File = relativePath });
            foreach (var iface in interfaces)
                edges.Add(new Edge { Source = fqn, Target = iface, Type = "IMPLEMENTS", Confidence = "high", File = relativePath });
        }

        // Interfaces
        foreach (var iface in root.DescendantNodes().OfType<VBSyntax.InterfaceBlockSyntax>())
        {
            var ifaceStmt = iface.InterfaceStatement;
            var ifaceName = ifaceStmt.Identifier.Text;
            var ifaceSymbol = semanticModel?.GetDeclaredSymbol(iface);
            var fqn = ifaceSymbol?.ToDisplayString() ?? ifaceName;

            var members = iface.Members
                .Select(m => m switch
                {
                    VBSyntax.MethodStatementSyntax method => method.Identifier.Text,
                    VBSyntax.PropertyStatementSyntax prop => prop.Identifier.Text,
                    _ => null
                })
                .Where(n => n != null)
                .ToList();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{fqn}",
                Name = ifaceName,
                Kind = "interface",
                File = relativePath,
                Line = iface.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = iface.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                FullyQualifiedName = fqn,
                Members = members!
            });
        }

        // Structures
        foreach (var str in root.DescendantNodes().OfType<VBSyntax.StructureBlockSyntax>())
        {
            var structStmt = str.StructureStatement;
            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{structStmt.Identifier.Text}",
                Name = structStmt.Identifier.Text,
                Kind = "struct",
                File = relativePath,
                Line = str.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = str.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn"
            });
        }

        // Enums
        foreach (var en in root.DescendantNodes().OfType<VBSyntax.EnumBlockSyntax>())
        {
            var enumStmt = en.EnumStatement;
            var enumMembers = en.Members
                .OfType<VBSyntax.EnumMemberDeclarationSyntax>()
                .Select(m => m.Identifier.Text)
                .ToList();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{enumStmt.Identifier.Text}",
                Name = enumStmt.Identifier.Text,
                Kind = "enum",
                File = relativePath,
                Line = en.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = en.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                Members = enumMembers
            });
        }

        // Modules (VB-specific)
        foreach (var mod in root.DescendantNodes().OfType<VBSyntax.ModuleBlockSyntax>())
        {
            var modStmt = mod.ModuleStatement;
            var members = mod.Members
                .Select(m => m switch
                {
                    VBSyntax.MethodBlockSyntax method => method.SubOrFunctionStatement.Identifier.Text,
                    VBSyntax.PropertyBlockSyntax prop => prop.PropertyStatement.Identifier.Text,
                    _ => null
                })
                .Where(n => n != null)
                .ToList();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{modStmt.Identifier.Text}",
                Name = modStmt.Identifier.Text,
                Kind = "module",
                File = relativePath,
                Line = mod.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = mod.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                Members = members!
            });
        }

        // Methods (Sub/Function)
        foreach (var method in root.DescendantNodes().OfType<VBSyntax.MethodBlockSyntax>())
        {
            var methodStmt = method.SubOrFunctionStatement;
            var methodName = methodStmt.Identifier.Text;
            var methodSymbol = semanticModel?.GetDeclaredSymbol(method);
            var containingType = method.Parent switch
            {
                VBSyntax.ClassBlockSyntax cb => cb.ClassStatement.Identifier.Text,
                VBSyntax.ModuleBlockSyntax mb => mb.ModuleStatement.Identifier.Text,
                VBSyntax.InterfaceBlockSyntax ib => ib.InterfaceStatement.Identifier.Text,
                _ => null
            };
            var fqn = methodSymbol?.ToDisplayString() ?? $"{containingType}.{methodName}";

            var parameters = methodStmt.ParameterList?.Parameters.Select(p =>
            {
                var pAsClause = p.AsClause as VBSyntax.SimpleAsClauseSyntax;
                var paramType = pAsClause?.Type.ToString() ?? "Object";
                if (semanticModel != null && pAsClause?.Type != null)
                {
                    var typeInfo = semanticModel.GetTypeInfo(pAsClause.Type);
                    if (typeInfo.Type != null) paramType = typeInfo.Type.ToDisplayString();
                }
                return new ParameterInfo { Name = p.Identifier.Identifier.Text, Type = paramType };
            }).ToList() ?? new List<ParameterInfo>();

            var returnType = "void";
            if (methodStmt is VBSyntax.MethodStatementSyntax ms)
            {
                var retAsClause = ms.AsClause as VBSyntax.SimpleAsClauseSyntax;
                if (retAsClause != null)
                {
                    returnType = retAsClause.Type.ToString();
                    if (semanticModel != null)
                    {
                        var typeInfo = semanticModel.GetTypeInfo(retAsClause.Type);
                        if (typeInfo.Type != null) returnType = typeInfo.Type.ToDisplayString();
                    }
                }
            }

            var calls = new List<string>();
            foreach (var invocation in method.DescendantNodes().OfType<VBSyntax.InvocationExpressionSyntax>())
            {
                if (semanticModel != null)
                {
                    var symbolInfo = semanticModel.GetSymbolInfo(invocation);
                    if (symbolInfo.Symbol != null)
                    {
                        calls.Add(symbolInfo.Symbol.ToDisplayString());
                        continue;
                    }
                }
                calls.Add(invocation.Expression.ToString());
            }

            var modifiers = methodStmt.Modifiers.Select(m => m.Text).ToList();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{fqn}",
                Name = methodName,
                Kind = methodStmt.SubOrFunctionKeyword.IsKind(VB.SyntaxKind.SubKeyword) ? "sub" : "function",
                File = relativePath,
                Line = method.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = method.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                FullyQualifiedName = fqn,
                ContainingType = containingType,
                Parameters = parameters,
                ReturnType = returnType,
                Modifiers = modifiers,
                IsAsync = modifiers.Contains("Async"),
                IsOverride = modifiers.Contains("Overrides"),
                IsVirtual = modifiers.Contains("Overridable"),
                Calls = calls.Distinct().Take(50).ToList()
            });

            foreach (var call in calls.Distinct().Take(50))
                edges.Add(new Edge
                {
                    Source = fqn,
                    Target = call,
                    Type = "CALLS",
                    Confidence = semanticModel != null ? "high" : "medium",
                    File = relativePath,
                    Line = method.GetLocation().GetLineSpan().StartLinePosition.Line + 1
                });
        }

        // Properties
        foreach (var prop in root.DescendantNodes().OfType<VBSyntax.PropertyBlockSyntax>())
        {
            var propStmt = prop.PropertyStatement;
            var containingType = prop.Parent switch
            {
                VBSyntax.ClassBlockSyntax cb => cb.ClassStatement.Identifier.Text,
                VBSyntax.ModuleBlockSyntax mb => mb.ModuleStatement.Identifier.Text,
                _ => null
            };
            var propAsClause = propStmt.AsClause as VBSyntax.SimpleAsClauseSyntax;
            var propType = propAsClause?.Type.ToString() ?? "Object";
            if (semanticModel != null && propAsClause?.Type != null)
            {
                var typeInfo = semanticModel.GetTypeInfo(propAsClause.Type);
                if (typeInfo.Type != null) propType = typeInfo.Type.ToDisplayString();
            }

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{containingType}.{propStmt.Identifier.Text}",
                Name = propStmt.Identifier.Text,
                Kind = "property",
                File = relativePath,
                Line = prop.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                ContainingType = containingType,
                PropertyType = propType,
                Modifiers = propStmt.Modifiers.Select(m => m.Text).ToList()
            });

            edges.Add(new Edge
            {
                Source = $"{containingType}.{propStmt.Identifier.Text}",
                Target = propType,
                Type = "USES_TYPE",
                Confidence = semanticModel != null ? "high" : "medium",
                File = relativePath
            });
        }

        // Constructors (Sub New)
        foreach (var ctor in root.DescendantNodes().OfType<VBSyntax.ConstructorBlockSyntax>())
        {
            var containingType = ctor.Parent switch
            {
                VBSyntax.ClassBlockSyntax cb => cb.ClassStatement.Identifier.Text,
                _ => null
            };

            var parameters = ctor.SubNewStatement.ParameterList?.Parameters.Select(p =>
            {
                var ctorPAsClause = p.AsClause as VBSyntax.SimpleAsClauseSyntax;
                var paramType = ctorPAsClause?.Type.ToString() ?? "Object";
                if (semanticModel != null && ctorPAsClause?.Type != null)
                {
                    var typeInfo = semanticModel.GetTypeInfo(ctorPAsClause.Type);
                    if (typeInfo.Type != null) paramType = typeInfo.Type.ToDisplayString();
                }
                return new ParameterInfo { Name = p.Identifier.Identifier.Text, Type = paramType };
            }).ToList() ?? new List<ParameterInfo>();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{containingType}..ctor",
                Name = containingType ?? "New",
                Kind = "constructor",
                File = relativePath,
                Line = ctor.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = ctor.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                ContainingType = containingType,
                Parameters = parameters
            });

            foreach (var p in parameters)
                edges.Add(new Edge
                {
                    Source = containingType ?? relativePath,
                    Target = p.Type,
                    Type = "INJECTS",
                    Confidence = "medium",
                    File = relativePath,
                    Line = ctor.GetLocation().GetLineSpan().StartLinePosition.Line + 1
                });
        }

        // Fields
        foreach (var field in root.DescendantNodes().OfType<VBSyntax.FieldDeclarationSyntax>())
        {
            var containingType = field.Parent switch
            {
                VBSyntax.ClassBlockSyntax cb => cb.ClassStatement.Identifier.Text,
                VBSyntax.ModuleBlockSyntax mb => mb.ModuleStatement.Identifier.Text,
                _ => null
            };

            foreach (var declarator in field.Declarators)
            {
                var fieldAsClause = declarator.AsClause as VBSyntax.SimpleAsClauseSyntax;
                var fieldType = fieldAsClause?.Type.ToString() ?? "Object";
                foreach (var name in declarator.Names)
                {
                    symbols.Add(new SymbolInfo
                    {
                        Id = $"{relativePath}::{containingType}.{name.Identifier.Text}",
                        Name = name.Identifier.Text,
                        Kind = "field",
                        File = relativePath,
                        Line = field.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                        Confidence = "high",
                        Source = "roslyn",
                        ContainingType = containingType,
                        PropertyType = fieldType,
                        Modifiers = field.Modifiers.Select(m => m.Text).ToList()
                    });
                }
            }
        }

        return new FileAnalysis
        {
            File = relativePath,
            FileHash = fileHash,
            Language = "vb.net",
            SymbolCount = symbols.Count,
            Symbols = symbols,
            Edges = edges,
            HasSemanticModel = semanticModel != null
        };
    }
}
