---
name: discovery-code-resolve-java
description: Semantic resolver for Java. Enriches Tree-sitter symbols with real type resolution, inheritance chains, and overload detection using JavaParser.
license: Apache-2.0
compatibility: Requires .discovery/code/symbols/ with Tree-sitter output. Installs JavaParser on demand.
metadata:
  author: discovery-code
  version: "1.0"
---

# Resolver — Java

Enriches Tree-sitter symbols with **real type resolution** using **JavaParser**. Resolves full type hierarchies, annotation semantics, and overload dispatch.

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
      resolver: "javaparser"
      version: "<installed version>"
      confidence: "high"
      source: "resolver"
```

## Steps

### 1. Check tool availability

Check if Java and JavaParser are available:

```bash
java -version 2>&1 | head -1
```

If Java is available, check for JavaParser JAR:
```bash
ls .discovery/code/tools/javaparser-resolve.jar 2>/dev/null && echo "OK" || echo "NOT INSTALLED"
```

If NOT INSTALLED, guide download:
```bash
mkdir -p .discovery/code/tools
# Download JavaParser standalone JAR (symbol solver included)
curl -L "https://repo1.maven.org/maven2/com/github/javaparser/javaparser-symbol-solver-core/3.25.8/javaparser-symbol-solver-core-3.25.8.jar" \
  -o .discovery/code/tools/javaparser-resolve.jar
```

Alternatively, if the project uses Maven or Gradle, leverage the existing build tool:
```bash
# Maven project
ls pom.xml 2>/dev/null && echo "MAVEN"
# Gradle project
ls build.gradle* 2>/dev/null && echo "GRADLE"
```

### 2. Receive input

Read the Tree-sitter symbols for this file. Key symbols to enrich:
- `import_declaration` → resolve to actual type in classpath
- `method_invocation` → resolve to actual method declaration (overload resolution)
- `class_declaration` → resolve extends/implements chains
- `object_creation_expression` → resolve constructor
- `annotation` → resolve to annotation type and extract metadata

### 3. Run resolver

Create or use `.discovery/code/tools/java-resolve.js` — a Node.js script that shells out to JavaParser:

```javascript
const { execSync } = require("child_process");
const fs = require("fs");

const filePath = process.argv[2];
const treeSymbols = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

// Use JavaParser via command line or build tool integration
// For Maven projects, use mvn dependency:tree for resolution context
const result = {
  enriched_symbols: [],
  additional_edges: [],
};

// Parse the Java source and resolve types
// JavaParser + Symbol Solver provides:
// - Full type resolution for variables, parameters, return types
// - Method overload resolution
// - Inheritance chain resolution
// - Annotation semantic extraction

console.log(JSON.stringify(result, null, 2));
```

For a more practical approach, use **LLM-assisted resolution** when JavaParser setup is complex:
1. Read the file source
2. For each Tree-sitter symbol that needs enrichment, ask LLM to resolve the type using project context
3. Cross-reference with `import` statements and project classpath

### 4. Enrich symbols

For each Tree-sitter symbol, merge resolver data:

- **Classes**: add `extends_resolved` (fully qualified name → actual source file), `implements_resolved`
- **Methods**: add `parameter_types_resolved`, `return_type_resolved`, `overrides` flag
- **Fields**: add `type_resolved` (fully qualified type)
- **Imports**: mark as `static` or `wildcard`, resolve to actual class
- **Annotations**: extract `@RequestMapping("/path")` → endpoint metadata, `@Autowired` → injection target

### 5. Emit additional edges

| Edge type | What it captures |
|-----------|-----------------|
| `INHERITS` | `extends` resolved to actual class file |
| `IMPLEMENTS` | `implements` resolved to actual interface file |
| `OVERRIDES` | Methods matching parent signatures |
| `CALLS` | Method invocations resolved across files (overload-aware) |
| `USES_TYPE` | Field types, parameter types, return types → actual declarations |
| `INJECTS` | `@Autowired` / `@Inject` → target bean class |

### 6. Return output

Standard resolver output with `resolver: "javaparser"`.

## What This Resolver Sees That Tree-sitter Cannot

| Scenario | Tree-sitter | JavaParser |
|----------|-------------|------------|
| `import com.example.*` | Knows wildcard import | Resolves which classes are actually used |
| `foo.bar()` | Sees method call | Resolves `foo` type → `UserService`, `bar` → specific overload |
| `class A extends B` | Knows `B` is name | Resolves `B` to `com.example.base.BaseService` |
| `@Autowired UserService svc` | Sees annotation + field | Knows injection target, bean scope |
| `List<User> users` | Sees raw declaration | Resolves `User` to `com.example.model.User` |
| `if (dep == null) return Stub.resolve(p)` in method body | Sees call edge to `Stub` — no indication it's conditional | Detects null-field guard → annotates `behavioral_modes` on class + emits `CONDITIONAL_DELEGATES_TO` edge |
| `@JsonProperty("additional_data") private String additionalData` | Sees field `additionalData` only | Reads annotation value → records `json_name: "additional_data"` + emits `JSON_MAPPED_AS` edge |

## Framework-Specific Enrichment

If scan manifest indicates **Spring Boot**:
- Map `@RestController` + `@RequestMapping` → HTTP endpoint metadata
- Map `@Service`, `@Repository`, `@Component` → bean lifecycle
- Map `@Autowired` → dependency injection edges

If scan manifest indicates **JPA/Hibernate**:
- Map `@Entity`, `@Table` → data model relationships
- Map `@ManyToOne`, `@OneToMany` → entity relationship edges

### Conditional Null-Field Delegation Pattern (Behavioral Modes)

> **Why this matters**: Tree-sitter extracts method signatures and call edges but **not the conditional logic inside method bodies**. A class that behaves differently depending on whether an injected field is `null` will appear in the graph as a normal caller of the delegate — with no indication that the delegation is conditional, that two distinct modes exist, or that a simpler construction path activates them. This leads to synthesized docs that silently omit behavioral modes and leave consuming agents unaware of design-time options (e.g., stub mode for tests/local dev).

**This pattern is language-agnostic** (null-field guard appears in Java, Kotlin, C#, TypeScript, Go, Python, etc.) but this resolver handles the Java form.

---

**Detection rule**: After Tree-sitter extraction, scan each class for the following structure:

```java
// 1. Field declared at class level — any injectable or dependency type:
private final DepType fieldName;

// 2. No-arg constructor that sets the field to null (directly or via delegation):
public MyClass() { this(null); }
public MyClass(DepType dep) { this.fieldName = dep; }

// 3. In method bodies — null guard before the live implementation:
if (fieldName == null) {
    return FallbackClass.staticOrInstanceMethod(param);  // ← mode A (stub/offline/fallback)
}
// ... mode B (live/online) implementation
```

**Variants to detect** (all equivalent in semantics):

| Variant | Example |
|---|---|
| Null guard → static delegate | `if (dep == null) return Stubs.resolve(p);` |
| Null guard → instance delegate | `if (dep == null) return fallback.handle(p);` |
| Null guard → return empty/default | `if (dep == null) return ResponseType.empty();` |
| Null guard → throw exception | `if (dep == null) throw new UnsupportedOperationException();` |
| Boolean flag toggle | `if (!liveMode) return fallback.handle(p);` (field set in constructor) |

**Matching conditions** (all must hold):
1. The class has at least one `private` (or `protected`) field whose type is a dependency (not a primitive, not `String`, not a value type)
2. A no-arg constructor exists (or a constructor that accepts `null` as the field value)
3. At least one method body contains an `if (field == null)` guard (or `null == field`, `!isLive`, equivalent boolean)
4. The guarded branch returns or throws without calling `this.field` — i.e., it is a self-contained alternate path

---

**When matched, annotate the class symbol** with `behavioral_modes`:

```json
{
  "behavioral_modes": [
    {
      "name": "stub",
      "activation": "fieldName == null (no-arg constructor)",
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
    "condition": "fieldName == null",
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
  "source_tool": "javaparser"
}
```

---

**What to document in the synthesized foundation** (`service-map.md`): The `discovery-code-synthesize` skill reads these annotations from the module profile. When `behavioral_modes` is present on a class, synthesize a **Behavioral Modes** subsection in the Service Map:

```markdown
### Behavioral Modes — MyService

| Mode | Activation | Behavior |
|---|---|---|
| **stub** | `new MyService()` — fieldName = null | Delegates to FallbackClass.resolveXxx(param) |
| **live** | `new MyService(dep)` — fieldName != null | Real remote call via dep |
```

**Practical note for LLM-assisted resolution** (when JavaParser is unavailable): read the full source of every class that has a dependency-typed field. For each method, check whether the first meaningful statement is a null-guard on that field. If yes, extract the delegate class/method and record the annotations above. This takes priority over inferring call chains from signatures alone.

### JSON Wire Name Mapping Pattern

> **Why this matters**: Tree-sitter extracts field names but **not annotation attributes**. A field `additionalData` annotated with `@JsonProperty("additional_data")` appears in the symbol graph with only its Java name — the wire key is invisible. Agents writing WireMock stubs or raw JSON fixtures from the graph will use `"additionalData"` and get silent `null` deserialization.

**Detection rule**: For each field in each class, check whether a wire-name annotation is present whose value differs from the field name.

**Annotations to detect** (Java / Jackson):

| Annotation | Behavior | Example |
|---|---|---|
| `@JsonProperty("wire_name")` | Serialize + deserialize rename | `@JsonProperty("additional_data") private String additionalData;` |
| `@JsonAlias("wire_name")` | Deserialize-only alias | `@JsonAlias("add_data") private String additionalData;` |

**When matched, annotate the field symbol** with `json_name`:

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
  "source": "com.example.MyDto::additionalData",
  "target_key": "additional_data",
  "confidence": "high",
  "source_tool": "javaparser"
}
```

**What to document in the synthesized foundation**: The `discovery-code-synthesize` skill reads `json_name` field annotations and `JSON_MAPPED_AS` edges. When any field has a differing wire name:
- `data-model.md`: Fields column shows `fieldName ("wire_name")` with ⚠️
- `api-contracts.md`: Endpoint gains a *Response JSON shape* subsection with wire-format keys
- `framework-api-registry.md`: `### JSON Wire Name Corrections` table added

**LLM fallback note** (when JavaParser is unavailable): for every class that appears to be a DTO or response type (name ends in `Response`, `Dto`, `Data`, `Payload`, or is returned by a controller method), read each field declaration and look for `@JsonProperty` or `@JsonAlias`. If found and the annotation value differs from the field name, record `json_name` on the field symbol. Critical when Java camelCase ≠ JSON snake_case.

## Guardrails

- **DO NOT modify source code** — read-only analysis
- **Handle missing Java** — if Java not installed, warn and return Tree-sitter symbols unchanged
- **Classpath issues** — if resolution fails for some types (missing dependencies), resolve what you can
- **Performance** — resolve one file at a time, not the entire project
- **Fallback** — if JavaParser fails, return original symbols with a note about what couldn't be resolved
