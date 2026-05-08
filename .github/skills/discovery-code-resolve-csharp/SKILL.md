---
name: discovery-code-resolve-csharp
description: Semantic resolver for C#. Enriches Tree-sitter symbols with real type resolution, inheritance chains, and overload detection using Roslyn (OmniSharp).
license: Apache-2.0
compatibility: Requires .discovery/code/symbols/ with Tree-sitter output. Requires .NET SDK installed.
metadata:
  author: discovery-code
  version: "1.0"
---

# Resolver — C#

Enriches Tree-sitter symbols with **real type resolution** using the **Roslyn Compiler Platform** (via OmniSharp or dotnet CLI). Resolves namespaces, generics, LINQ, and full inheritance chains.

## Common Interface

```
INPUT:
  - file_path: string              ← file to resolve
  - tree_sitter_symbols: Symbol[]  ← symbols already extracted by Tree-sitter
  - scan_manifest: object          ← repo context (frameworks, languages)

OUTPUT:
  - enriched_symbols: Symbol[]     ← same symbols enriched with real semantics
  - additional_edges: Edge[]       ← relationships Tree-sitter couldn't see
  - metadata:
      resolver: "roslyn"
      version: "<dotnet sdk version>"
      confidence: "high"
      source: "resolver"
```

## Steps

### 1. Check tool availability

```bash
dotnet --version 2>/dev/null && echo "DOTNET OK" || echo "NOT INSTALLED"
```

If .NET SDK is not installed, warn the user:
```
⚠️ .NET SDK not found. Install from https://dotnet.microsoft.com/download
   The C# resolver requires `dotnet` CLI for Roslyn-based type resolution.
   Falling back to Tree-sitter + LLM for C# files.
```

Check for solution/project files:
```bash
find . -name "*.sln" -o -name "*.csproj" | head -5
```

### 2. Receive input

Key symbols to enrich:
- `using_directive` → resolve to actual namespace/type
- `invocation_expression` → resolve to method declaration (overload + extension methods)
- `class_declaration` → resolve base class + interfaces
- `generic_name` → resolve type parameters
- `object_creation_expression` → resolve constructor
- `attribute` → resolve to attribute type + extract arguments

### 3. Run resolver

Create `.discovery/code/tools/csharp-resolve.csx` — a C# script using Roslyn APIs:

```csharp
// This is a dotnet-script (.csx) that uses Roslyn for resolution
// Run with: dotnet script .discovery/code/tools/csharp-resolve.csx <file_path>
#r "nuget: Microsoft.CodeAnalysis.CSharp, 4.8.0"

using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

var filePath = Args[0];
var tree = CSharpSyntaxTree.ParseText(File.ReadAllText(filePath));
var root = tree.GetRoot();

// For full resolution, build a compilation with project references
// This requires the .csproj/.sln context
```

Alternatively, use `dotnet build` output for type information:
```bash
dotnet build --no-restore 2>&1 | head -20
```

### 4. Enrich symbols

- **Classes**: add `namespace_resolved`, `base_class_resolved` (fully qualified), `interfaces_resolved`
- **Methods**: add `parameter_types_resolved`, `return_type_resolved`, `is_extension_method`, `overrides`
- **Properties**: add `type_resolved`, `accessor_kind` (get/set/init)
- **Using directives**: mark as `static using`, `global using`, or namespace import
- **Generics**: resolve `List<T>` → concrete type argument at usage sites

### 5. Emit additional edges

| Edge type | What it captures |
|-----------|-----------------|
| `INHERITS` | `: BaseClass` resolved to actual file |
| `IMPLEMENTS` | `: IInterface` resolved to actual file |
| `OVERRIDES` | `override` / `virtual` method chains |
| `CALLS` | Method calls resolved (including extension methods) |
| `USES_TYPE` | Property types, parameter types, generic arguments |
| `INJECTS` | DI container registrations (`services.AddScoped<IFoo, Foo>()`) |

### 6. Return output

Standard resolver output with `resolver: "roslyn"`.

## What This Resolver Sees That Tree-sitter Cannot

| Scenario | Tree-sitter | Roslyn |
|----------|-------------|--------|
| `using System.Linq;` then `.Where(...)` | Sees method call | Resolves as LINQ extension method on `IEnumerable<T>` |
| `var x = GetUser()` | Knows `x` is declared | Knows `x` is `User?` (inferred type) |
| `partial class Foo` | Sees one part | Combines all partial definitions |
| `nameof(MyClass)` | Sees call | Resolves to the referenced symbol |
| `services.AddScoped<IFoo, Foo>()` | Sees call | Resolves DI registration: `IFoo` → `Foo` |
| `if (_dep == null) return Stubs.Resolve(p);` in method body | Sees call edge to `Stubs` — no indication it's conditional | Detects null-field guard → annotates `behavioral_modes` on class + emits `CONDITIONAL_DELEGATES_TO` edge |
| `[JsonPropertyName("additional_data")] public string AdditionalData` | Sees property `AdditionalData` only | Reads attribute value → records `json_name: "additional_data"` + emits `JSON_MAPPED_AS` edge |

## Framework-Specific Enrichment

If scan manifest indicates **ASP.NET Core**:
- Map `[ApiController]` + `[Route]` → HTTP endpoint metadata
- Map `[Authorize]` → security constraints
- Map DI registrations in `Program.cs` / `Startup.cs` → injection graph

If scan manifest indicates **Entity Framework**:
- Map `DbSet<T>` properties → entity model
- Map `OnModelCreating` → relationship configuration

### Conditional Null-Field Delegation Pattern (Behavioral Modes)

> **Why this matters**: Tree-sitter extracts method signatures and call edges but **not the conditional logic inside method bodies**. A class that behaves differently depending on whether an injected field is `null` will appear in the graph as a normal caller of the delegate — with no indication that the delegation is conditional, that two distinct modes exist, or that a simpler construction path activates them. This leads to synthesized docs that silently omit behavioral modes and leave consuming agents unaware of design-time options (e.g., stub mode for tests/local dev).

**This pattern is language-agnostic** (null-field guard appears in Java, Kotlin, C#, TypeScript, Go, Python, etc.) but this resolver handles the **C#** form.

---

**Detection rule**: After Tree-sitter extraction, scan each class for the following structure:

```csharp
// 1. Field declared at class level — any injectable or dependency type:
private readonly DepType _fieldName;

// 2. No-arg constructor that sets the field to null (directly or via delegation):
public MyClass() : this(null) { }
public MyClass(DepType dep) { _fieldName = dep; }

// 3. In method bodies — null guard before the live implementation:
if (_fieldName == null) {
    return FallbackClass.StaticOrInstanceMethod(param);  // ← mode A (stub/offline/fallback)
}
// ... mode B (live/online) implementation
```

**Variants to detect** (all equivalent in semantics):

| Variant | Example |
|---|---|
| Classic null guard | `if (_field == null) return Stubs.Resolve(p);` |
| C# pattern matching | `if (_field is null) return Stubs.Resolve(p);` |
| Null-conditional + null-coalescing | `return _field?.Handle(p) ?? FallbackClass.Resolve(p);` |
| Boolean flag toggle | `if (!_isLive) return _fallback.Handle(p);` (field set in constructor) |
| Null guard → return empty | `if (_field == null) return ResponseType.Empty();` |
| Null guard → throw | `if (_field == null) throw new NotSupportedException();` |

**Matching conditions** (all must hold):
1. The class has at least one `private` (or `protected`) field whose type is a dependency (not a primitive, not `string`, not a value type)
2. A no-arg constructor exists (or a constructor that accepts `null` as the field value)
3. At least one method body contains an `if (_field == null)` / `is null` guard, null-conditional `?.` with `??`, or equivalent boolean toggle
4. The guarded branch returns or throws without calling `this._field` — i.e., it is a self-contained alternate path

---

**When matched, annotate the class symbol** with `behavioral_modes`:

```json
{
  "behavioral_modes": [
    {
      "name": "stub",
      "activation": "_fieldName == null (no-arg constructor)",
      "description": "Fallback path — does not invoke the injected dependency"
    },
    {
      "name": "live",
      "activation": "_fieldName != null (dependency injected via constructor or DI container)",
      "description": "Live path — delegates to the injected dependency"
    }
  ],
  "stub_delegate_class": "Company.Project.FallbackClass",
  "stub_delegate_methods": ["ResolveXxx", "HandleYyy"]
}
```

**When matched, annotate each method** that contains the guard:

```json
{
  "behavioral_guard": {
    "field": "_fieldName",
    "condition": "_fieldName == null (or is null / ?? branch)",
    "stub_branch": {
      "delegate_class": "Company.Project.FallbackClass",
      "delegate_method": "ResolveXxx",
      "delegate_args": ["param1"]
    },
    "live_branch": "invokes this._fieldName.RemoteCall(param1)"
  }
}
```

**Emit an additional edge** of type `CONDITIONAL_DELEGATES_TO` for each method with a guard:

```json
{
  "type": "CONDITIONAL_DELEGATES_TO",
  "source": "Company.Project.MyService::MyMethod",
  "target": "Company.Project.FallbackClass::ResolveXxx",
  "condition": "_fieldName == null",
  "mode": "stub",
  "confidence": "high",
  "source_tool": "roslyn"
}
```

---

**What to document in the synthesized foundation** (`service-map.md`): The `discovery-code-synthesize` skill reads these annotations from the module profile. When `behavioral_modes` is present on a class, synthesize a **Behavioral Modes** subsection in the Service Map:

```markdown
### Behavioral Modes — MyService

| Mode | Activation | Behavior |
|---|---|---|
| **stub** | `new MyService()` — _fieldName = null | Delegates to FallbackClass.ResolveXxx(param) |
| **live** | `new MyService(dep)` — _fieldName != null | Real remote call via dep |
```

**Practical note for LLM-assisted resolution** (when Roslyn is unavailable): read the full source of every class that has a dependency-typed field. For each method, check whether the first meaningful statement is a null-guard, `is null` pattern, or null-conditional on that field. If yes, extract the delegate class/method and record the annotations above. This takes priority over inferring call chains from signatures alone.

### JSON Wire Name Mapping Pattern

> **Why this matters**: Tree-sitter extracts property names but **not attribute arguments**. A property `AdditionalData` decorated with `[JsonPropertyName("additional_data")]` appears in the symbol graph with only its C# name — the wire key is invisible. Agents writing JSON fixtures from the graph will use `"AdditionalData"` instead of `"additional_data"`, causing silent deserialization failures.

**Detection rule**: For each property or field in each class, check whether a wire-name attribute is present whose value differs from the member name.

**Attributes to detect** (C#):

| Attribute | Library | Example |
|---|---|---|
| `[JsonProperty("wire_name")]` | Newtonsoft.Json | `[JsonProperty("additional_data")] public string AdditionalData { get; set; }` |
| `[JsonPropertyName("wire_name")]` | System.Text.Json | `[JsonPropertyName("additional_data")] public string AdditionalData { get; set; }` |

**When matched, annotate the property symbol** with `json_name`:

```json
{
  "name": "AdditionalData",
  "json_name": "additional_data",
  "annotations": ["[JsonPropertyName(\\\"additional_data\\\")]"]
}
```

**Emit an edge** of type `JSON_MAPPED_AS`:

```json
{
  "type": "JSON_MAPPED_AS",
  "source": "MyNamespace.MyDto::AdditionalData",
  "target_key": "additional_data",
  "confidence": "high",
  "source_tool": "roslyn"
}
```

**What to document in the synthesized foundation**: The `discovery-code-synthesize` skill reads `json_name` field annotations and `JSON_MAPPED_AS` edges. When any property has a differing wire name:
- `data-model.md`: Fields column shows `PropName ("wire_name")` with ⚠️
- `api-contracts.md`: Endpoint gains a *Response JSON shape* subsection with wire-format keys
- `framework-api-registry.md`: `### JSON Wire Name Corrections` table added

**LLM fallback note** (when Roslyn is unavailable): for every class that appears to be a DTO or response type (name ends in `Response`, `Dto`, `Model`, `Payload`), read each property declaration and look for `[JsonProperty]` or `[JsonPropertyName]`. If found and the attribute value differs from the property name, record `json_name` on the property symbol.

## Guardrails

- **DO NOT modify source code** — read-only analysis
- **Handle missing .NET SDK** — warn and fall back to Tree-sitter + LLM
- **Handle build errors** — resolve what you can despite compilation issues
- **Performance** — resolve one file at a time
- **Fallback** — if Roslyn fails, return original symbols unchanged with warning
