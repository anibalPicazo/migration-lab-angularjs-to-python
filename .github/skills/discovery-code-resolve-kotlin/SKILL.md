---
name: discovery-code-resolve-kotlin
description: Semantic resolver for Kotlin. Enriches Tree-sitter symbols with real type resolution, extension functions, data classes, and sealed class hierarchies using the Kotlin compiler API.
license: Apache-2.0
compatibility: Requires .discovery/code/symbols/ with Tree-sitter output. Requires Kotlin compiler or Gradle project.
metadata:
  author: discovery-code
  version: "1.0"
---

# Resolver — Kotlin

Enriches Tree-sitter symbols with **real type resolution** using the **Kotlin Compiler embeddable** or project build tools. Resolves extension functions, data classes, sealed hierarchies, and coroutine scopes.

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
      resolver: "kotlin-compiler"
      version: "<kotlin version>"
      confidence: "high"
      source: "resolver"
```

## Steps

### 1. Check tool availability

```bash
kotlinc -version 2>&1 | head -1 || echo "KOTLIN NOT INSTALLED"
```

Check for Gradle (most Kotlin projects use it):
```bash
ls build.gradle.kts 2>/dev/null || ls build.gradle 2>/dev/null && echo "GRADLE PROJECT"
```

If neither Kotlin compiler nor Gradle:
```
⚠️ Kotlin compiler not found. Options:
   1. Install Kotlin: brew install kotlin (macOS) / sdk install kotlin (sdkman)
   2. If this is a Gradle project, ensure ./gradlew is available
   Falling back to Tree-sitter + LLM for Kotlin files.
```

### 2. Receive input

Key symbols to enrich:
- `import_header` → resolve to actual class/file
- `call_expression` → resolve including extension functions and operator overloads
- `class_declaration` → resolve base class + interfaces, sealed variants
- `property_declaration` → resolve delegated properties, inferred types
- `annotation_entry` → resolve to annotation class

### 3. Run resolver

Use Gradle's compile output or `kotlinc` analysis mode:

```bash
# For Gradle projects — leverage the build for resolution context
./gradlew dependencies --configuration compileClasspath 2>/dev/null | head -30
```

For direct Kotlin analysis, create `.discovery/code/tools/kt-resolve.kts`:

```kotlin
// Kotlin script for type resolution
// Run with: kotlinc -script .discovery/code/tools/kt-resolve.kts <file_path>
import java.io.File

val filePath = args[0]
val source = File(filePath).readText()

// Parse imports and resolve to actual files
val imports = Regex("""import\s+([\w.]+)""").findAll(source)
for (imp in imports) {
    val fqName = imp.groupValues[1]
    // Map to actual source file via project structure
    println("""{"import": "$fqName"}""")
}
```

For most Kotlin resolution, **LLM-assisted** approach is pragmatic:
1. Read Tree-sitter symbols
2. For extension functions, resolve the receiver type
3. For sealed classes, find all subclasses in the project
4. For data classes, extract `copy()`, `component1()..N()` synthetic methods

### 4. Enrich symbols

- **Classes**: add `sealed_variants` (for sealed classes), `data_class_components`, `companion_object`
- **Functions**: add `is_extension`, `receiver_type_resolved`, `is_suspend`, `return_type_resolved`
- **Properties**: add `delegate_type` (for `by lazy`, `by viewModel()`), `backing_field`, `type_resolved`
- **Imports**: resolve to actual Kotlin/Java interop class
- **Annotations**: extract Spring/Android-specific metadata

### 5. Emit additional edges

| Edge type | What it captures |
|-----------|-----------------|
| `INHERITS` | Class extends / sealed variants |
| `IMPLEMENTS` | Interface implementation |
| `CALLS` | Function calls including extension functions |
| `EXTENDS_FUNCTION` | Extension function → receiver type |
| `USES_TYPE` | Property types, return types, type parameters |
| `DELEGATES` | Property delegation relationships |

### 6. Return output

Standard resolver output with `resolver: "kotlin-compiler"`.

## What This Resolver Sees That Tree-sitter Cannot

| Scenario | Tree-sitter | Kotlin Resolver |
|----------|-------------|-----------------|
| `fun String.isEmail()` | Sees function | Knows it's an extension of `kotlin.String` |
| `sealed class Result` | Sees one class | Finds all `Success`, `Error` subclasses |
| `data class User(val name: String)` | Sees class | Knows about `copy()`, `component1()`, `equals()` |
| `val x by lazy { ... }` | Sees property | Knows delegate type and initialization |
| `suspend fun fetch()` | Sees function | Knows coroutine context and suspension points |
| `dep?.let { live(it) } ?: Stub.resolve(p)` in method body | Sees call edge to `Stub` — no indication it's conditional | Detects null/Elvis guard → annotates `behavioral_modes` on class + emits `CONDITIONAL_DELEGATES_TO` edge |
| `@SerialName("additional_data") val additionalData: String` | Sees property `additionalData` only | Reads annotation value → records `json_name: "additional_data"` + emits `JSON_MAPPED_AS` edge |

## Framework-Specific Enrichment

If scan manifest indicates **Spring Boot** (Kotlin):
- Map `@RestController`, `@Service`, `@Repository` → bean lifecycle
- Map constructor injection (Kotlin primary constructors) → DI graph

If scan manifest indicates **Android** (Kotlin):
- Map `@Composable` → Jetpack Compose component graph
- Map `ViewModel`, `LiveData`, `StateFlow` → MVVM relationships
- Map `by viewModels()` → ViewModel delegation

### Conditional Null-Field Delegation Pattern (Behavioral Modes)

> **Why this matters**: Tree-sitter extracts method signatures and call edges but **not the conditional logic inside method bodies**. A class that behaves differently depending on whether an injected field is `null` will appear in the graph as a normal caller of the delegate — with no indication that the delegation is conditional, that two distinct modes exist, or that a simpler construction path activates them. This leads to synthesized docs that silently omit behavioral modes and leave consuming agents unaware of design-time options (e.g., stub mode for tests/local dev).

**This pattern is language-agnostic** (null-field guard appears in Java, Kotlin, C#, TypeScript, Go, Python, etc.) but this resolver handles the **Kotlin** form.

---

**Detection rule**: After Tree-sitter extraction, scan each class for the following structure:

```kotlin
// 1. Field declared at class level — any injectable or dependency type:
private val fieldName: DepType?

// 2. No-arg constructor (or secondary constructor) that sets the field to null:
class MyClass() : this(null)
class MyClass(private val fieldName: DepType? = null)

// 3. In method bodies — null guard before the live implementation:
if (fieldName == null) {
    return FallbackClass.staticOrInstanceMethod(param)  // ← mode A (stub/offline/fallback)
}
// ... mode B (live/online) implementation
```

**Variants to detect** (all equivalent in semantics):

| Variant | Example |
|---|---|
| Classic null guard | `if (fieldName == null) return Stubs.resolve(p)` |
| Elvis operator (simple) | `return fieldName?.handle(p) ?: FallbackClass.resolve(p)` |
| Elvis with let | `return fieldName?.let { it.handle(p) } ?: fallback.handle(p)` |
| Boolean flag toggle | `if (!isLive) return fallback.handle(p)` (field set in constructor) |
| Null guard → return empty | `if (fieldName == null) return ResponseType.empty()` |

**Matching conditions** (all must hold):
1. The class has at least one `private` (or `protected`) field whose type is nullable (e.g., `DepType?`) and is a dependency (not a primitive, not `String`, not a value type)
2. A no-arg constructor or default parameter `= null` exists
3. At least one method body contains an `if (field == null)` guard, Elvis operator `?:`, or equivalent boolean toggle
4. The guarded/Elvis branch returns or throws without calling `this.field` — i.e., it is a self-contained alternate path

---

**When matched, annotate the class symbol** with `behavioral_modes`:

```json
{
  "behavioral_modes": [
    {
      "name": "stub",
      "activation": "fieldName == null (no-arg constructor or default null parameter)",
      "description": "Fallback path — does not invoke the injected dependency"
    },
    {
      "name": "live",
      "activation": "fieldName != null (dependency injected via constructor or DI container)",
      "description": "Live path — delegates to the injected dependency"
    }
  ],
  "stub_delegate_class": "com.example.FallbackClass",
  "stub_delegate_methods": ["resolveXxx", "handleYyy"]
}
```

**When matched, annotate each method** that contains the guard:

```json
{
  "behavioral_guard": {
    "field": "fieldName",
    "condition": "fieldName == null (or Elvis ?: branch)",
    "stub_branch": {
      "delegate_class": "com.example.FallbackClass",
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
  "source": "com.example.MyService::myMethod",
  "target": "com.example.FallbackClass::resolveXxx",
  "condition": "fieldName == null",
  "mode": "stub",
  "confidence": "high",
  "source_tool": "kotlin-compiler"
}
```

---

**What to document in the synthesized foundation** (`service-map.md`): The `discovery-code-synthesize` skill reads these annotations from the module profile. When `behavioral_modes` is present on a class, synthesize a **Behavioral Modes** subsection in the Service Map:

```markdown
### Behavioral Modes — MyService

| Mode | Activation | Behavior |
|---|---|---|
| **stub** | `MyService()` — fieldName = null | Delegates to FallbackClass.resolveXxx(param) |
| **live** | `MyService(dep)` — fieldName != null | Real remote call via dep |
```

**Practical note for LLM-assisted resolution** (when the Kotlin compiler is unavailable): read the full source of every class that has a nullable dependency-typed field. For each method, check whether the first meaningful statement is a null-guard or Elvis operator on that field. If yes, extract the delegate class/method and record the annotations above. This takes priority over inferring call chains from signatures alone.

### JSON Wire Name Mapping Pattern

> **Why this matters**: Tree-sitter extracts property names but **not annotation attributes**. A property `additionalData` annotated with `@SerialName("additional_data")` or `@JsonProperty("additional_data")` appears in the symbol graph with only its Kotlin name — the wire key is invisible. Agents writing JSON fixtures from the graph will use `"additionalData"` and get silent `null` deserialization.

**Detection rule**: For each property in each class or data class, check whether a wire-name annotation is present whose value differs from the property name.

**Annotations to detect** (Kotlin):

| Annotation | Library | Example |
|---|---|---|
| `@SerialName("wire_name")` | kotlinx.serialization | `@SerialName("additional_data") val additionalData: String` |
| `@JsonProperty("wire_name")` | Jackson (kotlin-jackson module) | `@JsonProperty("additional_data") val additionalData: String` |

**When matched, annotate the property symbol** with `json_name`:

```json
{
  "name": "additionalData",
  "json_name": "additional_data",
  "annotations": ["@SerialName(\\\"additional_data\\\")"]
}
```

**Emit an edge** of type `JSON_MAPPED_AS`:

```json
{
  "type": "JSON_MAPPED_AS",
  "source": "com.example.MyDto::additionalData",
  "target_key": "additional_data",
  "confidence": "high",
  "source_tool": "kotlin-compiler"
}
```

**What to document in the synthesized foundation**: The `discovery-code-synthesize` skill reads `json_name` field annotations and `JSON_MAPPED_AS` edges. When any property has a differing wire name:
- `data-model.md`: Fields column shows `propName ("wire_name")` with ⚠️
- `api-contracts.md`: Endpoint gains a *Response JSON shape* subsection with wire-format keys
- `framework-api-registry.md`: `### JSON Wire Name Corrections` table added

**LLM fallback note** (when the Kotlin compiler is unavailable): for every data class or response type (name ends in `Response`, `Dto`, `Data`, `Payload`), read each property declaration and look for `@SerialName` or `@JsonProperty`. If found and the annotation value differs from the property name, record `json_name` on the property symbol.

## Guardrails

- **DO NOT modify source code** — read-only analysis
- **Handle missing Kotlin** — warn and fall back to Tree-sitter + LLM
- **Java interop** — Kotlin files may reference Java classes; resolve via imports
- **Performance** — resolve one file at a time
- **Fallback** — if resolution fails, return original symbols unchanged with warning
