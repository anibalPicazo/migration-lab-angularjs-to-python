---
name: discovery-code-resolve-go
description: Semantic resolver for Go. Enriches Tree-sitter symbols with real type resolution, implicit interface satisfaction, and struct embedding using Go's go/types package.
license: Apache-2.0
compatibility: Requires .discovery/code/symbols/ with Tree-sitter output. Requires Go installed.
metadata:
  author: discovery-code
  version: "1.0"
---

# Resolver — Go

Enriches Tree-sitter symbols with **real type resolution** using Go's built-in `go/types` package. Resolves implicit interface satisfaction, struct embedding, and package-level import chains.

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
      resolver: "go-types"
      version: "<go version>"
      confidence: "high"
      source: "resolver"
```

## Steps

### 1. Check tool availability

```bash
go version 2>/dev/null && echo "GO OK" || echo "NOT INSTALLED"
```

Check for Go module:
```bash
ls go.mod 2>/dev/null && echo "GO MODULE" || echo "NO GO.MOD"
```

If Go is not installed:
```
⚠️ Go is not installed. Install from https://go.dev/dl/
   The Go resolver requires go CLI for type checking.
   Falling back to Tree-sitter + LLM for Go files.
```

### 2. Receive input

Key symbols to enrich:
- `import_spec` → resolve to actual package path and used identifiers
- `call_expression` → resolve to actual function/method, including interface dispatch
- `type_spec` → resolve struct embedding, interface composition
- `selector_expression` → resolve `pkg.Func` or `obj.Method` to actual target
- `short_var_declaration` → infer the type from the right-hand side

### 3. Run resolver

Create `.discovery/code/tools/go-resolve.go`:

```go
package main

import (
    "encoding/json"
    "fmt"
    "go/ast"
    "go/importer"
    "go/parser"
    "go/token"
    "go/types"
    "os"
)

type Result struct {
    EnrichedSymbols []map[string]interface{} `json:"enriched_symbols"`
    AdditionalEdges []map[string]interface{} `json:"additional_edges"`
}

func main() {
    filePath := os.Args[1]
    fset := token.NewFileSet()

    f, err := parser.ParseFile(fset, filePath, nil, parser.AllErrors)
    if err != nil {
        fmt.Fprintf(os.Stderr, "parse error: %v\n", err)
        os.Exit(1)
    }

    conf := types.Config{Importer: importer.Default()}
    info := &types.Info{
        Types: make(map[ast.Expr]types.TypeAndValue),
        Defs:  make(map[*ast.Ident]types.Object),
        Uses:  make(map[*ast.Ident]types.Object),
    }

    _, err = conf.Check(".", fset, []*ast.File{f}, info)
    if err != nil {
        // Continue with partial results — some types may not resolve
        fmt.Fprintf(os.Stderr, "type check warning: %v\n", err)
    }

    result := Result{}

    // Resolve all identifier usages
    for ident, obj := range info.Uses {
        if obj.Pkg() != nil {
            result.AdditionalEdges = append(result.AdditionalEdges, map[string]interface{}{
                "source":     fmt.Sprintf("%s::line%d", filePath, fset.Position(ident.Pos()).Line),
                "target":     fmt.Sprintf("%s::%s", obj.Pkg().Path(), obj.Name()),
                "type":       "CALLS",
                "confidence": "high",
                "sources":    []string{"resolver"},
            })
        }
    }

    json.NewEncoder(os.Stdout).Encode(result)
}
```

Run:
```bash
go run .discovery/code/tools/go-resolve.go "<file_path>"
```

### 4. Enrich symbols

- **Functions**: add `receiver_type` (for methods), `return_types_resolved`, `parameter_types_resolved`
- **Structs**: add `embedded_types` (promoted fields/methods), `implements_interfaces`
- **Interfaces**: add `implementors` (types that satisfy this interface — Go-specific)
- **Variables**: add `inferred_type` from `go/types`
- **Imports**: resolve to actual package path and mark used/unused

### 5. Emit additional edges

| Edge type | What it captures |
|-----------|-----------------|
| `IMPLEMENTS` | Implicit interface satisfaction (Go's structural typing) |
| `EMBEDS` | Struct embedding (promoted fields/methods) |
| `CALLS` | Function/method calls resolved to actual package + name |
| `USES_TYPE` | Type assertions, type switches, parameter/return types |
| `IMPORTS` | Package imports resolved to actual module paths |

### 6. Return output

Standard resolver output with `resolver: "go-types"`.

## What This Resolver Sees That Tree-sitter Cannot

| Scenario | Tree-sitter | Go Resolver |
|----------|-------------|-------------|
| `type Reader interface { Read([]byte) }` | Sees interface | Finds all types that implement it (structural typing) |
| `type MyStruct struct { BaseStruct }` | Sees embedding | Resolves promoted methods from `BaseStruct` |
| `x := foo()` | Sees short var decl | Knows `x` is `*User` (return type of `foo`) |
| `http.HandleFunc("/", handler)` | Sees function call | Resolves `handler` must satisfy `http.HandlerFunc` |
| `err.(MyError)` | Sees type assertion | Resolves `MyError` to actual type definition |
| `if s.dep == nil { return stubs.Resolve(p) }` in method body | Sees call edge to `stubs` — no indication it's conditional | Detects nil-field guard → annotates `behavioral_modes` on struct + emits `CONDITIONAL_DELEGATES_TO` edge |
| `AdditionalData string \`json:"additional_data"\`` | Sees field `AdditionalData` only | Reads struct tag value → records `json_name: "additional_data"` + emits `JSON_MAPPED_AS` edge |

## Framework-Specific Enrichment

If scan manifest indicates **Gin / Echo / Fiber**:
- Map `router.GET("/path", handler)` → HTTP endpoint metadata
- Map middleware chains → request pipeline

If scan manifest indicates **gRPC**:
- Map generated `.pb.go` → service + message definitions
- Map `RegisterXxxServer()` → service registration

### Conditional Nil-Field Delegation Pattern (Behavioral Modes)

> **Why this matters**: Tree-sitter extracts method signatures and call edges but **not the conditional logic inside method bodies**. A struct that behaves differently depending on whether an injected field is `nil` will appear in the graph as a normal caller of the delegate — with no indication that the delegation is conditional, that two distinct modes exist, or that a simpler construction path activates them. This leads to synthesized docs that silently omit behavioral modes and leave consuming agents unaware of design-time options (e.g., stub mode for tests/local dev).

**This pattern is language-agnostic** (null-field guard appears in Java, Kotlin, C#, TypeScript, Go, Python, etc.) but this resolver handles the **Go** form.

---

**Detection rule**: After Tree-sitter extraction, scan each struct for the following structure:

```go
// 1. Field declared in struct — any interface or pointer-to-concrete dependency type:
type MyService struct {
    fieldName DepInterface  // or *DepType
}

// 2. Constructor that accepts nil (or a zero-value factory that omits the field):
func NewMyService() *MyService { return &MyService{} }  // fieldName is nil
func NewMyServiceWithDep(dep DepInterface) *MyService { return &MyService{fieldName: dep} }

// 3. In method bodies — nil guard before the live implementation:
if s.fieldName == nil {
    return fallbackPackage.StaticOrFunc(param)  // ← mode A (stub/offline/fallback)
}
// ... mode B (live/online) implementation
```

**Variants to detect** (all equivalent in semantics):

| Variant | Example |
|---|---|
| Nil guard → package-level func | `if s.dep == nil { return stubs.Resolve(p) }` |
| Nil guard → method on another struct | `if s.dep == nil { return s.fallback.Handle(p) }` |
| Nil guard → return zero value | `if s.dep == nil { return nil, nil }` |
| Nil guard → return error | `if s.dep == nil { return nil, ErrNotConfigured }` |
| Boolean flag toggle | `if !s.isLive { return s.fallback.Handle(p) }` (field set in constructor) |

**Matching conditions** (all must hold):
1. The struct has at least one field of interface type or pointer-to-struct type (a dependency, not a primitive)
2. A zero-arg or partial constructor exists that leaves the field at its zero value (`nil`)
3. At least one method body contains an `if s.field == nil` guard or boolean toggle before delegating
4. The guarded branch returns or returns an error without calling `s.field` — i.e., it is a self-contained alternate path

---

**When matched, annotate the struct symbol** with `behavioral_modes`:

```json
{
  "behavioral_modes": [
    {
      "name": "stub",
      "activation": "fieldName == nil (zero-value constructor / NewMyService())",
      "description": "Fallback path — does not invoke the injected dependency"
    },
    {
      "name": "live",
      "activation": "fieldName != nil (dependency injected via NewMyServiceWithDep or wire)",
      "description": "Live path — delegates to the injected dependency"
    }
  ],
  "stub_delegate_package": "github.com/example/stubs",
  "stub_delegate_funcs": ["Resolve", "Handle"]
}
```

**When matched, annotate each method** that contains the guard:

```json
{
  "behavioral_guard": {
    "field": "fieldName",
    "condition": "s.fieldName == nil",
    "stub_branch": {
      "delegate_package": "github.com/example/stubs",
      "delegate_func": "Resolve",
      "delegate_args": ["param1"]
    },
    "live_branch": "invokes s.fieldName.RemoteCall(param1)"
  }
}
```

**Emit an additional edge** of type `CONDITIONAL_DELEGATES_TO` for each method with a guard:

```json
{
  "type": "CONDITIONAL_DELEGATES_TO",
  "source": "github.com/example/MyService::MyMethod",
  "target": "github.com/example/stubs::Resolve",
  "condition": "fieldName == nil",
  "mode": "stub",
  "confidence": "high",
  "source_tool": "go-types"
}
```

---

**What to document in the synthesized foundation** (`service-map.md`): The `discovery-code-synthesize` skill reads these annotations from the module profile. When `behavioral_modes` is present on a struct, synthesize a **Behavioral Modes** subsection in the Service Map:

```markdown
### Behavioral Modes — MyService

| Mode | Activation | Behavior |
|---|---|---|
| **stub** | `NewMyService()` — fieldName = nil | Delegates to stubs.Resolve(param) |
| **live** | `NewMyServiceWithDep(dep)` — fieldName != nil | Real remote call via dep |
```

**Practical note for LLM-assisted resolution** (when go/types is unavailable): read the full source of every struct that has an interface-typed or pointer-typed field. For each method, check whether the first meaningful statement is a nil-guard on that field. If yes, extract the delegate package/function and record the annotations above. This takes priority over inferring call chains from signatures alone.

### JSON Wire Name Mapping Pattern

> **Why this matters**: Tree-sitter extracts struct field names but **not struct tag values**. A field `AdditionalData` tagged with `` `json:"additional_data"` `` appears in the symbol graph with only its Go name — the wire key is invisible. Agents writing JSON fixtures from the graph will use `"AdditionalData"` instead of `"additional_data"`, causing silent zero-value deserialization.

**Detection rule**: For each field in each struct, check whether a `json` struct tag is present with a key that differs from the field name (note: Go’s default JSON marshaler lowercases the first letter, so `AdditionalData` would serialize as `additionalData` without a tag; the gap only needs recording when the tag key differs from the lowercased field name).

**Tags to detect** (Go):

| Tag | Standard | Example |
|---|---|---|
| `` `json:"wire_name"` `` | encoding/json | `` AdditionalData string `json:"additional_data"` `` |
| `` `json:"wire_name,omitempty"` `` | encoding/json | `` Count int `json:"count,omitempty"` `` |
| `` `yaml:"wire_name"` `` | gopkg.in/yaml.v3 | `` AdditionalData string `yaml:"additional_data"` `` |

**When matched, annotate the field symbol** with `json_name`:

```json
{
  "name": "AdditionalData",
  "json_name": "additional_data",
  "struct_tags": { "json": "additional_data" }
}
```

**Emit an edge** of type `JSON_MAPPED_AS`:

```json
{
  "type": "JSON_MAPPED_AS",
  "source": "mypkg.MyDto::AdditionalData",
  "target_key": "additional_data",
  "confidence": "high",
  "source_tool": "go-types"
}
```

**What to document in the synthesized foundation**: The `discovery-code-synthesize` skill reads `json_name` field annotations and `JSON_MAPPED_AS` edges. When any field has a differing wire name:
- `data-model.md`: Fields column shows `FieldName ("wire_name")` with ⚠️
- `api-contracts.md`: Endpoint gains a *Response JSON shape* subsection with wire-format keys
- `framework-api-registry.md`: `### JSON Wire Name Corrections` table added

**LLM fallback note** (when go/types is unavailable): for every struct that appears to be a response or DTO type (name ends in `Response`, `DTO`, `Data`, `Payload`), read each field declaration and extract the `json` struct tag value. If the tag key differs from the lowercased Go field name, record `json_name` on the field symbol.

## Guardrails

- **DO NOT modify source code** — read-only analysis
- **Handle missing Go** — warn and fall back to Tree-sitter + LLM
- **Implicit interfaces** — Go's structural typing means a type implements an interface without declaring it; the resolver must check method sets
- **Vendor vs modules** — respect `go.mod` and vendor directory for resolution
- **Performance** — resolve one file at a time; `go/types` is fast
- **Fallback** — if type checking fails (missing deps), return partial results with warning
