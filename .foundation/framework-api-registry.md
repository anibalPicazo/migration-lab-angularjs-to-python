---
version: "1.1"
generated_at: 2026-05-11T00:00:00.000Z
last_updated: 2026-05-12T14:30:00.000Z
source: discovery-code
changelog: |
  1.1 (2026-05-12): Added Python Backend APIs section with Babel/gettext i18n pattern from navigation-header-i18n
  1.0 (2026-05-11): Initial version with AngularJS APIs
---

# Framework API Registry

Level: 1 (Global)  
Scope: Tactical  
Category: Technical Architecture  
Purpose: AngularJS 1.7.x framework APIs, UI-Router patterns, and testing libraries extracted from the frontend module. Authoritative reference for correct API usage during migration to Python/FastAPI server-side rendering.

> Approved libraries, their versions, and correct usage patterns extracted from source code.
> Updated by `@discovery-code` as each module is analyzed.

## Core Framework

| Library | Version | Purpose | Source |
|---|---|---|---|
| AngularJS | 1.7.x | Client-side MVC framework | package.json |
| @uirouter/angularjs | 1.x | Client-side routing | package.json |
| Karma | ^6.4.0 | Test runner | package.json (devDependency) |
| Jasmine | ^4.6.0 | Testing framework | package.json (devDependency) |
| http-server | ^14.1.1 | Development server | package.json (devDependency) |
| angular-mocks | ^1.8.3 | Testing mocks | package.json (devDependency) |

---

## Module: frontend

### AngularJS 1.7.x Core APIs

#### Module Definition

**Pattern**: `angular.module('moduleName', [dependencies])`

**Detected Usage**:
```javascript
// src/app/app.module.js:3
angular.module('appModule', ['ui.router'])
```

**Correct Pattern**:
```javascript
// Module definition (with dependencies array)
angular.module('appModule', ['ui.router'])
    .run(['$q', 'ConfigService', 'i18nService', function($q, ConfigService, i18nService) {
        // Bootstrap logic
    }]);
```

❌ **Wrong Pattern**: Omitting dependencies array on first definition
```javascript
// This retrieves existing module, doesn't create it
angular.module('appModule')  // ❌ Error if module doesn't exist yet
```

---

#### Service Registration

**Pattern**: `.service('ServiceName', ['Dep1', 'Dep2', function(Dep1, Dep2) { ... }])`

**Detected Services**:

| Service | File | Dependencies Injected |
|---|---|---|
| ConfigService | src/app/services/config.service.js:4 | $http |
| i18nService | src/app/services/i18n.service.js:4 | $http |
| ErrorService | src/app/services/error.service.js:4 | — |
| ApiService | src/app/services/api.service.js:4 | $http |
| CuentasService | src/app/services/cuentas.service.js:4 | ApiService, MockDataService |
| MockDataService | src/app/services/mock-data.service.js:4 | — |
| HttpErrorInterceptor | src/app/config/http.interceptor.js:4 | $q, ErrorService |

**Correct Pattern** (explicit DI annotation):
```javascript
angular.module('appModule')
    .service('ConfigService', ['$http', function($http) {
        this.load = function() {
            return $http.get('/src/assets/config.json');
        };
    }]);
```

❌ **Wrong Pattern**: Implicit DI (breaks minification)
```javascript
.service('ConfigService', function($http) {  // ❌ Minification breaks DI
    this.load = function() { ... };
});
```

---

#### Component Registration

**Pattern**: `.component('componentName', { ... })`

**Detected Components**:

| Component | File | Bindings |
|---|---|---|
| app-header | src/app/components/header/header.component.js:4 | — |
| app-footer | src/app/components/footer/footer.component.js:4 | — |
| app-error-banner | src/app/components/error-banner/error-banner.component.js:4 | ErrorService (injected in controller) |
| app-loading-spinner | src/app/components/loading-spinner/loading-spinner.component.js:4 | — |

**Correct Pattern**:
```javascript
angular.module('appModule')
    .component('appHeader', {
        templateUrl: 'src/app/components/header/header.template.html',
        controller: ['$scope', function($scope) {
            // Component logic
        }]
    });
```

**Usage in HTML**:
```html
<app-header></app-header>
```

---

#### Filter Registration

**Pattern**: `.filter('filterName', function() { return function(input) { ... }; })`

**Detected Filters**:

| Filter | File | Purpose |
|---|---|---|
| translate | src/app/i18n/translate.filter.js:4 | i18n key translation |
| (unnamed) | src/app/i18n/dni-validator.directive.js:44 | Additional filter (line detection) |

**Correct Pattern**:
```javascript
angular.module('appModule')
    .filter('translate', ['i18nService', function(i18nService) {
        return function(key) {
            return i18nService.translate(key);
        };
    }]);
```

**Usage in Templates**:
```html
{{ 'common.loading' | translate }}
```

---

#### Directive Registration

**Pattern**: `.directive('directiveName', function() { return { ... }; })`

**Detected Directives**:

| Directive | File | Purpose |
|---|---|---|
| dniValidator | src/app/i18n/dni-validator.directive.js:4 | DNI/NIE validation |

**Correct Pattern**:
```javascript
angular.module('appModule')
    .directive('dniValidator', function() {
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                ngModel.$validators.dni = function(modelValue, viewValue) {
                    return isValidDni(viewValue);
                };
            }
        };
    });
```

**Usage in Forms**:
```html
<input type="text" ng-model="dni" dni-validator />
```

---

### UI-Router 1.x APIs

**Module**: `@uirouter/angularjs`

#### Router Configuration

**Pattern**: `.config(['$stateProvider', function($stateProvider) { ... }])`

**Detected Config**:
- src/app/config/app.config.js:4 (angular_config)

**Correct Pattern**:
```javascript
angular.module('appModule')
    .config(['$stateProvider', '$urlRouterProvider', 
        function($stateProvider, $urlRouterProvider) {
            $stateProvider
                .state('consulta', {
                    url: '/consulta-estados-cuentas',
                    templateUrl: 'src/app/pages/consulta-estados-cuentas/consulta-estados-cuentas.template.html',
                    controller: 'ConsultaCtrl',
                    controllerAs: 'vm'
                });
            
            $urlRouterProvider.otherwise('/consulta-estados-cuentas');
        }]);
```

#### Router Outlet

**Pattern**: `<ui-view></ui-view>` in HTML

**Detected Usage**: index.html:14

**Correct Pattern**:
```html
<div class="app-main">
    <ui-view></ui-view>  <!-- Router renders components here -->
</div>
```

#### State Navigation

**Pattern**: `$state.go('stateName', params)` or `ui-sref` directive

**Correct Pattern**:
```javascript
// In controller
$state.go('consulta', { id: 123 });

// In template
<a ui-sref="consulta({ id: 123 })">Go to Consulta</a>
```

---

### AngularJS Built-in Services

These services are injected across the detected codebase:

| Service | Purpose | Used In |
|---|---|---|
| `$http` | HTTP client | ConfigService, i18nService, ApiService |
| `$q` | Promise/deferred handling | HttpErrorInterceptor |
| `$scope` | Component/controller scope | (inferred from pattern usage) |

#### $http Service

**Correct Pattern**:
```javascript
$http.get('/api/endpoint')
    .then(function(response) {
        // Success: response.data
    })
    .catch(function(error) {
        // Error: error.status, error.data
    });
```

**Methods Used**:
- `$http.get(url, config)`
- `$http.post(url, data, config)` (pattern detected, not explicit usage)

---

### HTTP Interceptor Pattern

**Pattern**: `$httpProvider.interceptors.push('InterceptorService')`

**Detected Interceptor**: HttpErrorInterceptor (src/app/config/http.interceptor.js:23)

**Correct Pattern**:
```javascript
// Service definition
.service('HttpErrorInterceptor', ['$q', 'ErrorService', 
    function($q, ErrorService) {
        return {
            responseError: function(rejection) {
                ErrorService.setError(rejection.data.message || 'Unknown error');
                return $q.reject(rejection);
            }
        };
    }])

// Registration in config block
.config(['$httpProvider', function($httpProvider) {
    $httpProvider.interceptors.push('HttpErrorInterceptor');
}]);
```

---

## Testing Framework APIs

### Karma + Jasmine

**Detected Test Files**: 13 test files (tests/*.spec.js)

#### Test Structure

**Correct Pattern**:
```javascript
describe('ServiceName', function() {
    var service;
    var $httpBackend;
    
    beforeEach(module('appModule'));
    
    beforeEach(inject(function(_ServiceName_, _$httpBackend_) {
        service = _ServiceName_;
        $httpBackend = _$httpBackend_;
    }));
    
    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });
    
    it('should do something', function() {
        $httpBackend.expectGET('/api/endpoint').respond(200, { data: 'test' });
        
        service.method();
        
        $httpBackend.flush();
        expect(service.result).toBe('test');
    });
});
```

#### angular-mocks APIs

| API | Purpose | Usage |
|---|---|---|
| `module('appModule')` | Load module for testing | In beforeEach() |
| `inject(function(_Service_) { ... })` | Inject services | In beforeEach() |
| `$httpBackend.expectGET(url)` | Mock HTTP GET | In test specs |
| `$httpBackend.flush()` | Trigger pending HTTP | After async calls |

---

## Package Corrections — Summary

No package-level corrections detected. All imports use correct package names for AngularJS 1.7.x.

---

## Migration Notes: AngularJS → Python/FastAPI

### Service Layer Migration

| AngularJS Pattern | Python/FastAPI Equivalent |
|---|---|
| `.service('ServiceName', ...)` | Python class or function module |
| `$http.get(url)` | `httpx.AsyncClient().get(url)` or `requests.get(url)` |
| Dependency Injection (manual array syntax) | FastAPI Depends() or constructor injection |
| `.config()` block | FastAPI app configuration or settings |

### Template Migration

| AngularJS Pattern | Python/FastAPI (Jinja2) Equivalent |
|---|---|
| `{{ expression }}` | `{{ expression }}` (same syntax) |
| `ng-model="field"` | `<input name="field">` (form handling in backend) |
| `ng-if="condition"` | `{% if condition %}` |
| `ng-repeat="item in items"` | `{% for item in items %}` |
| `{{ key | translate }}` | `{{ _(key) }}` or `{{ gettext(key) }}` |
| `<ui-view></ui-view>` | N/A (server-side routing, no SPA router) |

### Validation Migration

| AngularJS Pattern | Python/FastAPI Equivalent |
|---|---|
| Custom directive validation | Pydantic field validators |
| `dniValidator` directive | `@field_validator('dni')` in Pydantic model |

---

## Python Backend APIs

### Babel/gettext i18n

**Library**: Babel ≥2.13.0  
**Purpose**: Server-side internationalization with gettext message catalogs  
**Source**: navigation-header-i18n implementation

#### Translation Loading Pattern

**Correct Pattern:**
```python
import gettext
from pathlib import Path

translations = {}
LOCALES_DIR = Path(__file__).parent / "locales"

for locale in config.supported_locales:
    translations[locale] = gettext.translation(
        "messages",
        localedir=str(LOCALES_DIR),
        languages=[locale],
    )

def get_translation(locale: str) -> gettext.NullTranslations:
    return translations.get(locale, translations.get(config.default_locale))
```

**Why**: Load all translations once at startup. Retrieve per-request based on user locale.

❌ **Wrong Pattern**: Loading translations on every request
```python
def get_translation(locale: str):
    return gettext.translation("messages", localedir="...", languages=[locale])  # ❌ I/O on every request
```

#### Per-Request Locale Pattern

**Correct Pattern:**
```python
# In template context builder
def get_template_context(request: Request, extra_context: Optional[dict] = None) -> dict:
    locale = getattr(request.state, "locale", config.default_locale)
    trans = get_translation(locale)
    
    context = {
        "current_locale": locale,
        "_": trans.gettext,  # Translation function
    }
    
    if extra_context:
        context.update(extra_context)
    
    return context
```

**Why**: Injects locale-specific translation function into every template render.

#### Template Usage

**Correct Pattern:**
```jinja2
<div class="title">{{ _('page_title') }}</div>
<p>{{ _('welcome_message') }}</p>
```

**Why**: Uses injected `_()` function to translate keys.

❌ **Wrong Pattern**: Hardcoded strings
```jinja2
<div class="title">Account Query</div>  <!-- ❌ Not translatable -->
```

#### Translation File Compilation

**Command**: `pybabel compile -d src/locales -D messages`

**Input**: `src/locales/{locale}/LC_MESSAGES/messages.po`  
**Output**: `src/locales/{locale}/LC_MESSAGES/messages.mo` (binary, loaded by gettext)

**Why**: gettext requires compiled .mo files. .po files are human-readable source.

---

## 📎 Sources

- `.discovery/code/scans/frontend/scan-manifest.json` — Framework and dependency detection
- `.discovery/code/symbols/frontend/index.json` — Service, component, filter, directive registrations (48 JS symbols)
- `.discovery/code/graph/frontend/edges.json` — Module registration relationships (19 REGISTERS edges)
- `package.json` — Dependency versions
- Confidence level: **high** (deterministic extraction from source code and package manifest)
