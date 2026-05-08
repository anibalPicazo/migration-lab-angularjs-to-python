using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace RoslynAnalyzer;

/// <summary>
/// Analyzes a single C# file using Roslyn. Works with or without a semantic model.
/// With semantic model: full type resolution, DI wiring, inheritance chains.
/// Without semantic model: syntax-only structural extraction (still better than Tree-sitter).
/// </summary>
public static class CSharpFileAnalyzer
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

        // Usings
        foreach (var u in root.DescendantNodes().OfType<UsingDirectiveSyntax>())
        {
            var name = u.Name?.ToString() ?? u.ToString();
            var kind = u.StaticKeyword.IsKind(SyntaxKind.StaticKeyword) ? "static_using" : "using";
            if (u.GlobalKeyword.IsKind(SyntaxKind.GlobalKeyword)) kind = "global_using";
            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::using::{name}",
                Name = name,
                Kind = kind,
                File = relativePath,
                Line = u.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn"
            });
        }

        // Namespaces
        foreach (var ns in root.DescendantNodes().OfType<BaseNamespaceDeclarationSyntax>())
        {
            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{ns.Name}",
                Name = ns.Name.ToString(),
                Kind = "namespace",
                File = relativePath,
                Line = ns.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = ns.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn"
            });
        }

        // Classes
        foreach (var cls in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
        {
            var classSymbol = semanticModel?.GetDeclaredSymbol(cls);
            var fqn = classSymbol?.ToDisplayString() ?? cls.Identifier.Text;
            var baseTypes = new List<string>();
            var interfaces = new List<string>();

            if (cls.BaseList != null)
            {
                foreach (var bt in cls.BaseList.Types)
                {
                    var typeName = bt.Type.ToString();
                    if (semanticModel != null)
                    {
                        var typeInfo = semanticModel.GetTypeInfo(bt.Type);
                        if (typeInfo.Type != null)
                        {
                            typeName = typeInfo.Type.ToDisplayString();
                            if (typeInfo.Type.TypeKind == TypeKind.Interface)
                                interfaces.Add(typeName);
                            else
                                baseTypes.Add(typeName);
                            continue;
                        }
                    }
                    // Heuristic: interfaces start with I
                    if (typeName.StartsWith("I") && typeName.Length > 1 && char.IsUpper(typeName[1]))
                        interfaces.Add(typeName);
                    else
                        baseTypes.Add(typeName);
                }
            }

            var modifiers = cls.Modifiers.Select(m => m.Text).ToList();
            var attributes = cls.AttributeLists
                .SelectMany(al => al.Attributes)
                .Select(a => a.Name.ToString())
                .ToList();

            var members = cls.Members
                .Select(m => m switch
                {
                    MethodDeclarationSyntax method => method.Identifier.Text,
                    PropertyDeclarationSyntax prop => prop.Identifier.Text,
                    FieldDeclarationSyntax field => field.Declaration.Variables.First().Identifier.Text,
                    _ => null
                })
                .Where(n => n != null)
                .ToList();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{fqn}",
                Name = cls.Identifier.Text,
                Kind = cls.Modifiers.Any(m => m.IsKind(SyntaxKind.AbstractKeyword)) ? "abstract_class" : "class",
                File = relativePath,
                Line = cls.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = cls.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                FullyQualifiedName = fqn,
                Modifiers = modifiers,
                Extends = baseTypes.Count > 0 ? baseTypes[0] : null,
                Implements = interfaces.Count > 0 ? interfaces : null,
                Attributes = attributes.Count > 0 ? attributes : null,
                Members = members!,
                IsPartial = cls.Modifiers.Any(m => m.IsKind(SyntaxKind.PartialKeyword)),
                IsStatic = cls.Modifiers.Any(m => m.IsKind(SyntaxKind.StaticKeyword)),
                IsAbstract = cls.Modifiers.Any(m => m.IsKind(SyntaxKind.AbstractKeyword)),
                IsGeneric = cls.TypeParameterList?.Parameters.Count > 0,
                GenericParams = cls.TypeParameterList?.Parameters.Select(p => p.Identifier.Text).ToList()
            });

            // Edges: inheritance
            foreach (var bt in baseTypes)
                edges.Add(new Edge { Source = fqn, Target = bt, Type = "INHERITS", Confidence = "high", File = relativePath });
            foreach (var iface in interfaces)
                edges.Add(new Edge { Source = fqn, Target = iface, Type = "IMPLEMENTS", Confidence = "high", File = relativePath });
        }

        // Interfaces
        foreach (var iface in root.DescendantNodes().OfType<InterfaceDeclarationSyntax>())
        {
            var ifaceSymbol = semanticModel?.GetDeclaredSymbol(iface);
            var fqn = ifaceSymbol?.ToDisplayString() ?? iface.Identifier.Text;
            var baseInterfaces = iface.BaseList?.Types.Select(t => t.Type.ToString()).ToList();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{fqn}",
                Name = iface.Identifier.Text,
                Kind = "interface",
                File = relativePath,
                Line = iface.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = iface.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                FullyQualifiedName = fqn,
                Implements = baseInterfaces,
                Members = iface.Members
                    .Select(m => m switch
                    {
                        MethodDeclarationSyntax method => method.Identifier.Text,
                        PropertyDeclarationSyntax prop => prop.Identifier.Text,
                        _ => null
                    })
                    .Where(n => n != null)
                    .ToList()!
            });
        }

        // Structs
        foreach (var str in root.DescendantNodes().OfType<StructDeclarationSyntax>())
        {
            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{str.Identifier.Text}",
                Name = str.Identifier.Text,
                Kind = "struct",
                File = relativePath,
                Line = str.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = str.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn"
            });
        }

        // Enums
        foreach (var en in root.DescendantNodes().OfType<EnumDeclarationSyntax>())
        {
            var enumMembers = en.Members.Select(m => m.Identifier.Text).ToList();
            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{en.Identifier.Text}",
                Name = en.Identifier.Text,
                Kind = "enum",
                File = relativePath,
                Line = en.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = en.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                Members = enumMembers
            });
        }

        // Records
        foreach (var rec in root.DescendantNodes().OfType<RecordDeclarationSyntax>())
        {
            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{rec.Identifier.Text}",
                Name = rec.Identifier.Text,
                Kind = "record",
                File = relativePath,
                Line = rec.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = rec.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                IsGeneric = rec.TypeParameterList?.Parameters.Count > 0
            });
        }

        // Methods
        foreach (var method in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
        {
            var methodSymbol = semanticModel?.GetDeclaredSymbol(method);
            var containingType = method.Parent is TypeDeclarationSyntax parent ? parent.Identifier.Text : null;
            var fqn = methodSymbol?.ToDisplayString() ?? $"{containingType}.{method.Identifier.Text}";

            var parameters = method.ParameterList.Parameters.Select(p =>
            {
                var paramType = p.Type?.ToString() ?? "unknown";
                if (semanticModel != null && p.Type != null)
                {
                    var typeInfo = semanticModel.GetTypeInfo(p.Type);
                    if (typeInfo.Type != null)
                        paramType = typeInfo.Type.ToDisplayString();
                }
                return new ParameterInfo { Name = p.Identifier.Text, Type = paramType };
            }).ToList();

            var returnType = method.ReturnType.ToString();
            if (semanticModel != null)
            {
                var typeInfo = semanticModel.GetTypeInfo(method.ReturnType);
                if (typeInfo.Type != null)
                    returnType = typeInfo.Type.ToDisplayString();
            }

            var attributes = method.AttributeLists
                .SelectMany(al => al.Attributes)
                .Select(a => a.Name.ToString())
                .ToList();

            // Detect HTTP method attributes for ASP.NET
            string? httpMethod = null;
            string? routeTemplate = null;
            foreach (var attr in method.AttributeLists.SelectMany(al => al.Attributes))
            {
                var attrName = attr.Name.ToString();
                if (attrName is "HttpGet" or "HttpPost" or "HttpPut" or "HttpDelete" or "HttpPatch")
                {
                    httpMethod = attrName.Replace("Http", "").ToUpper();
                    routeTemplate = attr.ArgumentList?.Arguments.FirstOrDefault()?.ToString()?.Trim('"');
                }
                if (attrName == "Route")
                    routeTemplate = attr.ArgumentList?.Arguments.FirstOrDefault()?.ToString()?.Trim('"');
            }

            var calls = new List<string>();
            foreach (var invocation in method.DescendantNodes().OfType<InvocationExpressionSyntax>())
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

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{fqn}",
                Name = method.Identifier.Text,
                Kind = "method",
                File = relativePath,
                Line = method.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = method.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                FullyQualifiedName = fqn,
                ContainingType = containingType,
                Parameters = parameters,
                ReturnType = returnType,
                Modifiers = method.Modifiers.Select(m => m.Text).ToList(),
                Attributes = attributes.Count > 0 ? attributes : null,
                HttpMethod = httpMethod,
                RouteTemplate = routeTemplate,
                IsAsync = method.Modifiers.Any(m => m.IsKind(SyntaxKind.AsyncKeyword)),
                IsOverride = method.Modifiers.Any(m => m.IsKind(SyntaxKind.OverrideKeyword)),
                IsVirtual = method.Modifiers.Any(m => m.IsKind(SyntaxKind.VirtualKeyword)),
                Calls = calls.Distinct().Take(50).ToList()
            });

            // Edges: method calls
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
        foreach (var prop in root.DescendantNodes().OfType<PropertyDeclarationSyntax>())
        {
            var propSymbol = semanticModel?.GetDeclaredSymbol(prop);
            var containingType = prop.Parent is TypeDeclarationSyntax pt ? pt.Identifier.Text : null;
            var propType = prop.Type.ToString();
            if (semanticModel != null)
            {
                var typeInfo = semanticModel.GetTypeInfo(prop.Type);
                if (typeInfo.Type != null) propType = typeInfo.Type.ToDisplayString();
            }

            var accessors = prop.AccessorList?.Accessors
                .Select(a => a.Keyword.Text).ToList();

            var attributes = prop.AttributeLists
                .SelectMany(al => al.Attributes)
                .Select(a => a.Name.ToString())
                .ToList();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{containingType}.{prop.Identifier.Text}",
                Name = prop.Identifier.Text,
                Kind = "property",
                File = relativePath,
                Line = prop.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                ContainingType = containingType,
                PropertyType = propType,
                Accessors = accessors,
                Attributes = attributes.Count > 0 ? attributes : null
            });

            // Edge: type usage
            edges.Add(new Edge
            {
                Source = $"{containingType}.{prop.Identifier.Text}",
                Target = propType,
                Type = "USES_TYPE",
                Confidence = semanticModel != null ? "high" : "medium",
                File = relativePath
            });
        }

        // Constructors — crucial for DI analysis
        foreach (var ctor in root.DescendantNodes().OfType<ConstructorDeclarationSyntax>())
        {
            var containingType = ctor.Parent is TypeDeclarationSyntax ct ? ct.Identifier.Text : null;
            var parameters = ctor.ParameterList.Parameters.Select(p =>
            {
                var paramType = p.Type?.ToString() ?? "unknown";
                if (semanticModel != null && p.Type != null)
                {
                    var typeInfo = semanticModel.GetTypeInfo(p.Type);
                    if (typeInfo.Type != null)
                        paramType = typeInfo.Type.ToDisplayString();
                }
                return new ParameterInfo { Name = p.Identifier.Text, Type = paramType };
            }).ToList();

            symbols.Add(new SymbolInfo
            {
                Id = $"{relativePath}::{containingType}..ctor",
                Name = $"{containingType}",
                Kind = "constructor",
                File = relativePath,
                Line = ctor.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                EndLine = ctor.GetLocation().GetLineSpan().EndLinePosition.Line + 1,
                Confidence = "high",
                Source = "roslyn",
                ContainingType = containingType,
                Parameters = parameters
            });

            // Each constructor parameter in ASP.NET is likely a DI injection
            foreach (var p in parameters)
            {
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
        }

        // Fields
        foreach (var field in root.DescendantNodes().OfType<FieldDeclarationSyntax>())
        {
            var containingType = field.Parent is TypeDeclarationSyntax ft ? ft.Identifier.Text : null;
            var fieldType = field.Declaration.Type.ToString();
            foreach (var variable in field.Declaration.Variables)
            {
                symbols.Add(new SymbolInfo
                {
                    Id = $"{relativePath}::{containingType}.{variable.Identifier.Text}",
                    Name = variable.Identifier.Text,
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

        // DI registrations: services.AddScoped<IFoo, Foo>(), etc.
        foreach (var invocation in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
            var expr = invocation.Expression.ToString();
            if (!IsDiRegistration(expr)) continue;

            var diMethod = expr.Split('.').Last();
            var typeArgs = invocation.Expression
                .DescendantNodes()
                .OfType<TypeArgumentListSyntax>()
                .FirstOrDefault();

            if (typeArgs?.Arguments.Count >= 2)
            {
                var serviceType = typeArgs.Arguments[0].ToString();
                var implType = typeArgs.Arguments[1].ToString();

                if (semanticModel != null)
                {
                    var svcTypeInfo = semanticModel.GetTypeInfo(typeArgs.Arguments[0]);
                    if (svcTypeInfo.Type != null) serviceType = svcTypeInfo.Type.ToDisplayString();
                    var implTypeInfo = semanticModel.GetTypeInfo(typeArgs.Arguments[1]);
                    if (implTypeInfo.Type != null) implType = implTypeInfo.Type.ToDisplayString();
                }

                symbols.Add(new SymbolInfo
                {
                    Id = $"{relativePath}::DI::{serviceType}->{implType}",
                    Name = $"{serviceType} -> {implType}",
                    Kind = "di_registration",
                    File = relativePath,
                    Line = invocation.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    Confidence = "high",
                    Source = "roslyn",
                    DiMethod = diMethod,
                    DiServiceType = serviceType,
                    DiImplType = implType
                });

                edges.Add(new Edge
                {
                    Source = serviceType,
                    Target = implType,
                    Type = "DI_REGISTERS",
                    Confidence = "high",
                    File = relativePath,
                    Line = invocation.GetLocation().GetLineSpan().StartLinePosition.Line + 1
                });
            }
            else if (typeArgs?.Arguments.Count == 1)
            {
                var serviceType = typeArgs.Arguments[0].ToString();
                symbols.Add(new SymbolInfo
                {
                    Id = $"{relativePath}::DI::{serviceType}",
                    Name = serviceType,
                    Kind = "di_registration",
                    File = relativePath,
                    Line = invocation.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    Confidence = "high",
                    Source = "roslyn",
                    DiMethod = diMethod,
                    DiServiceType = serviceType,
                    DiImplType = serviceType
                });
            }
        }

        // Attributes at class level for ASP.NET controller detection
        foreach (var cls in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
        {
            var attrNames = cls.AttributeLists
                .SelectMany(al => al.Attributes)
                .Select(a => a.Name.ToString())
                .ToList();

            if (attrNames.Any(a => a is "ApiController" or "Controller"))
            {
                var routeAttr = cls.AttributeLists
                    .SelectMany(al => al.Attributes)
                    .FirstOrDefault(a => a.Name.ToString() == "Route");
                var routeTemplate = routeAttr?.ArgumentList?.Arguments.FirstOrDefault()?.ToString()?.Trim('"');

                symbols.Add(new SymbolInfo
                {
                    Id = $"{relativePath}::Controller::{cls.Identifier.Text}",
                    Name = cls.Identifier.Text,
                    Kind = "api_controller",
                    File = relativePath,
                    Line = cls.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    Confidence = "high",
                    Source = "roslyn",
                    RouteTemplate = routeTemplate
                });
            }
        }

        // DbSet<T> properties for EF detection
        foreach (var prop in root.DescendantNodes().OfType<PropertyDeclarationSyntax>())
        {
            var typeName = prop.Type.ToString();
            if (typeName.StartsWith("DbSet<"))
            {
                var entityType = typeName.Replace("DbSet<", "").TrimEnd('>');
                symbols.Add(new SymbolInfo
                {
                    Id = $"{relativePath}::DbSet::{entityType}",
                    Name = entityType,
                    Kind = "ef_entity",
                    File = relativePath,
                    Line = prop.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    Confidence = "high",
                    Source = "roslyn"
                });
            }
        }

        return new FileAnalysis
        {
            File = relativePath,
            FileHash = fileHash,
            Language = "csharp",
            SymbolCount = symbols.Count,
            Symbols = symbols,
            Edges = edges,
            HasSemanticModel = semanticModel != null
        };
    }

    private static bool IsDiRegistration(string expr)
    {
        var diMethods = new[] {
            "AddScoped", "AddTransient", "AddSingleton",
            "AddHostedService", "AddDbContext", "AddOptions",
            "AddHttpClient"
        };
        return diMethods.Any(m => expr.Contains(m));
    }
}
