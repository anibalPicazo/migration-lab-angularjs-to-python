---
name: discovery-code-resolve-typescript
description: Semantic resolver for TypeScript/JavaScript. Enriches Tree-sitter symbols with real type resolution, inheritance chains, and overload detection using ts-morph (TypeScript Compiler API wrapper).
license: Apache-2.0
compatibility: Requires .discovery/code/symbols/ with Tree-sitter output. Installs ts-morph on demand.
metadata:
  author: discovery-code
  version: "1.0"
---

# Resolver — TypeScript / JavaScript

Enriches Tree-sitter symbols with **real type resolution** using **ts-morph** (wraps the TypeScript Compiler API). This is the most impactful resolver — TypeScript's type system provides very accurate semantic data.

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
      resolver: "ts-morph"
      version: "<installed version>"
      confidence: "high"
      source: "resolver"
```

## Steps

### 1. Check tool availability

```bash
node -e "require('ts-morph')" 2>/dev/null && echo "ts-morph OK" || echo "NOT INSTALLED"
```

If NOT INSTALLED:
```bash
npm install ts-morph --save-dev
```

Verify a `tsconfig.json` exists in the project root (ts-morph needs it):
```bash
ls tsconfig.json 2>/dev/null || echo "NO TSCONFIG"
```

If no tsconfig, create a minimal one for analysis only:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### 2. Receive input

Read the Tree-sitter symbols for this file from `.discovery/code/symbols/<file_hash>.json`.

Key symbols to enrich:
- `import_statement` → resolve to actual file + exported symbol
- `call_expression` → resolve callee to actual declaration
- `class_declaration` → resolve extends/implements to actual types
- `type_reference` → resolve to actual type declaration
- `variable_declaration` → resolve inferred types

### 3. Run resolver

Create or use `.discovery/code/tools/ts-resolve.js`:

```javascript
const { Project } = require("ts-morph");

const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const sourceFile = project.getSourceFileOrThrow(process.argv[2]);

const result = {
  enriched_symbols: [],
  additional_edges: [],
};

// Resolve imports
for (const imp of sourceFile.getImportDeclarations()) {
  const moduleSpecifier = imp.getModuleSpecifierValue();
  const resolvedModule = imp.getModuleSpecifierSourceFile();
  const resolvedPath = resolvedModule?.getFilePath() || null;

  for (const named of imp.getNamedImports()) {
    const symbol = named.getNameNode().getSymbol();
    const declarations = symbol?.getDeclarations() || [];
    const actualDecl = declarations[0];

    result.enriched_symbols.push({
      name: named.getName(),
      alias: named.getAliasNode()?.getText() || null,
      resolved_file: resolvedPath,
      resolved_symbol: actualDecl?.getKindName() || "unknown",
      resolved_type: actualDecl ? actualDecl.getType?.()?.getText() : null,
    });
  }
}

// Resolve class inheritance
for (const cls of sourceFile.getClasses()) {
  const baseClass = cls.getBaseClass();
  if (baseClass) {
    result.additional_edges.push({
      source: `${sourceFile.getFilePath()}::${cls.getName()}`,
      target: `${baseClass.getSourceFile().getFilePath()}::${baseClass.getName()}`,
      type: "INHERITS",
      confidence: "high",
      sources: ["resolver"],
    });
  }

  for (const iface of cls.getImplements()) {
    const symbol = iface.getExpression().getSymbol();
    const decl = symbol?.getDeclarations()?.[0];
    if (decl) {
      result.additional_edges.push({
        source: `${sourceFile.getFilePath()}::${cls.getName()}`,
        target: `${decl.getSourceFile().getFilePath()}::${symbol.getName()}`,
        type: "IMPLEMENTS",
        confidence: "high",
        sources: ["resolver"],
      });
    }
  }

  // Resolve method overrides
  for (const method of cls.getMethods()) {
    if (baseClass) {
      const baseMethod = baseClass.getMethod(method.getName());
      if (baseMethod) {
        result.additional_edges.push({
          source: `${sourceFile.getFilePath()}::${cls.getName()}.${method.getName()}`,
          target: `${baseClass.getSourceFile().getFilePath()}::${baseClass.getName()}.${method.getName()}`,
          type: "OVERRIDES",
          confidence: "high",
          sources: ["resolver"],
        });
      }
    }
  }
}

// Resolve call expressions to actual declarations
for (const call of sourceFile.getDescendantsOfKind(
  require("ts-morph").SyntaxKind.CallExpression
)) {
  const symbol = call.getExpression().getSymbol();
  const decl = symbol?.getDeclarations()?.[0];
  if (decl && decl.getSourceFile() !== sourceFile) {
    result.additional_edges.push({
      source: `${sourceFile.getFilePath()}::<caller>`,
      target: `${decl.getSourceFile().getFilePath()}::${symbol.getName()}`,
      type: "CALLS",
      confidence: "high",
      sources: ["resolver"],
    });
  }
}

console.log(JSON.stringify(result, null, 2));
```

Run:
```bash
node .discovery/code/tools/ts-resolve.js "<file_path>"
```

### 4. Enrich symbols

For each Tree-sitter symbol, merge resolver data:

- **Variables**: add `resolved_type` (the real inferred/declared type)
- **Imports**: add `resolved_file` (actual target file) and `resolved_symbol` (what it maps to)
- **Classes**: add `base_class`, `implements`, resolved to actual file paths
- **Functions**: add `return_type`, `parameter_types` (resolved)
- **Calls**: add `resolved_target` (actual declaration the call resolves to)

Update `confidence` to `"high"` and add `source: "resolver"` for all enriched fields.

### 5. Emit additional edges

Return all `additional_edges` from the resolver run:
- `INHERITS` — class extends (resolved to actual base class file)
- `IMPLEMENTS` — class implements (resolved to actual interface file)
- `OVERRIDES` — method overrides base class method
- `CALLS` — cross-file calls resolved via type system
- `USES_TYPE` — type references resolved to declarations

### 6. Return output

Return the standard resolver output:

```json
{
  "enriched_symbols": [...],
  "additional_edges": [...],
  "metadata": {
    "resolver": "ts-morph",
    "version": "<version>",
    "confidence": "high",
    "source": "resolver"
  }
}
```

## What This Resolver Sees That Tree-sitter Cannot

| Scenario | Tree-sitter | ts-morph |
|----------|-------------|----------|
| `import { foo } from "./lib"` | Knows import exists | Knows `foo` is `function foo(x: number): string` in `lib.ts` |
| `bar()` after `import { foo as bar }` | Sees call to `bar` | Resolves `bar` → `foo` in `lib.ts` |
| `class A extends B` | Knows `B` is superclass name | Resolves `B` to `src/base.ts::B`, knows its full API |
| `const x = getUser()` | Knows `x` is declared | Knows `x` is `User` type, return of `getUser` |
| `overloaded.method(1)` | Sees call | Knows which overload matched |
| `if (!this.dep) return StubHandler.resolve(p)` in method body | Sees call edge to `StubHandler` — no indication it's conditional | Detects falsy/null/undefined guard → annotates `behavioral_modes` on class + emits `CONDITIONAL_DELEGATES_TO` edge |
| `@JsonProperty("additional_data") additionalData: string` | Sees property `additionalData` only | Reads decorator arg → records `json_name: "additional_data"` + emits `JSON_MAPPED_AS` edge |

### Conditional Null-Field Delegation Pattern (Behavioral Modes)

> **Why this matters**: Tree-sitter extracts method signatures and call edges but **not the conditional logic inside method bodies**. A class that behaves differently depending on whether an injected field is `null` or `undefined` will appear in the graph as a normal caller of the delegate — with no indication that the delegation is conditional, that two distinct modes exist, or that a simpler construction path activates them. This leads to synthesized docs that silently omit behavioral modes and leave consuming agents unaware of design-time options (e.g., stub mode for tests/local dev).

**This pattern is language-agnostic** (null-field guard appears in Java, Kotlin, C#, TypeScript, Go, Python, etc.) but this resolver handles the **TypeScript/JavaScript** form.

---

**Detection rule**: After Tree-sitter extraction, scan each class for the following structure:

```typescript
// 1. Field declared at class level — any injectable or dependency type:
private readonly fieldName: DepType | null | undefined;

// 2. No-arg constructor (or constructor with optional parameter) that leaves the field null/undefined:
constructor(dep?: DepType) { this.fieldName = dep ?? null; }

// 3. In method bodies — null/undefined guard before the live implementation:
if (!this.fieldName) {
    return FallbackClass.staticOrInstanceMethod(param);  // ← mode A (stub/offline/fallback)
}
// ... mode B (live/online) implementation
```

**Variants to detect** (all equivalent in semantics):

| Variant | Example |
|---|---|
| Falsy guard | `if (!this.client) return stubs.resolve(p);` |
| Strict null check | `if (this.client === null \|\| this.client === undefined)` |
| Nullish coalescing | `return this.client?.handle(p) ?? FallbackClass.resolve(p);` |
| Optional chaining + fallback | `return this.dep?.call(p) ?? fallback.handle(p);` |
| Boolean flag toggle | `if (!this.isLive) return this.fallback.handle(p);` (field set in constructor) |
| Null guard → return empty | `if (!this.client) return [];` |

**Matching conditions** (all must hold):
1. The class has at least one field typed as `T | null`, `T | undefined`, `T?`, or optional parameter, whose type is a dependency (not a primitive, not `string`, not a value type)
2. A no-arg constructor or constructor with optional parameter exists
3. At least one method body contains a falsy guard `!this.field`, strict null/undefined check, optional chaining `?.` with `??`, or equivalent boolean toggle
4. The guarded/nullish branch returns or throws without calling `this.field` — i.e., it is a self-contained alternate path

---

**When matched, annotate the class symbol** with `behavioral_modes`:

```json
{
  "behavioral_modes": [
    {
      "name": "stub",
      "activation": "fieldName == null/undefined (no-arg constructor or optional parameter omitted)",
      "description": "Fallback path — does not invoke the injected dependency"
    },
    {
      "name": "live",
      "activation": "fieldName != null/undefined (dependency injected via constructor or DI container)",
      "description": "Live path — delegates to the injected dependency"
    }
  ],
  "stub_delegate_class": "FallbackClass",
  "stub_delegate_methods": ["resolveXxx", "handleYyy"]
}
```

**When matched, annotate each method** that contains the guard:

```json
{
  "behavioral_guard": {
    "field": "fieldName",
    "condition": "!this.fieldName (or === null/undefined / ?? branch)",
    "stub_branch": {
      "delegate_class": "FallbackClass",
      "delegate_method": "resolveXxx",
      "delegate_args": ["param1"]
    },
    "live_branch": "invokes this.fieldName.remoteCall(param1)"
  }
}
```

**Emit an additional edge** of type `CONDITIONAL_DELEGATES_TO` for each method with a guard:

```json
{
  "type": "CONDITIONAL_DELEGATES_TO",
  "source": "MyService::myMethod",
  "target": "FallbackClass::resolveXxx",
  "condition": "fieldName == null/undefined",
  "mode": "stub",
  "confidence": "high",
  "source_tool": "ts-morph"
}
```

---

**What to document in the synthesized foundation** (`service-map.md`): The `discovery-code-synthesize` skill reads these annotations from the module profile. When `behavioral_modes` is present on a class, synthesize a **Behavioral Modes** subsection in the Service Map:

```markdown
### Behavioral Modes — MyService

| Mode | Activation | Behavior |
|---|---|---|
| **stub** | `new MyService()` — fieldName = null/undefined | Delegates to FallbackClass.resolveXxx(param) |
| **live** | `new MyService(dep)` — fieldName != null/undefined | Real remote call via dep |
```

**Practical note for LLM-assisted resolution** (when ts-morph is unavailable): read the full source of every class that has a nullable/optional dependency-typed field. For each method, check whether the first meaningful statement is a falsy guard, null/undefined check, or nullish coalescing on that field. If yes, extract the delegate class/method and record the annotations above. This takes priority over inferring call chains from signatures alone.

### JSON Wire Name Mapping Pattern

> **Why this matters**: Tree-sitter extracts property names but **not decorator arguments**. A property `additionalData` decorated with `@JsonProperty("additional_data")` (class-transformer) appears in the symbol graph with only its TypeScript name — the wire key is invisible. Agents writing JSON fixtures or mock responses from the graph will use the wrong key.

**Detection rule**: For each property in each class, check whether a wire-name decorator or mapping is present whose value differs from the property name.

**Decorators/patterns to detect** (TypeScript):

| Decorator / Pattern | Library | Example |
|---|---|---|
| `@JsonProperty("wire_name")` | class-transformer | `@JsonProperty("additional_data") additionalData: string` |
| `@Expose({ name: "wire_name" })` | class-transformer | `@Expose({ name: "additional_data" }) additionalData: string` |
| `toJSON() { return { wire_name: this.prop } }` | Plain TS | Manual serialization remapping |

**When matched, annotate the property symbol** with `json_name`:

```json
{
  "name": "additionalData",
  "json_name": "additional_data",
  "annotations": ["@JsonProperty(\\\"additional_data\\\")"]
}
```

**Emit an edge** of type `JSON_MAPPED_AS`:

```json
{
  "type": "JSON_MAPPED_AS",
  "source": "MyDto::additionalData",
  "target_key": "additional_data",
  "confidence": "high",
  "source_tool": "ts-morph"
}
```

**What to document in the synthesized foundation**: The `discovery-code-synthesize` skill reads `json_name` field annotations and `JSON_MAPPED_AS` edges. When any property has a differing wire name:
- `data-model.md`: Fields column shows `propName ("wire_name")` with ⚠️
- `api-contracts.md`: Endpoint gains a *Response JSON shape* subsection with wire-format keys
- `framework-api-registry.md`: `### JSON Wire Name Corrections` table added

**LLM fallback note** (when ts-morph is unavailable): for every class that appears to be a DTO or response type (name ends in `Response`, `Dto`, `Model`, `Payload`), read each property and look for `@JsonProperty`, `@Expose({ name })`, or a `toJSON()` method with a remapping. If found and the wire key differs from the property name, record `json_name` on the property symbol.

## Guardrails

- **DO NOT modify source code** — read-only analysis
- **Handle missing tsconfig** — create minimal one for analysis, don't fail
- **Handle compilation errors** — ts-morph may report errors in source; ignore them, resolve what you can
- **Performance** — for large projects (>1000 files), process the single file only, don't load entire project
- **Fallback** — if ts-morph fails on a file, return the original Tree-sitter symbols unchanged with a warning
