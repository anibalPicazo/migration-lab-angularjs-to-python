---
name: discovery-code-create-resolver
description: "Meta-skill: guides the creation of a new framework-specific resolver tool from scratch. Covers discovery of framework patterns, Tree-sitter AST analysis, resolver code generation, integration with the pipeline, and validation. Use when a project uses a framework that has no existing resolver."
license: Apache-2.0
compatibility: Requires Node.js, tree-sitter, and the pipeline tools (ts-parse.js, batch-extract-all.js, build-graph.js, pipeline.js).
metadata:
  author: discovery-code
  version: "1.0"
---

# Meta-Skill — Create a Framework Resolver

This skill guides you through **creating a new framework-specific resolver** from scratch. A resolver is a deterministic tool that enriches Tree-sitter symbols with framework-specific semantic knowledge that Tree-sitter alone cannot provide.

## When to Use

- The project uses a framework that has **no existing resolver** in `.discovery/code/tools/*-resolve.js`
- The pipeline runs but produces **0 endpoints, 0 call chains, or 0 resolver edges**
- The project uses framework conventions (DI, decorators, routing, state management) that Tree-sitter parses structurally but cannot interpret semantically

## What a Resolver Does

Tree-sitter extracts **structural** symbols:
- Here's a function called `getUser`
- Here's a call expression calling `this.service.fetch()`
- Here's a string `'/api/users'`

A resolver adds **semantic** meaning:
- `getUser` is a **controller action** that handles GET requests
- `this.service.fetch()` **delegates** to `UserService.fetch()` which makes an **HTTP GET** to `/api/users`
- The full chain is: `route '/users' → UserController.getUser → UserService.fetch → HTTP GET /api/users`

## Universal Resolver Contract

⛔ **MANDATORY** — Every resolver MUST follow this exact interface:

### Input (read from filesystem)

```
.discovery/code/scan-manifest.json    ← project metadata, frameworks, file list
.discovery/code/symbols/index.json    ← consolidated symbol index (all files)
.discovery/code/symbols/*.json        ← per-file symbol JSONs from Tree-sitter
```

### Output (write to filesystem)

```
.discovery/code/modules/<module>.json          ← per-module semantic profile (operations, call chains, API map)
.discovery/code/graph/resolver-edges.json      ← additional edges (DELEGATES, INJECTS, HTTP_CALL, NAVIGATES, etc.)
.discovery/code/resolver-report.json           ← summary statistics
```

### Module Profile Schema

Each `<module>.json` MUST contain:

```json
{
  "module": "<module-name>",
  "path": "<relative-path>",
  "roles": {
    "<file-role>": { "file": "<path>", "symbols": <N> }
  },
  "di_graph": {
    "injected": ["dep1", "dep2"],
    "resolved": { "dep1": { "type": "project-service", "file": "..." } }
  },
  "operations": [
    {
      "name": "<operation-name>",
      "type": "<classification>",
      "source": { "file": "...", "line": N },
      "chain": ["controller.method → service.method → model.method → HTTP VERB /url"],
      "endpoint": {
        "http_method": "GET|POST|PUT|DELETE",
        "url_template": "/api/...",
        "path_params": ["id"],
        "headers": {}
      },
      "error_handling": { "detected": true|false },
      "classification": "CRUD-read|CRUD-write|navigation|validation|...",
      "behavioral_guard": {
        "field": "fieldName",
        "condition": "fieldName == null / !this.fieldName / s.dep == nil",
        "stub_branch": { "delegate_class": "FallbackClass", "delegate_method": "resolve" },
        "live_branch": "invokes this.fieldName.remoteCall(param)"
      }
    }
  ],
  "api_endpoints": [...],
  "call_chains": [...],
  "behavioral_modes": [
    { "name": "stub", "activation": "field == null/nil/undefined", "description": "Fallback path — does not invoke the injected dependency" },
    { "name": "live", "activation": "field != null", "description": "Live path — delegates to the injected dependency" }
  ],
  "stub_delegate_class": "FallbackClass",
  "json_wire_names": [
    { "property": "additionalData", "json_name": "additional_data" }
  ]
}
```

### Resolver Edges Schema

Each edge in `resolver-edges.json`:

```json
{
  "source": "<symbol-id>",
  "target": "<symbol-id>",
  "type": "DELEGATES|INJECTS|HTTP_CALL|NAVIGATES|GUARDS|PIPES|INTERCEPTS|CONDITIONAL_DELEGATES_TO|JSON_MAPPED_AS",
  "confidence": "high|medium|low",
  "source_info": "resolver",
  "metadata": { "resolver": "<resolver-name>", "step": "<which-step>" }
}
```

**Additional edge types** introduced by conditional behavior and wire name patterns:

| Type | When to emit |
|------|--------------|
| `CONDITIONAL_DELEGATES_TO` | Method with null/nil-guard that delegates to a fallback class **only when** the injected field is null/nil/undefined. Add `condition` and `mode` (stub/live) fields to the edge. |
| `JSON_MAPPED_AS` | Property/field with annotation that changes the name in the wire format (`@JsonProperty`, struct tag `` `json:"..."` ``, `@Expose({ name })`). The `target` is the wire key (`target_key`), not a symbol-id. |

---

## Step-by-Step: Creating a New Resolver

### Phase 1 — Discover Framework Patterns (READ-ONLY)

Before writing any code, analyze the project's source to understand what patterns exist.

#### 1.1 Run the pipeline WITHOUT a resolver

```bash
node .discovery/code/tools/pipeline.js "<src-dir>" --skip-resolve --clean
```

This produces Tree-sitter symbols only. Now examine what Tree-sitter extracted:

```bash
# How many symbols, what kinds?
node -e "
  const idx = require('./.discovery/code/symbols/index.json');
  const kinds = {};
  idx.symbols.forEach(s => { kinds[s.kind] = (kinds[s.kind]||0)+1; });
  console.table(kinds);
"
```

#### 1.2 Identify framework-specific symbol kinds

Look at what Tree-sitter already captured vs. what it missed. Key questions:

| Question | How to check | What it tells you |
|----------|-------------|-------------------|
| How does the framework register components? | Search for `angular.module`, `@Component`, `@Injectable`, `createApp`, `@SpringBootApplication` | Registration/wiring pattern |
| How does DI work? | Search for constructor params, `@Inject`, DI arrays, `provide/inject` | Dependency injection style |
| How are routes defined? | Search for `$stateProvider`, `RouterModule`, `@RequestMapping`, `urlpatterns` | Routing mechanism |
| How are HTTP calls made? | Search for `$http`, `HttpClient`, `fetch`, `axios`, `RestTemplate`, `requests` | HTTP abstraction layer |
| How is state managed? | Search for `$scope`, `@Input/@Output`, `useState`, `Vuex`, `NgRx`, Redux | State management pattern |
| How are views connected to logic? | Search for `ng-click`, `(click)`, `@click`, `onClick`, template bindings | View-logic binding |
| Do any classes/structs have nullable dependency fields with a no-arg constructor? | Search for `= null`, `= nil`, `dep?`, `?:` in constructors; no-arg factories | Conditional delegation pattern (stub vs live behavioral modes) |
| Do any classes use wire-name annotations/decorators that differ from the property name? | Search for `@JsonProperty`, `@Expose`, `` `json:"..."` ``, `@SerializedName`, `[JsonPropertyName]` | JSON wire name mapping — field name in code ≠ key in JSON payload |

```bash
# Example: scan for framework markers in all JS/TS files
grep -r "angular\.module\|@Component\|@Injectable\|createRouter\|@Controller\|@Service" <src-dir> --include="*.js" --include="*.ts" -l
```

#### 1.3 Map the component chain

Every framework has a chain from **user action → business logic → data access → external API**. Map it:

```
Framework Pattern:     UI Component → Controller/Handler → Service → Repository/Model → HTTP/DB
AngularJS 1.x:        view (ng-click) → $scope.method → service.method → model.method → $http.get(url)
Angular 2+:            template (click) → component.method → service.method → HttpClient.get(url)
React:                 JSX onClick → handler → hook/service → fetch/axios(url)
Spring Boot:           @RequestMapping → @Controller → @Service → @Repository → JPA/RestTemplate
Django:                urls.py → views.py → services.py → models.py → ORM/requests
Express.js:            router.get() → handler → service → model → fetch/db
Vue 3:                 @click → method → composable/store → fetch/axios
NestJS:                @Controller → @Injectable service → @Injectable repository → HttpService
```

Document these 3 things for the project:
1. **Chain pattern**: What is the calling sequence from UI to API?
2. **Registration mechanism**: How does the framework know about components?
3. **Wiring mechanism**: How are dependencies connected (DI, imports, props)?

#### 1.4 Analyze Tree-sitter output for one representative file

Pick one file of each role (controller, service, model, etc.) and run:

```bash
node .discovery/code/tools/ts-parse.js "<path-to-file>" | python3 -m json.tool
```

For each symbol kind, ask: **"Does Tree-sitter give me enough to trace the chain, or do I need more?"**

```
Example analysis for an AngularJS controller:
  ✅ Tree-sitter gives:  angular_registration (kind=controller), scope_assignments, di_dependencies, call_expressions
  ❌ Tree-sitter misses: which scope method calls which service method, DI resolution to files, HTTP URL extraction from variables
  → Resolver must: trace scope_method → service_call → model_call → HTTP endpoint

  ❌ Tree-sitter misses: conditional logic inside method bodies (null/nil guards)
  → Resolver must: read each method body looking for null/nil-guards on dependency fields to detect behavioral_modes (stub vs live)

  ❌ Tree-sitter misses: annotation/decorator attribute values (e.g., the string inside @JsonProperty)
  → Resolver must: read the property/field line looking for wire-name annotations and record json_name when it differs from the code name
```

Document the gaps. They become the resolver's steps.

---

### Phase 2 — Design the Resolver Steps

Based on Phase 1, design 5-10 steps. The pattern is always:

```
Step 1: Auto-detect application conventions (namespaces, DI provider names, API bases)
Step 2: Classify files by role (controller/service/model/view/test/config)
Step 3: Resolve dependency injection (map DI tokens → actual files/symbols)
Step 4: Trace the call chain (controller→service→model→HTTP)
Step 5: Extract API endpoints (HTTP method + URL + params)
Step 6: Classify operations (CRUD, navigation, validation, etc.)
Step 7: Detect error handling patterns
Step 7b: Detect conditional null-field delegation (behavioral modes) — scan method bodies for null/nil-guards on dependency fields
Step 7c: Detect JSON wire name mappings — extract annotation/decorator/struct-tag values that rename fields in the wire format
Step 8: Build module profiles (aggregate per feature/module)
Step 9: Generate resolver edges + API map
```

Not all steps apply to every framework. Adjust:

| Framework | Key resolver steps |
|-----------|-------------------|
| **AngularJS 1.x** | DI arrays → file resolution, scope method → service tracing, $http URL extraction |
| **Angular 2+** | @Injectable DI → constructor injection, RxJS pipe tracing, HttpClient intercept, lazy module loading |
| **React** | Hook dependency tracing, context provider/consumer, Redux action→reducer→selector chains |
| **Vue 3** | Composition API (ref/reactive tracing), Pinia store actions, provide/inject |
| **Spring Boot** | @Autowired/@Inject DI, @Transactional boundaries, @RequestMapping→handler→service→repo chain; **Step 7b**: `if (field == null)` guards; **Step 7c**: `@JsonProperty`, `@JsonAlias` |
| **Kotlin** | Data classes, sealed hierarchies, extension functions; **Step 7b**: `?: fallback` and `if (field == null)`; **Step 7c**: `@JsonProperty`, `@SerializedName` |
| **C#** | @Autowired→constructor DI, LINQ chains; **Step 7b**: `if (field == null)` / `?.`; **Step 7c**: `[JsonPropertyName("...")]`, `[JsonProperty("...")]` |
| **TypeScript** | ts-morph type resolution, decorator metadata, RxJS chains; **Step 7b**: `!this.field`, `?.` + `??`; **Step 7c**: `@JsonProperty`, `@Expose({ name })` |
| **Go** | Interface satisfaction, struct embedding; **Step 7b**: `if s.dep == nil`; **Step 7c**: struct tags `` `json:"wire_name"` `` |
| **Python** | MRO, dynamic imports (Jedi); **Step 7b**: `if self.dep is None`; **Step 7c**: `alias=` in Pydantic, `data_key=` in Marshmallow |
| **NestJS** | Module/provider DI, guard/interceptor/pipe chains, decorator metadata |
| **Django** | URL conf → view → serializer → model, middleware chain, signal connections |
| **Express.js** | Router middleware chain, handler → service → model, error middleware |
| **FastAPI** | Depends() DI, router → handler → service, Pydantic model validation |

---

### Phase 3 — Write the Resolver Tool

Create `.discovery/code/tools/<framework>-resolve.js`. Use this **scaffold**:

```javascript
#!/usr/bin/env node
/**
 * <FRAMEWORK> Resolver — enriches Tree-sitter symbols with semantic analysis.
 * Traces: <describe the chain pattern>
 * Fully deterministic — no LLM.
 *
 * READS:  .discovery/code/scan-manifest.json, .discovery/code/symbols/index.json, .discovery/code/symbols/*.json
 * WRITES: .discovery/code/modules/<module>.json, .discovery/code/graph/resolver-edges.json, .discovery/code/resolver-report.json
 */

const fs = require('fs');
const path = require('path');

// ── Paths ──────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..', '..');
const CODEBASE = path.join(ROOT, '.discovery/code');
const SYMBOLS_DIR = path.join(CODEBASE, 'symbols');
const MODULES_DIR = path.join(CODEBASE, 'modules');
const GRAPH_DIR = path.join(CODEBASE, 'graph');
const INDEX_PATH = path.join(SYMBOLS_DIR, 'index.json');
const MANIFEST_PATH = path.join(CODEBASE, 'scan-manifest.json');

if (!fs.existsSync(MODULES_DIR)) fs.mkdirSync(MODULES_DIR, { recursive: true });
if (!fs.existsSync(GRAPH_DIR)) fs.mkdirSync(GRAPH_DIR, { recursive: true });

// ── Load data ──────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
const allSymbols = index.symbols;

// Load all per-file symbol JSONs
const symbolFiles = {};
for (const f of fs.readdirSync(SYMBOLS_DIR).filter(f => f.endsWith('.json') && f !== 'index.json')) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(SYMBOLS_DIR, f), 'utf8'));
    symbolFiles[data.file] = data;
  } catch (e) {}
}

console.log(`📦 Loaded ${Object.keys(symbolFiles).length} symbol files, ${allSymbols.length} symbols`);

// ── Helper: find symbols by kind/type ──────────────────────────
function findSymbols(filter) {
  return allSymbols.filter(filter);
}

// ── Helper: read source lines for a file ───────────────────────
const sourceCache = {};
function getSourceLines(filePath) {
  if (!sourceCache[filePath]) {
    const absPath = path.join(ROOT, filePath);
    sourceCache[filePath] = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf8').split('\n') : [];
  }
  return sourceCache[filePath];
}

function getSourceRange(filePath, startLine, endLine) {
  const lines = getSourceLines(filePath);
  return lines.slice((startLine || 1) - 1, endLine || startLine).join('\n');
}

// ── Accumulators ───────────────────────────────────────────────
const resolverEdges = [];
const moduleProfiles = [];
const stats = { files_processed: 0, operations: 0, endpoints: 0, edges: 0, chains: 0 };

// ====================================================================
// STEP 1: AUTO-DETECT APPLICATION PATTERNS
// ====================================================================
console.log('\n🔍 Step 1: Auto-detecting application patterns...');

// TODO: Detect namespace/registration pattern
// Search angular_registrations, @Component decorators, class annotations, etc.
// Store in: detectedNamespace, detectedPrefix

// TODO: Detect project-defined vs platform dependencies
// Compare all imports/DI tokens against files in the project
// Store in: projectDefined (Set), platformServices (Set)

// TODO: Detect file role conventions
// Match filename patterns (e.g., *.controller.ts, *Service.java, *_model.py)
// Store in: fileRoleMap

// TODO: Detect API URL base pattern
// Find common prefix across all HTTP-related strings
// Store in: detectedApiBase

// ====================================================================
// STEP 2: CLASSIFY FILES BY ROLE
// ====================================================================
console.log('\n📂 Step 2: Classifying files...');

// TODO: For each file in symbolFiles:
//   1. Check filename convention (from Step 1)
//   2. Check content markers (decorators, base classes, etc.)
//   3. Assign role: controller|service|model|view|test|config|util

// ====================================================================
// STEP 3: RESOLVE DEPENDENCY INJECTION
// ====================================================================
console.log('\n🔗 Step 3: Resolving dependencies...');

// TODO: For each component:
//   1. Extract DI tokens (constructor params, @Inject, DI arrays, imports)
//   2. Resolve each token to a concrete file + symbol
//   3. Emit INJECTS edges: component --INJECTS--> dependency

// ====================================================================
// STEP 4: TRACE CALL CHAINS
// ====================================================================
console.log('\n🔄 Step 4: Tracing call chains...');

// TODO: For each controller/handler method:
//   1. Find call expressions within the method's line range
//   2. Match call target to a resolved dependency (from Step 3)
//   3. Follow the chain: controller.method → service.method → model.method → HTTP
//   4. Emit DELEGATES edges at each hop

// ====================================================================
// STEP 5: EXTRACT API ENDPOINTS
// ====================================================================
console.log('\n🌐 Step 5: Extracting API endpoints...');

// TODO: For each HTTP call found in Step 4:
//   1. Extract HTTP method (GET/POST/PUT/DELETE)
//   2. Resolve URL (may be a variable — look up its value in api_url symbols)
//   3. Extract path parameters (URL segments with {id} or :id)
//   4. Emit HTTP_CALL edges

// ====================================================================
// STEP 6: CLASSIFY OPERATIONS
// ====================================================================
console.log('\n🏷️ Step 6: Classifying operations...');

// TODO: For each scope method / handler:
//   1. Check if it delegates to a service (→ business operation)
//   2. Check HTTP method to classify CRUD type
//   3. Check name patterns for navigation, validation, UI state
//   4. Check for i18n, error handling, lifecycle markers

// Classification table (adapt keywords to the project's language/conventions):
// const CLASSIFICATION_PATTERNS = {
//   'CRUD-read':    /get|fetch|find|list|search|query|read|load|retrieve/i,
//   'CRUD-write':   /create|save|add|insert|new|post/i,
//   'CRUD-update':  /update|edit|modify|patch|put|change/i,
//   'CRUD-delete':  /delete|remove|destroy|drop/i,
//   'navigation':   /navigate|redirect|goto|route|go.*to|state.*go/i,
//   'validation':   /validate|check|verify|assert|isValid/i,
//   'filter':       /filter|search|find|query|sort|order/i,
//   'export':       /export|download|print|report|csv|pdf/i,
//   'popup':        /popup|modal|dialog|alert|confirm|toast|notification/i,
//   'lifecycle':    /init|destroy|mount|unmount|setup|teardown|ngOnInit/i,
//   'error':        /error|exception|fault|fail|catch|handle.*error/i,
//   'i18n':         /translate|i18n|locale|language|gettext/i,
// };

// ====================================================================
// STEP 7: DETECT ERROR HANDLING
// ====================================================================
console.log('\n⚠️ Step 7: Detecting error handling...');

// TODO: For each service/model method:
//   1. Check for .catch(), .then(null, errFn), try/catch
//   2. Extract error shape (what fields are accessed on the error object)
//   3. Store error_handling: { detected: true, pattern: 'promise-catch'|'try-catch' }

// ====================================================================
// STEP 7b: DETECT CONDITIONAL NULL-FIELD DELEGATION (BEHAVIORAL MODES)
// ====================================================================
console.log('\n🔀 Step 7b: Detecting conditional null-field delegation...');

// TODO: For each class/struct with a nullable/optional dependency-typed field:
//   1. Check if a no-arg constructor (or constructor with optional param) exists
//   2. For each method, read body source and check for null/nil-guard as the first meaningful statement:
//      - TypeScript/JS: if (!this.field) / if (this.field === null) / this.field?.call() ?? fallback
//      - Java/Kotlin/C#: if (field == null) / if (field === null)
//      - Go: if s.field == nil
//      - Python: if self.field is None
//   3. If guard found: annotate class with behavioral_modes [{name:'stub',...},{name:'live',...}]
//   4. Annotate each guarded method with behavioral_guard {field, condition, stub_branch, live_branch}
//   5. Emit CONDITIONAL_DELEGATES_TO edge with condition + mode fields

// ====================================================================
// STEP 7c: DETECT JSON WIRE NAME MAPPINGS
// ====================================================================
console.log('\n🏷️ Step 7c: Detecting JSON wire name mappings...');

// TODO: For each property/field in each class, read its source line and check for wire-name annotation:
//   - Java/Kotlin: @JsonProperty("wire_name"), @JsonAlias("wire_name"), @SerializedName("wire_name")
//   - C#: [JsonProperty("wire_name")], [JsonPropertyName("wire_name")]
//   - TypeScript: @JsonProperty("wire_name"), @Expose({ name: "wire_name" })
//   - Go: struct tag `json:"wire_name"` (first segment before comma)
//   - Python: alias="wire_name" (Pydantic), data_key="wire_name" (Marshmallow)
//   If the extracted wire name DIFFERS from the property name, record json_name on the symbol
//   and emit JSON_MAPPED_AS edge with target_key = wire_name

// ====================================================================
// STEP 8: BUILD MODULE PROFILES
// ====================================================================
console.log('\n📋 Step 8: Building module profiles...');

// TODO: Group files by module/feature (from scan-manifest sub_modules)
// For each module:
//   1. Collect its files and their roles
//   2. Aggregate operations from Steps 4-7
//   3. Build call_chains array
//   4. Build api_endpoints array
//   5. Write .discovery/code/modules/<module>.json

// ====================================================================
// STEP 9: EMIT EDGES + API MAP + REPORT
// ====================================================================
console.log('\n📊 Step 9: Writing outputs...');

// Write resolver edges
const existingEdgesPath = path.join(GRAPH_DIR, 'edges.json');
let existingEdges = [];
if (fs.existsSync(existingEdgesPath)) {
  existingEdges = JSON.parse(fs.readFileSync(existingEdgesPath, 'utf8')).edges || [];
}
const mergedEdges = [...existingEdges, ...resolverEdges];
fs.writeFileSync(existingEdgesPath, JSON.stringify({ edges: mergedEdges }, null, 2));

// Write API map
const allEndpoints = moduleProfiles.flatMap(m => m.api_endpoints || []);
const apiMap = {
  total_endpoints: allEndpoints.length,
  by_domain: {},
  all_endpoints: allEndpoints
};
for (const ep of allEndpoints) {
  const domain = ep.domain || 'unknown';
  if (!apiMap.by_domain[domain]) apiMap.by_domain[domain] = [];
  apiMap.by_domain[domain].push(ep);
}
fs.writeFileSync(path.join(CODEBASE, 'api-map.json'), JSON.stringify(apiMap, null, 2));

// Write resolver report
const report = {
  resolver: '<framework>-static',
  version: '1.0',
  timestamp: new Date().toISOString(),
  stats,
  modules: moduleProfiles.map(m => m.module)
};
fs.writeFileSync(path.join(CODEBASE, 'resolver-report.json'), JSON.stringify(report, null, 2));

console.log(`\n✅ Resolver complete: ${stats.operations} operations, ${stats.endpoints} endpoints, ${stats.edges} edges, ${stats.chains} chains`);
```

---

### Phase 4 — Implement Each Step Using AST Analysis

For each TODO step, use these **AST analysis techniques**:

#### Technique 1: Symbol filtering

The fastest approach — filter the already-extracted Tree-sitter symbols:

```javascript
// Find all components registered as controllers
const controllers = allSymbols.filter(s =>
  s.type === 'angular_registration' && s.kind === 'controller'
);

// Find all classes with @Component decorator
const components = allSymbols.filter(s =>
  s.kind === 'class' && (s.decorators || []).includes('Component')
);

// Find all call expressions targeting a specific method
const httpCalls = allSymbols.filter(s =>
  s.type === 'call_expression' && (s.name || '').match(/\.(get|post|put|delete)\(/)
);
```

#### Technique 2: Source range reading

When symbols don't have enough info, read the actual source:

```javascript
// Read the body of a method to find what it calls
const methodBody = getSourceRange(file, method.line, method.end_line);

// Check if the method delegates to a service
const delegationMatch = methodBody.match(/(\w+)\.(\w+)\s*\(/g);
if (delegationMatch) {
  for (const call of delegationMatch) {
    const [obj, method] = call.replace('(', '').split('.');
    // obj is likely a DI dependency — look it up in Step 3 results
  }
}
```

#### Technique 3: Cross-file symbol lookup

Trace references across files using the symbol index:

```javascript
// Given a DI token "UserService", find its definition
function resolveToken(tokenName) {
  // 1. Check angular_registrations
  const reg = allSymbols.find(s =>
    s.type === 'angular_registration' && s.text_preview?.includes(`'${tokenName}'`)
  );
  if (reg) return { file: reg.file, type: 'project-service', symbol: reg };

  // 2. Check class definitions
  const cls = allSymbols.find(s =>
    s.kind === 'class' && s.name === tokenName
  );
  if (cls) return { file: cls.file, type: 'project-class', symbol: cls };

  // 3. Not found in project → must be platform/external
  return { type: 'platform-service', name: tokenName };
}
```

#### Technique 4: Tree-sitter re-parse for deep AST (advanced)

When you need AST nodes not captured by `ts-parse.js`, re-parse the file:

```javascript
const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');

function deepParse(filePath) {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  const source = fs.readFileSync(filePath, 'utf8');
  const tree = parser.parse(source);

  // Walk the AST for specific patterns
  function walk(node) {
    if (node.type === 'call_expression') {
      const callee = node.childForFieldName('function');
      const args = node.childForFieldName('arguments');
      // Extract whatever you need
    }
    for (const child of node.children) walk(child);
  }
  walk(tree.rootNode);
}
```

⚠️ **Use this sparingly** — prefer symbol filtering (Technique 1) and source reading (Technique 2) first. Re-parsing is slower and adds Tree-sitter dependency to the resolver.

#### Technique 5: Pattern tables for classification

Define project-specific patterns as configurable tables, not hardcoded strings:

```javascript
// ✅ Good: configurable classification patterns
const CLASSIFICATION_PATTERNS = {
  'CRUD-read':    /get|fetch|find|list|search|query|read|load|retrieve/i,
  'CRUD-write':   /create|save|add|insert|new|post/i,
  'navigation':   /navigate|redirect|goto|route|state.*go/i,
  // Add project-specific terms:
  // Spanish apps:  'buscar' (search), 'eliminar' (delete), 'guardar' (save)
  // Domain terms:  'enroll', 'activate', 'decommission'
};

// ❌ Bad: hardcoded strings buried in if/else
if (name.includes('buscar') || name.includes('filtrar')) { ... }
```

#### Technique 6: Conditional delegation and JSON wire name detection

Use source-range reading (Technique 2) to implement Steps 7b and 7c:

```javascript
// ── Technique 6a: Conditional Null-Field Delegation (Step 7b) ────────────────
// Patterns covering: TypeScript/JS, Java/Kotlin/C#, Go, Python

const NULL_GUARD_PATTERNS = [
  /if\s*\(\s*(!this\.\w+|this\.\w+\s*===?\s*null|this\.\w+\s*===?\s*undefined)\s*\)/,  // TS/JS falsy or strict
  /\bthis\.\w+\?\..*\?\?/,                          // TS/JS optional chaining + nullish coalescing
  /if\s*\(\s*\w+\s*==\s*null\s*\)/,                 // Java / Kotlin / C#
  /if\s+\w+\.\w+\s*==\s*nil\s*\{/,                  // Go
  /if\s+self\.\w+\s+is\s+None\s*:/,                 // Python
];

function detectBehavioralModes(classSymbol, symbolFiles) {
  const fileData = symbolFiles[classSymbol.file];
  const methods = (fileData?.symbols || []).filter(s =>
    s.kind === 'method' && s.parent === classSymbol.name
  );
  const guardedMethods = [];
  for (const method of methods) {
    const body = getSourceRange(method.file, method.line, method.end_line);
    for (const pattern of NULL_GUARD_PATTERNS) {
      if (pattern.test(body)) {
        // Extract delegate class/method from the stub branch (first return/call after guard)
        const stubCallMatch = body.match(/return\s+([\w.]+)\s*\(/);
        guardedMethods.push({
          method: method.name,
          guard_pattern: body.match(pattern)?.[0],
          stub_delegate: stubCallMatch?.[1] || 'unknown',
        });
        break;
      }
    }
  }
  if (guardedMethods.length === 0) return null;
  return {
    behavioral_modes: [
      { name: 'stub', activation: 'dependency field == null/nil/undefined', description: 'Fallback path — does not invoke the injected dependency' },
      { name: 'live', activation: 'dependency field != null/nil', description: 'Live path — delegates to the injected dependency' },
    ],
    guarded_methods: guardedMethods,
  };
}

// ── Technique 6b: JSON Wire Name Mapping (Step 7c) ───────────────────────────
// Language-specific patterns for wire-name annotations / struct tags

const WIRE_NAME_PATTERNS = {
  java:       /@JsonProperty\("([^"]+)"\)|@JsonAlias\("([^"]+)"\)/,
  kotlin:     /@JsonProperty\("([^"]+)"\)|@SerializedName\("([^"]+)"\)/,
  csharp:     /\[JsonProperty(?:Name)?\("([^"]+)"\)\]/,
  typescript: /@JsonProperty\("([^"]+)"\)|@Expose\(\{[^}]*name:\s*["']([^"']+)["']/,
  go:         /`[^`]*json:"([^",]+)/,
  python:     /alias=["']([^"']+)["']|data_key=["']([^"']+)["']/,
};

function extractWireName(propertySymbol, language) {
  const pattern = WIRE_NAME_PATTERNS[language];
  if (!pattern) return null;
  const sourceLine = getSourceRange(propertySymbol.file, propertySymbol.line, propertySymbol.line);
  const match = sourceLine.match(pattern);
  const wireName = match?.[1] || match?.[2];
  // Only record if the wire name differs from the code property name
  return wireName && wireName !== propertySymbol.name ? wireName : null;
}
```

**Integration**: call these helpers inside Steps 7b/7c, then append to `resolverEdges` and annotate the symbol before writing the module profile.

---

### Phase 5 — Integrate with the Pipeline

#### 5.1 Name the resolver file correctly

The pipeline auto-discovers resolvers by framework name:

```
.discovery/code/tools/<framework>-resolve.js
```

Where `<framework>` matches `scan-manifest.json → frameworks[0]`:

| Framework detected | Resolver file | frameworks[] value |
|-------------------|---------------|-------------------|
| AngularJS 1.x | `angularjs-resolve.js` | `angularjs-1.x` |
| Angular 2+ | `angular-resolve.js` | `angular-19` |
| React | `react-resolve.js` | `react` |
| Vue | `vue-resolve.js` | `vue-3` |
| Spring Boot | `springboot-resolve.js` | `spring-boot` |
| NestJS | `nestjs-resolve.js` | `nestjs` |
| Django | `django-resolve.js` | `django` |
| Express | `express-resolve.js` | `express` |
| FastAPI | `fastapi-resolve.js` | `fastapi` |

The pipeline maps the first word before `-` or uses the full framework name.

#### 5.2 Test the resolver standalone

```bash
# First run pipeline without resolver to get symbols
node .discovery/code/tools/pipeline.js "<src-dir>" --skip-resolve --clean

# Then run your resolver alone
node .discovery/code/tools/<framework>-resolve.js

# Check outputs
cat .discovery/code/resolver-report.json
ls .discovery/code/modules/
cat .discovery/code/api-map.json
```

#### 5.3 Test end-to-end

```bash
# Full pipeline with resolver
node .discovery/code/tools/pipeline.js "<src-dir>" --clean

# Verify all outputs
node -e "
  const r = require('./.discovery/code/resolver-report.json');
  console.log('Operations:', r.stats.operations);
  console.log('Endpoints:', r.stats.endpoints);
  console.log('Chains:', r.stats.chains);
  console.log('Edges:', r.stats.edges);
  if (r.stats.endpoints === 0) console.warn('⚠️  No endpoints found — check Step 5');
  if (r.stats.chains === 0) console.warn('⚠️  No call chains — check Step 4');
"
```

#### 5.4 Force a specific resolver

```bash
node .discovery/code/tools/pipeline.js "<src-dir>" --resolver <framework-name>
```

---

### Phase 6 — Validate and Iterate

#### Validation checklist

| Check | How | Expected |
|-------|-----|----------|
| Resolver runs without errors | `node .discovery/code/tools/<fw>-resolve.js` | Exit code 0 |
| Module profiles generated | `ls .discovery/code/modules/` | 1+ JSON files |
| Operations detected | `resolver-report.json → stats.operations` | > 0 |
| Endpoints extracted | `resolver-report.json → stats.endpoints` | > 0 (if HTTP app) |
| Call chains traced | `resolver-report.json → stats.chains` | > 0 |
| Resolver edges emitted | `resolver-report.json → stats.edges` | > 0 |
| API map generated | `cat .discovery/code/api-map.json` | Endpoints listed |
| No regressions | Pipeline total symbols unchanged | Same as --skip-resolve |
| Behavioral modes detected | `grep -r "behavioral_modes" .discovery/code/modules/` | Present if classes with null/nil-guard dependency fields exist |
| Wire names mapped | `grep -r "json_name" .discovery/code/modules/` | Present if DTOs with wire-name annotations exist |

#### Common issues and fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| 0 endpoints | HTTP call symbols not matched | Check Step 5: print all `http_call` or `call_expression` symbols, verify URL extraction regex |
| 0 call chains | Delegation not detected | Check Step 4: verify method line ranges cover the call expressions; check if `text_preview` is populated |
| 0 operations | Classification missed | Check Step 6: print all scope methods/handlers before classification, verify regex patterns cover the project's naming |
| Wrong DI resolution | Token→file mismatch | Check Step 3: print resolved vs unresolved tokens, verify registration name extraction |
| Symbol line mismatch | `start` vs `line` field | Tree-sitter symbols use `line` (1-indexed start). Some resolvers assume `start`. Use `const ln = s.start \|\| s.line` |
| Synthesized docs omit stub/live modes | `behavioral_modes` not detected | Add Step 7b: scan method bodies for null/nil-guards on nullable dependency fields; verify NULL_GUARD_PATTERNS match the project's language |
| Mock JSON uses wrong field key | `json_name` not extracted | Add Step 7c: extract wire-name annotation values (`@JsonProperty`, struct tag, `@Expose`) for properties where wire key ≠ code name; verify WIRE_NAME_PATTERNS for the project's language |

---

## Reference Implementation

The **AngularJS resolver** (`angularjs-resolve.js`) is the reference implementation:
- Read: `.github/skills/discovery-code-resolve-angularjs/SKILL.md` for the design
- Read: `.discovery/code/tools/angularjs-resolve.js` for the implementation
- It implements all 9 steps with techniques 1-3 (no re-parsing needed)

---

## Framework-Specific Cheat Sheets

### AngularJS 1.x
- **Registration**: `CNT.ngModule.controller('Name', [...deps, function(...) {}])`
- **DI**: Inline array annotation or `$inject` property
- **HTTP**: `T3_HTTPService.get(url)` or `$http.get(url)` → returns promise
- **Routing**: `$stateProvider.state('name', { url: '...', controller: '...' })`
- **Key symbol kinds**: `angular_registration`, `scope_assignment`, `di_injection`, `http_call`, `api_url`

### Angular 2+ (19)
- **Registration**: `@Component({...})`, `@Injectable({...})`, `@NgModule({...})`
- **DI**: Constructor injection with `@Inject()` or type annotation
- **HTTP**: `HttpClient.get<T>(url)` → returns Observable
- **Routing**: `RouterModule.forRoot([{ path: '...', component: ... }])`
- **Key patterns**: Decorator metadata, RxJS pipe chains, lazy-loaded modules

### React
- **Registration**: `export default function Component()` or `export class Component extends React.Component`
- **DI**: None (prop drilling, context, or state management)
- **HTTP**: `fetch(url)`, `axios.get(url)`, custom hooks `useFetch(url)`
- **Routing**: `react-router` `<Route path="..." element={<Comp/>}/>`
- **Key patterns**: Hook dependencies, context providers/consumers, Redux actions

### Vue 3
- **Registration**: `defineComponent({...})`, `<script setup>`
- **DI**: `provide/inject`, Pinia stores
- **HTTP**: `axios`, `fetch`, `useFetch` composables
- **Routing**: `createRouter({ routes: [...] })`
- **Key patterns**: Composition API refs, computed, watch; Pinia actions/getters

### Spring Boot
- **Registration**: `@Controller`, `@Service`, `@Repository`, `@Component`
- **DI**: `@Autowired` field/constructor injection
- **HTTP**: `@GetMapping`, `@PostMapping`, `RestTemplate`, `WebClient`
- **Routing**: `@RequestMapping("/api/...")` annotations
- **Key patterns**: Transaction boundaries, exception handlers, AOP aspects

### NestJS
- **Registration**: `@Controller()`, `@Injectable()`, `@Module({ providers: [...] })`
- **DI**: Constructor injection via TypeScript types
- **HTTP**: `@Get()`, `@Post()`, `HttpService`
- **Routing**: Decorator-based with controller prefix
- **Key patterns**: Guards, interceptors, pipes, exception filters

### Django
- **Registration**: `urls.py` URL conf, `INSTALLED_APPS`, `admin.site.register()`
- **DI**: None (explicit imports, Django's app registry)
- **HTTP**: `requests.get()`, DRF `APIView`
- **Routing**: `path('api/...', views.function_or_class)`
- **Key patterns**: Model managers, signals, middleware, serializers

### Express.js
- **Registration**: `app.use()`, `router.get()`
- **DI**: None (require/import)
- **HTTP**: `fetch`, `axios`, `node-fetch`
- **Routing**: `router.METHOD(path, ...middlewares, handler)`
- **Key patterns**: Middleware chains, error handlers, async wrapper

---

## Guardrails

- ⛔ **NEVER** use LLM for resolver logic — resolvers MUST be deterministic
- ⛔ **NEVER** hardcode project-specific names (namespaces, URL prefixes, component names) — always auto-detect
- ⛔ **NEVER** assume symbol field names — check both `start`/`line`, `text_preview`/`text`, etc.
- ✅ **ALWAYS** use configurable pattern tables for classification
- ✅ **ALWAYS** emit edges with confidence levels
- ✅ **ALWAYS** handle missing data gracefully (empty `text_preview`, missing files, 0 symbols)
- ✅ **ALWAYS** test with `--skip-resolve` first to verify baseline, then with resolver
- ✅ **ALWAYS** print progress (emoji + counts) so users can follow execution
- ✅ **PREFER** symbol filtering (Technique 1) over source re-reading (Technique 2)
- ✅ **PREFER** cross-file symbol lookup (Technique 3) over Tree-sitter re-parse (Technique 4)
