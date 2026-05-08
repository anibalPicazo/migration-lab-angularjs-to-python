---
name: discovery-code-synthesize
description: Stage 2 of the static analysis lifecycle. Reads the technical artifacts produced by the pipeline (modules, symbols, graph, api-map) and writes consolidated foundation documents into .foundation/. Run after the full technical pipeline completes successfully.
license: Apache-2.0
compatibility: Requires .discovery/code/modules/<slug>/, .discovery/code/symbols/<slug>/index.json, and .discovery/code/scans/<slug>/scan-manifest.json.
metadata:
  author: discovery-code
  version: "1.0"
---

# Static Code Analysis ? Write Foundation Documents

Synthesize technical pipeline artifacts into consolidated foundation documents written directly to `.foundation/`. This skill is the final stage of the static analysis lifecycle.

## When to Invoke

- After `@discovery-code index` (or `full`, or `pipeline`) completes successfully
- When re-generating foundation docs after re-indexing a module
- When a new module slug is added to the registry

## Prerequisites (all must exist before proceeding)

| Artifact | Path | Produced by |
|---|---|---|
| Scan manifest | `.discovery/code/scans/<slug>/scan-manifest.json` | `discovery-code-scan-repo` |
| Symbol index | `.discovery/code/symbols/<slug>/index.json` | `discovery-code-extract-symbols` |
| Per-file symbols | `.discovery/code/symbols/<slug>/<hash>.json` | `discovery-code-extract-symbols` |
| Module profiles | `.discovery/code/modules/<slug>/*.json` | resolver (e.g., `discovery-code-resolve-angularjs`) |
| API map | `.discovery/code/scans/<slug>/api-map.json` | resolver (if available) |
| Graph edges | `.discovery/code/graph/<slug>/edges.json` | `discovery-code-build-graph` |

? **GATE**: If `.discovery/code/modules/<slug>/` does not exist or is empty, report:
> "Stage 1 resolver output is missing. Run `@discovery-code pipeline <src-dir>` to generate module profiles before writing foundation documents."

## Inputs

| Parameter | Required | Description |
|---|---|---|
| `--slug <slug>` | yes | Module identifier (e.g., `cgt-marcas`) |
| `--framework <name>` | no | Override framework detection (default: auto from scan-manifest) |
| `--overwrite` | no | Overwrite existing foundation docs (default: ask if file exists) |

## Outputs ? Consolidated Foundation Documents

| Document | Path | Data source |
|---|---|---|
| Data Model | `.foundation/data-model.md` | `.discovery/code/symbols/<slug>/index.json` |
| Service Map | `.foundation/service-map.md` | `.discovery/code/scans/<slug>/api-map.json` |
| API Contracts | `.foundation/api-contracts.md` | `.discovery/code/scans/<slug>/api-map.json` |
| Framework Registry | `.foundation/framework-api-registry.md` | `.discovery/code/symbols/<slug>/` + scan-manifest |
| Coding Conventions | `.foundation/coding-conventions.md` | `.discovery/code/modules/<slug>/` + symbol index |

---

## Foundation Document Classification

Every foundation document written by this skill MUST include a classification header immediately after the `# Title` heading (before the `>` blockquote description). This header encodes the document's governance level, scope, and purpose for use by downstream agents and delivery workflows.

### Level Determination Rules

| Rule | Applies when | Level |
|---|---|---|
| A — Slug-specific technical docs | `data-model.md`, `service-map.md`, `api-contracts.md` written for a `--slug` | **3 (Application)** |
| B — Shared registry / convention docs | `framework-api-registry.md`, `coding-conventions.md` (merge-mode, accumulated across modules) | **1 (Global)** |
| C — Domain-wide shared model | Agent has explicit evidence the content describes a cross-application shared model or API | **2 (Domain)** |

### Classification Table

| Document | Default Level | Scope | Category |
|---|---|---|---|
| `data-model.md` | 3 (Application) | Tactical | Technical Architecture |
| `service-map.md` | 3 (Application) | Tactical | Technical Architecture |
| `api-contracts.md` | 3 (Application) | Tactical | API & Contracts |
| `framework-api-registry.md` | 1 (Global) | Tactical | Technical Architecture |
| `coding-conventions.md` | 1 (Global) | Governance | Engineering Standards |

> **Purpose field**: Write 1–2 sentences describing the specific content of this document instance — not a generic description. Include the module slug, what technical aspects are covered, and the primary consumer. Example: *"Entities and DTOs extracted from module `cgt-marcas` via static analysis. Primary reference for WireMock stub construction and JSON wire name validation."*

---

## Steps

### 1. Resolve slug and load artifacts

```bash
# Read slug from argument or registry
cat .discovery/code/registry.json | node -e "const d=require('/dev/stdin'); console.log(JSON.stringify(d.modules, null, 2))"
```

Load all required artifacts:

```bash
cat .discovery/code/scans/<slug>/scan-manifest.json
cat .discovery/code/symbols/<slug>/index.json
ls .discovery/code/modules/<slug>/
cat .discovery/code/scans/<slug>/api-map.json 2>/dev/null || echo "NO API MAP"
cat .discovery/code/graph/<slug>/edges.json 2>/dev/null
```

Collect module profile JSONs:
```bash
for f in .discovery/code/modules/<slug>/*.json; do echo "=== $f ==="; cat "$f"; done
```

### 2. Create output directories

```bash
mkdir -p .foundation
```

### 3. Write `service-map.md` (technical topology section)

**Source**: `.discovery/code/modules/<slug>/*.json` (each file is a per-component profile with `roles`, `di_graph`, `operations`, `call_chains`)

**Structure**:

```markdown
---
version: "1.0"
slug: <slug>
generated_at: <ISO timestamp>
source: discovery-code
---

# Service Map ? <slug>Level: 3 (Application)
Scope: Tactical
Category: Technical Architecture
Purpose: [Describe in 1–2 sentences: which module, what components/DI chains are documented, and for whom this map is primarily useful.]
> Overview of components, dependency injection graph, call chains, and data flow.
> Source: `.discovery/code/modules/<slug>/`

## Components

List each component found in module profiles:

| Component | Role | File | Dependencies |
|---|---|---|---|
| <name> | controller/service/model/view | <relative path> | <comma-separated DI deps> |

## Dependency Injection Graph

For each component, document resolved DI wiring:

```
<ComponentA>
  +-- injects: <ServiceB> (project-local, <path>)
  +-- injects: <ServiceC> (project-local, <path>)
  +-- injects: <PlatformService> (platform)
```

## Operations

List all public operations extracted from module profiles:

| Operation | Type | Component | Call Chain | Endpoint |
|---|---|---|---|---|
| <name> | CRUD/navigation/validation/ui-state | <component> | controller.method ? service.method ? HTTP VERB /url | GET /api/... |

## Call Chains

For each significant operation, document the full delegation chain:

```
<operation>
  controller.<method>
    ? service.<method>
      ? model.<method>
        ? HTTP <VERB> <url_template>
```

## Data Flow Summary

Describe how data moves through the module: entry points ? transformations ? persistence/API.

## ?? Sources

- `.discovery/code/modules/<slug>/` ? per-component profiles (resolver output)
- `.discovery/code/graph/<slug>/edges.json` ? relationship graph
```

### 4. Write `data-model.md`

**Source**: `.discovery/code/symbols/<slug>/index.json` ? filter symbols by kind: `class-declaration`, `interface-declaration`, `schema_type`, `api_response_schema`, `enum_value`

**Structure**:

```markdown
---
version: "1.0"
slug: <slug>
generated_at: <ISO timestamp>
source: discovery-code
---

# Data Model ? <slug>Level: 3 (Application)
Scope: Tactical
Category: Technical Architecture
Purpose: [Describe in 1–2 sentences: which module, what entity types are covered, and the primary use case (e.g., WireMock stubs, field-level JSON wire name validation).]
> Entities, DTOs, API response schemas, enumerations, and validations extracted from code.
> Source: `.discovery/code/symbols/<slug>/index.json`

## Entities and Classes

For each class/interface found in symbols:

| Name | Kind | File | Fields / Properties | Notes |
|---|---|---|---|---|
| <ClassName> | class/interface | <path> | field1 (`json:"wire_name"`), field2 | extends X, implements Y |

> **`@JsonProperty` rule**: If the resolver produced `json_name` annotations on any field, the Fields column MUST show both the Java name and the wire name: `javaFieldName ("wire_name")`. Add a ⚠️ note when they differ. This is critical for WireMock stubs — using the Java camelCase name in JSON bodies causes silent `null` deserialization.

## API Response Schemas

For each `api_response_schema` symbol (from JSON mock files):

| Schema | File | Top-level Keys | Nested Objects |
|---|---|---|---|
| <name> | <path> | key1, key2 | nested.key3 |

## Enumerations and Constants

For each `enum_value` symbol:

| Name | Value | File |
|---|---|---|
| <key> | <value> | <path> |

## i18n Keys (if present)

Total translation keys: N
Key namespaces: namespace1, namespace2, ...

## Validation Rules

Document validation patterns found in HTML forms (from `VALIDATION` kind symbols):

| Field | Rules | Component |
|---|---|---|
| <field> | required, maxlength=50, pattern=... | <component> |

## ?? Sources

- `.discovery/code/symbols/<slug>/index.json` ? consolidated symbol index
- `.discovery/code/symbols/<slug>/*.json` ? per-file symbols (classes, interfaces, schemas)
```

### 5. Write `service-map.md`

**Source**: `.discovery/code/scans/<slug>/api-map.json` (primary) + `.discovery/code/modules/<slug>/` DI graphs (secondary)

**Structure**:

```markdown
---
version: "1.0"
slug: <slug>
generated_at: <ISO timestamp>
source: discovery-code
---

# Service Map ? <slug>Level: 3 (Application)
Scope: Tactical
Category: Technical Architecture
Purpose: [Describe in 1–2 sentences: which module, what services/endpoints are documented, and who consumes this map.]
> Service topology, dependencies, platform integrations, and HTTP API map.
> Source: `.discovery/code/scans/<slug>/api-map.json`

## Service Topology

```
<ModuleName>
  +-- Controllers: <ControllerA>, <ControllerB>
  +-- Services:    <ServiceA>, <ServiceB>
  +-- Models:      <ModelA>, <ModelB>
  +-- Views:       <view-a.html>, <view-b.html>
```

## Service Responsibilities

For each project-local service:

| Service | Responsibilities | Injects | Called By |
|---|---|---|---|
| <ServiceA> | <what it does> | <dependencies> | <callers> |

## Platform / External Services

| Platform Service | Used For | Methods Called |
|---|---|---|
| <T3_HTTPService> | HTTP communication | get(), post(), put(), delete() |
| <OtherPlatform> | <purpose> | <methods> |

## HTTP API Map

Summary of all HTTP endpoints called:

| Method | URL Template | Service | Operation |
|---|---|---|---|
| GET | /api/... | <service> | <operation-name> |
| POST | /api/... | <service> | <operation-name> |

## ?? Sources

- `.discovery/code/scans/<slug>/api-map.json` ? HTTP endpoint map extracted from code
- `.discovery/code/modules/<slug>/` ? DI graphs and component profiles
```

### 6. Write `api-contracts.md`

**Source**: `.discovery/code/scans/<slug>/api-map.json` ? detailed endpoint definitions with path params, headers, response handling

**Structure**:

```markdown
---
version: "1.0"
slug: <slug>
generated_at: <ISO timestamp>
source: discovery-code
---

# API Contracts ? <slug>Level: 3 (Application)
Scope: Tactical
Category: API & Contracts
Purpose: [Describe in 1–2 sentences: which module, how many endpoints are documented, and the primary consumer (e.g., WireMock stub generation, integration testing).]
> Endpoints and contracts extracted from source code via static analysis.
> Source: `.discovery/code/scans/<slug>/api-map.json`

## Endpoints

For each endpoint in the api-map:

---

### `<HTTP METHOD> <url_template>`

| Property | Value |
|---|---|
| **Method** | GET / POST / PUT / DELETE |
| **URL** | `/api/v1/resource/{param}` |
| **Path params** | `param` ? description |
| **Headers** | `Content-Type: application/json` |
| **Called from** | `<service>.<method>` ? `<model>.<method>` |
| **Operation** | `<operation-name>` |
| **Response handling** | success: ..., error: ... |
| **Confidence** | high (deterministic) |
> **`@JsonProperty` / wire name rule**: For every response type, check whether the resolver produced `JSON_MAPPED_AS` edges or `json_name` field annotations. If any field has a wire name that differs from its Java name, add a **Response JSON shape** subsection showing the actual JSON keys (wire format). Mark any field where camelCase ≠ snake_case with ⚠️. This is essential for WireMock stubs — agents writing raw JSON bodies must use wire names, not Java names.
>
> **SecurityConfig gap notice**: Static analysis of a library module (e.g., `backlib-mockup`) cannot detect whether the **consuming application** has configured Spring Security. If the scanned module is a library and the scan manifest indicates Spring Boot + Spring Security on the classpath, add a note in the `## Notes` section of `api-contracts.md`:
> ```
> ⚠️ Consuming application must declare SecurityConfig (CSRF disabled, STATELESS session).
> Without it, all POST/PUT/DELETE endpoints return HTTP 403. See architecture-decisions.md §ADR-008.
> ```
---

## Summary Table

| Method | URL | Service | Confidence |
|---|---|---|---|
| GET | /api/... | <service> | high |

## ?? Sources

- `.discovery/code/scans/<slug>/api-map.json` ? extracted endpoint definitions
- Confidence level: **high** (Tree-sitter + resolver, 96.7% deterministic)
```

### 7. Write `framework-api-registry.md`

**Source**: `scan-manifest.json` (frameworks, dependencies) + `.discovery/code/symbols/<slug>/` (actual usage patterns)

?? **Idempotency**: If `.foundation/framework-api-registry.md` already exists, **merge** new entries ? do not overwrite existing content from other modules. Add a module-specific section.

**What to look for beyond direct framework imports:**
- **Library service classes** (`@Service`, `@Component`) → document every public service with: correct fully-qualified package name, available method signatures (with parameter types and return type), and at least one usage example. Pay special attention to classes with names that could be confused (e.g., `getDatetime()` not `getDateTime()`). **Generate a dedicated `R-N` section for every platform service with more than 2 method overloads** (e.g., `TaskService`, `CaseManagementService`) listing all signatures → these are the most error-prone services.
- **Static utility classes** (detected via `@UtilityClass` annotation, `static` methods, or class name ending in `Utils`) → document their static method signatures and usage pattern, especially those that simplify multi-step operations (e.g., `AdditionalDataUtils.parseForm()`). **Never generate a `@Mock` annotation for these in test templates** → mark them as static helpers that do not require injection or mocking.
- **`@JsonProperty` field mappings** → for every class symbol that has fields annotated with `@JsonProperty("wire_name")` (surfaced by the Java resolver as `json_name`), add a `### JSON Wire Name Corrections` table to the framework registry with columns `Class | Java field | JSON key (wire format)`. This table is critical for WireMock stubs and manual JSON fixtures — using the Java camelCase name causes silent `null` deserialization. Mark rows where the Java name ≠ wire name with a ⚠️.
- **Package correction table** → after documenting all classes, produce a consolidated "Key Classes → Package Corrections Summary" table listing every key class with its CORRECT fully-qualified package alongside the most common incorrect packages. This table is the highest-ROI section because it prevents compilation failures at gen-time.
- **API Corrections table** → after building the package table, scan the ingested architecture guides (`.discovery/runtime/ingested/`) for mentions of renamed fields, changed method names, or version-to-version API differences (look for `@Deprecated`, "renamed to", "changed from", "was previously", "correction", or explicit version-diff tables). Produce a `## Correcciones de API Documentadas` section with a ✅/❌ table for every detected API change. This section is critical because it prevents delivery agents from using stale field/method names from older documentation fragments.
- **R-T2: RestClient mock chain** → scan all `@Service` classes under `component/` directories for constructor injection of `RestClient` (signature: `private final RestClient restClient;` or `RestClient restClient` constructor param). For each such service, generate a sub-section `R-T2: Test Patterns → Mocking RestClient in Component Unit Tests` in `framework-registry.md` documenting: (a) the required `@Mock` declarations (`RestClient`, `RestClient.RequestHeadersUriSpec<?>`, `RestClient.ResponseSpec`), (b) the `@BeforeEach` mock chain wiring (`restClient.get()` → `uri()` → `retrieve()`), (c) a happy path test stub, (d) an error path stub, and (e) the ❌ wrong patterns that cause NPE. If multiple component services use RestClient, document the pattern once with a generic example.

**Structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-code
---

# Framework Registry
Level: 1 (Global)
Scope: Tactical
Category: Technical Architecture
Purpose: [Describe in 1–2 sentences: which frameworks/libraries are documented, which modules have contributed entries, and the primary use case (e.g., preventing incorrect API usage during code generation).]

> Approved libraries, their versions, and correct usage patterns extracted from source code.
> Updated by `@discovery-code` as each module is analyzed.

## Core Framework

| Library | Version | Purpose | Source |
|---|---|---|---|
| <framework> | <version from package.json/pom.xml> | <role> | `<manifest file>` |

## Module: <slug>

Libraries actually used in this module (imports observed in symbols):

| Library | Import Pattern | Used For | Example |
|---|---|---|---|
| <lib> | `import { X } from '<lib>'` | <purpose> | `<usage snippet>` |

### Platform Services

External/platform services injected in this module:

| Service | Methods Used | Purpose |
|---|---|---|
| <PlatformService> | method1(), method2() | <purpose> |

### Static Utility Classes

Utility classes with static methods that the consuming project calls directly (no injection):

| Class | Package | Key Method | Purpose |
|---|---|---|---|
| `<UtilityClass>` | `<full.package>` | `staticMethod(params)` | <what it does> |

### Package Corrections ? Summary

Summary table of all key library classes with correct and common-incorrect packages:

| Class | Correct Package | Common Error |
|---|---|---|
| `<ServiceClass>` | `<correct.package>` | `<incorrect.package>` |

### Correcciones de API Documentadas

Explicit version-to-version API changes extracted from ingested guides and code annotations. Agents MUST check this table against any legacy code fragment before generating code.

| Elemento | ? Incorrecto (obsoleto) | ? Correcto (versi?n actual) | Impacto |
|---|---|---|---|
| `<Class>.builder()` field | `.<oldName>(...)` | `.<newName>(...)` | Compilaci?n bloqueante |
| `<Class>` default status | `<OLD_STATUS>` | `<CORRECT_STATUS>` | Error en runtime |

> ?? If no explicit version corrections are found in ingested guides or `@Deprecated` annotations, write: `?? No API corrections documented ? validate manually against library changelog`

### R-T2: Test Patterns ? Mocking RestClient in Component Unit Tests

> Generate this section only if at least one `@Service` in the `component/` directory receives `RestClient` via constructor injection.

Component services receive a pre-built `RestClient` via constructor injection. In unit tests with `@ExtendWith(MockitoExtension.class)`, the call chain must be stubbed mock-by-mock.

**Required `@Mock` declarations:**
```java
@Mock RestClient restClient;
@Mock RestClient.RequestHeadersUriSpec<?> requestSpec;
@Mock RestClient.ResponseSpec responseSpec;
```

**`@BeforeEach` wiring:**
```java
@BeforeEach
void setUp() {
    when(restClient.get()).thenReturn((RestClient.RequestHeadersUriSpec) requestSpec);
    when(requestSpec.uri(any(String.class), any(Object[].class))).thenReturn(requestSpec);
    when(requestSpec.retrieve()).thenReturn(responseSpec);
}
```

**Happy path stub:**
```java
when(responseSpec.body(<ResponseClass>.class)).thenReturn(expectedResponse);
```

**Error path stub:**
```java
when(responseSpec.body(<ResponseClass>.class))
    .thenThrow(new <AppException>("<ERROR_CODE>"));
```

**? Wrong patterns (cause NPE):**
```java
// ? Returning null from get()
when(restClient.get()).thenReturn(null);
// ? Not wiring uri() ? NPE on .retrieve()
when(requestSpec.uri(...)).thenReturn(null);
```

## ?? Sources

- `.discovery/code/scans/<slug>/scan-manifest.json` ? framework detection
- `.discovery/code/symbols/<slug>/index.json` ? import statements and usage patterns
```

### 8. Write `coding-conventions.md`

**Source**: `.discovery/code/modules/<slug>/` ? naming patterns detected in component profiles, file structure from scan-manifest

?? **Idempotency**: If `.foundation/coding-conventions.md` already exists, **add a module-specific section** ? do not overwrite. Cross-check new findings with existing content and add only what differs or extends.

**Structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-code
---

# Coding Conventions
Level: 1 (Global)
Scope: Governance
Category: Engineering Standards
Purpose: [Describe in 1–2 sentences: which modules have contributed conventions, what naming/structural patterns are documented, and for whom this document is the authoritative reference.]

> Naming, package structure, style, and DI patterns observed in source code via static analysis.
> Updated by `@discovery-code` as each module is analyzed.

## Module: <slug>

### File Structure

```
<module-root>/
  +-- <component>Controller.js   ? controllers
  +-- <component>Service.js      ? services
  +-- <component>Model.js        ? models
  +-- <component>.html           ? views
  +-- i18n/                      ? translation files
```

### Naming Patterns

Observed in this module's symbol index:

| Element | Pattern | Example |
|---|---|---|
| Controllers | `<Feature>Controller` | `SelectMarkCategoriesController` |
| Services | `<Feature>Service` | `MarksService` |
| Models | `<Feature>Model` | `MarksModel` |
| Scope methods | `camelCase` | `$scope.deleteCategory` |
| API URLs | `/api/v1/<resource>/{id}` | `/api/v1/marks/{id}` |

### Dependency Injection Pattern

```javascript
// Constructor-style DI (detected from di_graph)
.controller('ExampleCtrl', ['$scope', 'ServiceA', 'ServiceB',
  function($scope, ServiceA, ServiceB) { ... }
])
```

### Error Handling Pattern

Observed across operations in module profiles:
- Success path: `<pattern>`
- Error path: `<pattern>`

## ?? Sources

- `.discovery/code/modules/<slug>/` ? component profiles with DI graphs and naming data
- `.discovery/code/symbols/<slug>/index.json` ? symbol names and file structure
```

---

## Step 9 (additional): Enrich `architecture/anti-patterns.md` from graph analysis

?? **This step runs after the main documents are written.** It uses the call graph to detect behavioural anti-patterns that documentation alone cannot reliably capture. It extends `.foundation/anti-patterns.md` (merge mode ? never overwrite existing entries).

### 9.1 Detect AP: Business Logic in Controller

**Source**: `.discovery/code/graph/<slug>/edges.json` ? filter `CALLS` edges where the **source** symbol's file path contains `/controller/` and the **target** symbol belongs to a service-layer class (`ExtendedCaseService`, `ErrorInformationService`, `ObjectMapper`, or any `@Service` bean that is **not** a task-service registered to that controller).

```bash
# Pseudo-query over edges.json
cat .discovery/code/graph/<slug>/edges.json | node -e "
  const edges = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
  const violations = edges.filter(e =>
    e.type === 'CALLS' &&
    e.source_file && e.source_file.includes('/controller/') &&
    (e.target.includes('extendedCaseService') ||
     e.target.includes('ObjectMapper') ||
     e.target.includes('errorInformationService'))
  );
  console.log(JSON.stringify(violations, null, 2));
"
```

**If violations are found**: Add or verify that `anti-patterns.md` contains an entry equivalent to:

```markdown
## AP-XXX ? Business Logic in Controller

**Context**: When implementing a `@RestController` that directly invokes business library services.
**Why it is forbidden**: The controller is the HTTP entry point. Its sole responsibility is to extract parameters and delegate. Calling `ExtendedCaseService`, `ObjectMapper`, or `ErrorInformationService` directly from the controller couples layers, hinders unit testing, and violates the single responsibility principle.

? **Incorrect**: The controller accesses `extendedCaseService.getAdditionalData(...)` directly.

? **Correct**: The controller calls `{TaskName}Service.{method}(caseId)` and the service handles the logic.

**Detection**:
```bash
grep -rn "extendedCaseService\|objectMapper\|errorInformationService" src/main/java/*/controller/
```
```

**If no violations are found**: Still add the entry if the codebase has controllers and services ? the absence of the pattern in the current code does not mean future code will comply.

---

### 9.2 Detect AP: Missing Error Registration (catch without saveErrors)

**Source**: `.discovery/code/symbols/<slug>/index.json` ? filter symbols of kind `catch_block` or `method` inside `/service/` files, then cross-check with `CALLS` edges to verify that every `catch` block that re-throws has a preceding `CALLS` edge to `saveErrors`.

```bash
# Simpler heuristic: grep the source files directly
grep -rn "catch" vault/input/src/<slug>/src/main/java/*/service/ | grep -v "saveErrors"
```

**If violations are found or the pattern is not yet documented**: Add or verify that `anti-patterns.md` contains an entry equivalent to:

```markdown
## AP-XXX ? Missing Error Registration in Exception Pattern

**Context**: When implementing the `try/catch` block in a `{TaskName}Service`.
**Why it is forbidden**: If the exception is rethrown without calling `ErrorInformationService.saveErrors()`, Form 4 of the Extended Case is not updated and the Process Manager cannot handle the failure.

? **Incorrect**:
```java
} catch ({AppFrameworkException} e) {
    throw e;  // ? No error registration
}
```

? **Correct** ? double-catch pattern (adapt to the project's exception class and registration method):
```java
} catch ({AppFrameworkException} e) {
    {errorRegistrationService}.{saveErrorMethod}(caseId, e, TASK_CONFIG);
    throw e;
} catch (Exception e) {
    var appEx = new {AppFrameworkException}("ERROR_TASK", e);
    {errorRegistrationService}.{saveErrorMethod}(caseId, appEx, TASK_CONFIG);
    throw appEx;
}
```

> Replace `{AppFrameworkException}` with the project's base exception class, and `{errorRegistrationService}.{saveErrorMethod}` with the project's actual error-registration service and method, as detected from the ingested architecture guides or symbol index.

**Detection**:
```bash
grep -A 5 "catch.*{AppFrameworkException}\|catch.*Exception" src/main/java/*/service/ | grep -v "{saveErrorMethod}"
```
```

---

### 9.3 After anti-patterns enrichment

Report whether entries were added or already present:
```
? anti-patterns.md enriched from graph analysis:
  AP-014 (Business Logic in Controller): added / already present
  AP-015 (Missing Error Registration): added / already present
```

---

## After Each Document

After writing each document:
1. Confirm the file exists: `ls .foundation/` or `ls .foundation/`
2. Report: "? Written: `.foundation/service-map.md` (N lines)"

---

## Final Report

```
? Foundation documents written for <slug>


  ? framework-api-registry.md  (merged ? N lines total)
  ? coding-conventions.md      (merged ? N lines total)
  ? anti-patterns.md           (graph-enriched ? AP-014, AP-015 verified)
  ? data-model.md              (N lines)
  ? service-map.md             (N lines)
  ? api-contracts.md           (N lines)

All 6 documents + anti-patterns enrichment ready for @delivery.
```

---

## Guardrails

- **Always include a `?? Sources` section** in every document, linking back to the exact `.discovery/code/` artifacts used
- **Do not invent data** ? every field in foundation docs must trace to an artifact. If data is missing, write `?? Not detected ? requires manual input` in that field
- **Confidence propagation**: If the source artifact has `confidence: "medium"` or `"low"`, annotate the corresponding section with `?? confidence: medium ? verify manually`
- **Foundation docs are shared** ? use merge mode for `framework-api-registry.md`, `coding-conventions.md`, and `anti-patterns.md`; never destructive overwrite
- **Versioned frontmatter** is mandatory on every document ? always set `version: "1.0"` and `generated_at`
