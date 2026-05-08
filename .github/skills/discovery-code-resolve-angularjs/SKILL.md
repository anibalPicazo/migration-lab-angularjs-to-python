---
name: discovery-code-resolve-angularjs
description: Semantic resolver for AngularJS 1.x applications. Enriches Tree-sitter symbols by tracing controller→service→model→HTTP chains, resolving DI wiring, mapping scope methods to service calls, and extracting API endpoints. Fully deterministic — no LLM needed.
license: Apache-2.0
compatibility: Requires .discovery/code/symbols/ with Tree-sitter output from ts-parse.js. No external tools — pure static analysis of AngularJS patterns.
metadata:
  author: discovery-code
  version: "1.0"
---

# Resolver — AngularJS 1.x

Enriches Tree-sitter symbols with **AngularJS-specific semantic analysis**. Traces the full chain from UI bindings through controllers, services, models, down to HTTP endpoints. All deterministic — uses the structured output from `ts-parse.js` (which already extracts `angular_registrations`, `scope_assignments`, `di_dependencies`, `api_urls`).

## What This Resolver Adds (that Tree-sitter alone cannot)

| Gap in Tree-sitter output | What the resolver provides |
|---------------------------|---------------------------|
| `$scope.deleteCategory` is just an assignment | Traces to: calls `service.deleteCategory()` → delegates to `model.deleteCategory()` → HTTP DELETE `/resources/.../deleteMarkCategory/{id}` |
| DI is a flat array of strings | Resolves each DI string to actual file + registration type (service, factory, constant, platform) |
| `T3_HTTPService.get(url)` is just a call | Extracts: HTTP method, URL pattern, path params, headers, response handling |
| Service methods wrap promises | Maps: `service.X()` → `model.X()` delegation pattern with error handling schema |
| Controller scope methods | Classifies: CRUD ops, navigation, validation, UI state, i18n |
| View bindings (`ng-click`, `ng-model`) | Connects view elements to scope methods/properties |

## Common Interface

```
INPUT:
  - file_path: string              ← file to resolve
  - tree_sitter_symbols: Symbol[]  ← from ts-parse.js (includes angular_registrations, scope_assignments, etc.)
  - scan_manifest: object          ← repo context
  - all_symbol_files: object[]     ← ALL parsed symbol JSONs (for cross-file resolution)

OUTPUT:
  - enriched_symbols: Symbol[]     ← same symbols enriched with AngularJS semantics
  - additional_edges: Edge[]       ← cross-file relationships
  - module_profile: object         ← high-level module analysis (operations, API map, DI graph)
  - metadata:
      resolver: "angularjs-static"
      version: "1.0"
      confidence: "high"
      source: "resolver"
```

## Prerequisites

This resolver works with **ANY AngularJS 1.x application**. It does NOT hardcode:
- Module namespace patterns (auto-detected from code)
- Platform service prefixes (auto-detected from DI arrays)
- API URL patterns (auto-detected from HTTP calls)
- File naming conventions (auto-detected from scan manifest)

## Steps

### 1. Auto-detect application patterns

Before processing individual files, scan ALL symbol files once to detect the app's conventions:

**a) Module namespace**
Search all `angular_registration` symbols for the registration pattern:
```
Look for: *.angular_registrations[].name → extract the calling pattern
Examples found:  "CNT.ngModule.controller"  → namespace = "CNT.ngModule"
                 "angular.module('app')"    → namespace = "angular.module('app')"
                 "app.controller"           → namespace = "app"
```
Store: `detected_namespace`

**b) Platform services**
From all DI dependency arrays, identify injected services NOT defined in the project:
```
All project-defined services: [names from angular_registrations where kind=factory|service]
All injected deps: [flatten all di_dependencies arrays]
Platform services = injected - project_defined - angular_builtins
```
Angular builtins: `$scope`, `$rootScope`, `$http`, `$q`, `$state`, `$stateParams`, `$timeout`, `$interval`, `$log`, `$filter`, `$location`, `$window`, `$document`, `$compile`, `$parse`, `$injector`, `$templateCache`, `gettextCatalog`

Store: `detected_platform_services` (e.g., `["T3_HTTPService", "T3_TrazaService", "PopupService", ...]`)

**c) File role convention**
From the scan manifest file list, detect the naming pattern:
```
Files matching *_controller.js → role: controller
Files matching *_service.js   → role: service  
Files matching *_model.js     → role: model
Files matching *_directive.js → role: directive
Files matching *_constant.js  → role: constant
Files matching *_view.html    → role: view
Files matching *Spec.js       → role: test
```
If no pattern detected, classify by content (angular_registration kind).

**d) API URL base pattern**
From all `api_url` symbols: extract common URL prefix.
```
URLs: ["/resources/org/tran/v1/markManagements/...", "/resources/org/tran/v1/markCategoryManagements/..."]
→ detected_api_base: "/resources/org/tran/v1/"
→ detected_domains: ["markManagements", "markCategoryManagements"]
```

**e) CSS / Design System dependencies**
Scan entry-point files (`index.js`, `index.html`, `app.js`, `main.js`) for CSS package imports:
```
Look for:  require('@<client>/design-system-main')
           require('@<client>/design-system-styles')
           require('some-css-package')
           import '*.css'
           import '*.scss'
           <link href="..." rel="stylesheet">
           <script src="...bundle.js"> (that loads CSS)
```
Also scan `package.json` dependencies for packages containing `static`, `css`, `styles`, `theme`, `design-system` in their name.

Store: `detected_css_dependencies` — array of `{package, import_statement, file}`

Example (replace with the actual package names found in the project):
```json
{
  "detected_css_dependencies": [
    {"package": "@<client>/design-system-main", "import": "require('@<client>/design-system-main')", "file": "index.js"},
    {"package": "@<client>/design-system-styles", "import": "require('@<client>/design-system-styles')", "file": "index.js"}
  ]
}
```

> **Why this matters**: Legacy apps often get 100% of their CSS from external packages loaded via webpack `require()`. If these dependencies are not detected, the migrated app will have **zero styles**. This is the #1 visual regression risk in migrations.

Store all detections in `.discovery/code/resolver-angularjs-config.json` for incremental runs.

### 2. Resolve controller files

For each file where `angular_registration.kind === "controller"`:

**a) Classify scope methods**
Read each `scope_assignment` and classify by code inspection:

| Classification | Detection rule |
|---------------|----------------|
| `crud-operation` | Method body calls a service method that maps to HTTP `get/post/put/delete` |
| `navigation` | Method body calls `$state.go()` or `$location.path()` |
| `validation` | Method body checks `$scope.form.$valid`, field values, or sets error flags |
| `ui-state` | Method body only sets `$scope.*View` or `$scope.*Data` properties |
| `filter/search` | Method name contains `filtrar`, `filter`, `search`, `buscar`, or calls `.filter()` |
| `export/import` | Method name contains `export`, `import`, or calls service export/import methods |
| `popup/dialog` | Method body calls `PopupService`, `openPop`, `$modal.open()` |
| `lifecycle` | Method name is `init`, `$onInit`, `$onDestroy`, `$onChanges` |
| `i18n` | Method body calls `gettextCatalog` or loads language files |
| `error-handling` | Method body calls `lanzarMensaje`, sets `$scope.errores`, or shows alerts |

**b) Trace scope → service calls**
For each scope method classified as `crud-operation`:
1. Read `text_preview` from the scope_assignment
2. Find calls to injected services: match `<serviceName>.<method>()` in the preview
3. Record edge: `controller::$scope.method` → `service::serviceMethod`

**c) Build controller profile**
```json
{
  "name": "consultMarkCategoriesController",
  "role": "controller",
  "di_dependencies": ["$scope", "consultMarkCategoriesService", ...],
  "platform_dependencies": ["T3_TrazaService", "PopupService", ...],
  "operations": [
    {"scope_method": "$scope.listMarkCategories", "type": "crud-operation", "delegates_to": "consultMarkCategoriesService.listMarkCategories"},
    {"scope_method": "$scope.deleteMarkCategory", "type": "crud-operation", "delegates_to": "consultMarkCategoriesService.deleteMarkCategory"},
    {"scope_method": "$scope.filtrar", "type": "filter/search", "delegates_to": null},
    {"scope_method": "$scope.goToManageCategoria", "type": "navigation", "target_state": "manageMarkCategories"}
  ]
}
```

### 3. Resolve service files

For each file where `angular_registration.kind === "factory"` or `"service"`:

**a) Map service methods to model methods**
For each `assignment_expression` or `function_declaration` in the service:
1. Check if the function body references another injected dependency (the model)
2. If it follows the promise/delegate pattern:
   ```
   service.X = function(input) {
     var deferred = $q.defer();
     model.X(input).success(...).error(...);
     return deferred.promise;
   }
   ```
   Record: `service.X` → delegates to `model.X`, wraps with error handling

**b) Extract error handling schema**
Look for the `getFunctionalError` pattern or similar:
- What fields does the error object contain?
- What is the structure of `faultDetail`?
Record as `error_schema` in the service profile.

**c) Build service profile**
```json
{
  "name": "consultMarkCategoriesService",
  "role": "service",
  "pattern": "promise-delegate",
  "di_dependencies": ["T3_HTTPService", "$q", "consultMarkCategoriesModel"],
  "methods": [
    {"name": "deleteMarkCategory", "delegates_to": "consultMarkCategoriesModel.deleteMarkCategory", "error_handling": "getFunctionalError"},
    {"name": "exportMarkCategories", "delegates_to": "consultMarkCategoriesModel.exportMarkCategories", "error_handling": "getFunctionalError"}
  ],
  "error_schema": {
    "fields": ["code", "mensaje1", "mensaje2", "mensaje3", "mensaje4"],
    "source_path": "data.faultDetail"
  }
}
```

### 4. Resolve model files

For each file where role is `model` (detected by convention or by being the dependency of a service):

**a) Extract API endpoints**
For each method in the model:
1. Find URL string assignment: `var URL_* = "/resources/..."`
2. Detect HTTP method: `T3_HTTPService.get()`, `.post()`, `.put()`, `['delete']()`, or generic `$http.get()`, `$http.post()`, etc.
3. Extract path parameters: `{id}`, `{name}`, etc. from URL template
4. Extract headers and params configuration
5. Detect content type

**b) Build API map**
```json
{
  "name": "consultMarkCategoriesModel",
  "role": "model",
  "http_client": "T3_HTTPService",
  "endpoints": [
    {
      "method_name": "deleteMarkCategory",
      "http_method": "DELETE",
      "url_template": "/resources/org/tran/v1/markCategoryManagements/deleteMarkCategory/{id}",
      "path_params": ["id"],
      "content_type": "application/json",
      "input_param": "DeleteMarkCategory_IN"
    },
    {
      "method_name": "exportMarkCategories",
      "http_method": "GET",
      "url_template": "/resources/org/tran/v1/markCategoryManagements/exportMarkCategories",
      "path_params": [],
      "content_type": "application/json",
      "input_param": "ExportMarkCategories_IN"
    }
  ]
}
```

### 5. Resolve view files

For each HTML file with AngularJS directives (from `ng_directives` and `ng_bindings` in ts-parse output):

**a) Map UI → scope bindings**
```
ng-click="deleteMarkCategory(item)"  →  $scope.deleteMarkCategory
ng-model="consultMarkCategoriesData.searchField"  →  $scope.consultMarkCategoriesData
ng-repeat="item in markCategoriesList"  →  $scope.markCategoriesList
ng-show="consultMarkCategoriesView.showTable"  →  $scope.consultMarkCategoriesView
ng-submit="filtrar()"  →  $scope.filtrar
```

**b) Extract UI structure**
- Forms with their fields and submit actions
- Tables with column bindings
- Buttons with click handlers
- Conditional visibility (`ng-show`/`ng-hide`/`ng-if`)

**c) Extract CSS class inventory**
From each HTML view file, extract ALL CSS classes used:
```
Search for: class="..." and ng-class="..." attributes
Extract: unique class names, grouped by UI region (form, table, button, panel, modal, layout)
```
Build a `css_classes` array with usage context:
```json
{
  "css_classes": [
    {"class": "boton-primario", "elements": ["button"], "count": 3, "context": "action-buttons"},
    {"class": "panel-principal", "elements": ["div"], "count": 1, "context": "page-wrapper"},
    {"class": "container12", "elements": ["div"], "count": 2, "context": "layout-grid"},
    {"class": "input_generico", "elements": ["input"], "count": 8, "context": "form-fields"},
    {"class": "tabla_editable", "elements": ["table"], "count": 1, "context": "data-table"},
    {"class": "paginacion_tablas", "elements": ["div"], "count": 1, "context": "pagination"}
  ]
}
```
Also check for inline `style="..."` attributes and record them as `inline_styles`.

> **Why**: CSS classes in legacy views come from external design system packages (DIMA). The migrated app must either import compatible CSS or replicate these classes. Without this inventory, the Angular 19 app renders unstyled.

**d) Build view profile**
```json
{
  "file": "consultMarkCategories_view.html",
  "role": "view",
  "bound_controller": "consultMarkCategoriesController",
  "forms": [{"submit": "$scope.filtrar", "fields": [...]}],
  "tables": [{"source": "$scope.markCategoriesList", "columns": [...]}],
  "actions": [{"trigger": "ng-click", "handler": "$scope.deleteMarkCategory", "element": "button.delete"}],
  "css_classes": [
    {"class": "boton-primario", "elements": ["button"], "count": 2, "context": "action-buttons"},
    {"class": "tabla_editable", "elements": ["table"], "count": 1, "context": "data-table"}
  ],
  "inline_styles": []
}
```

### 6. Resolve constant/config files

For each `angular_registration.kind === "constant"`:
- Extract the constant value (object, array, or primitive)
- If it contains route configuration, API base URLs, or feature flags, classify accordingly

### 7. Build module profile

For each detected sub-module (group of controller + service + model + view + directive + constant sharing a name prefix):

```json
{
  "module": "consultMarkCategories",
  "files": {
    "controller": "consultMarkCategories_controller.js",
    "service": "consultMarkCategories_service.js",
    "model": "consultMarkCategories_model.js",
    "directive": "consultMarkCategories_directive.js",
    "view": "consultMarkCategories_view.html",
    "constant": "consultMarkCategories_constant.js",
    "tests": ["test/consultMarkCategories_controllerSpec.js", "..."]
  },
  "call_chain": "view → controller($scope) → service(promise) → model(HTTP) → API",
  "api_domain": "markCategoryManagements",
  "operations": [
    {
      "name": "deleteMarkCategory",
      "chain": "$scope.deleteMarkCategory → service.deleteMarkCategory → model.deleteMarkCategory → DELETE /resources/.../deleteMarkCategory/{id}",
      "type": "crud-delete",
      "input": "DeleteMarkCategory_IN",
      "path_params": ["id"],
      "error_handling": "getFunctionalError → {code, mensaje1..4}"
    }
  ],
  "source_files": {
    "controller": { "path": "cgt/consultMarkCategories/consultMarkCategories_controller.js", "lines": 245, "content": "// full source..." },
    "service": { "path": "cgt/consultMarkCategories/consultMarkCategories_service.js", "lines": 89, "content": "// full source..." },
    "model": { "path": "cgt/consultMarkCategories/consultMarkCategories_model.js", "lines": 112, "content": "// full source..." },
    "view": { "path": "cgt/consultMarkCategories/consultMarkCategories_view.html", "lines": 305, "content": "<!-- full HTML... -->" },
    "directive": { "path": "cgt/consultMarkCategories/consultMarkCategories_directive.js", "lines": 9, "content": "// full source..." },
    "constant": { "path": "cgt/consultMarkCategories/consultMarkCategories_constant.js", "lines": 3, "content": "// full source..." }
  },
  "i18n_locales": ["es_ES", "en_US", "ca_CA", "ga_GA", "es_EU"],
  "platform_dependencies": ["T3_HTTPService", "T3_TrazaService", "T3_CabeceraPresentacionService", "..."],
  "css_dependencies": [
    {"package": "@<client>/design-system-main", "import": "require('@<client>/design-system-main')", "file": "index.js"},
    {"package": "@<client>/design-system-styles", "import": "require('@<client>/design-system-styles')", "file": "index.js"}
  ],
  "css_class_inventory": {
    "total_unique_classes": 42,
    "by_context": {
      "layout": ["container12", "panel-principal", "panel-body"],
      "forms": ["input_generico", "form-group", "label-small"],
      "buttons": ["boton-primario", "boton-secundario", "btn-export"],
      "tables": ["tabla_editable", "contenedor-g-tabla", "tabla-header"],
      "pagination": ["paginacion_tablas", "nav-pagination"],
      "modals": ["modal-content", "modal-header", "modal-footer"]
    },
    "design_system": "DIMA (Interactive Design Movistar Aura)"
  }
}
```

> **Source embedding**: The `source_files` key contains the **complete source code** of each file role (controller, service, model, view, directive, constant). This is embedded automatically during profile generation by reading from `manifest.root`. The delivery agent can read a single module JSON to get full context for migration — no separate file reads needed.
```

### 8. Emit edges

Generate cross-file edges for the graph:

| Edge type | Source | Target | Confidence |
|-----------|--------|--------|------------|
| `INJECTS` | controller file | service registration | high |
| `INJECTS` | service file | model registration | high |
| `INJECTS` | controller file | platform service | high |
| `DELEGATES` | scope method | service method | high |
| `DELEGATES` | service method | model method | high |
| `HTTP_CALL` | model method | API endpoint URL | high |
| `BINDS` | view ng-click | scope method | high |
| `BINDS` | view ng-model | scope property | high |
| `BINDS` | view ng-repeat | scope collection | high |
| `TESTS` | test file | tested registration | high |
| `NAVIGATES` | scope method ($state.go) | target state/module | high |

### 9. Output

Save enriched data to `.discovery/code/symbols/<file_hash>.json` (merge with existing):
- Add `enriched` section with resolver-specific data  
- Add `module_profile` for the full module analysis
- Mark `source: "resolver"`, `resolver_tool: "angularjs-static"`, `confidence: "high"`

Save module profiles to `.discovery/code/modules/<module_name>.json`

Save API map to `.discovery/code/api-map.json`:
```json
{
  "resolved_at": "<ISO timestamp>",
  "api_base": "<detected>",
  "domains": {
    "markCategoryManagements": {
      "module": "consultMarkCategories",
      "endpoints": [...]
    }
  }
}
```

## Implementation

This resolver is a **Node.js script** at `.discovery/code/tools/angularjs-resolve.js` that:

1. Reads ALL symbol JSONs from `.discovery/code/symbols/`
2. Runs Steps 1-8 as pure JSON processing (no external dependencies, no LLM)
3. Writes enriched symbols, module profiles, and edges

The script is **generated by this skill** — the agent creates the script following the steps above, then runs it:

```bash
node .discovery/code/tools/angularjs-resolve.js
```

## Fast Path: `pipeline.js`

If `.discovery/code/tools/pipeline.js` exists, this resolver is invoked automatically as Step 4 of the pipeline:

```bash
node .discovery/code/tools/pipeline.js "<src-dir>" --clean
```

The pipeline calls `.discovery/code/tools/angularjs-resolve.js` internally. Use `--skip-resolve` to skip this step for non-AngularJS modules. Use the individual skill steps when you need fine-grained control or debugging.

See `how-to/HOW-TO-PIPELINE.md` for full documentation.

## Guardrails

- **NO client-specific hardcoding** — all patterns (namespaces, prefixes, URL bases) are auto-detected
- **NO LLM** calls — all analysis is deterministic static analysis
- **Preserve Tree-sitter data** — the resolver only ADDS to existing symbols, never removes or contradicts
- **Handle missing files** — if a DI dependency has no matching file, mark as `external` or `platform`
- **Handle .txt duplicates** — some projects have backup copies as `.js.txt`; skip these unless the `.js` version is missing
