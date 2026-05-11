---
version: "1.0"
generated_at: "2026-05-08T13:17:00Z"
source: discovery-knowledge
---

# Coding Conventions
Level: 3 (Application)
Scope: Governance
Category: Engineering Standards
Purpose: Naming, structure, and style conventions for the Python FastAPI migration project. Adapted from original Angular patterns and Python best practices.

> Naming, structure, and style conventions for this project.
> Updated by `@discovery-knowledge` as new documentation is analyzed.

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| **Module (file)** | snake_case | `query_service.py`, `app_config.py` |
| **Class** | PascalCase | `QueryService`, `AppConfig`, `QueryRequest` |
| **Function / Method** | snake_case | `submit_query()`, `get_current_time()` |
| **Variable** | snake_case | `query_count`, `user_id`, `error_message` |
| **Constant** | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT_MS`, `ERROR_VAL_MISSING_DNI` |
| **Pydantic Model** | PascalCase | `QueryRequest`, `QueryResponse`, `ErrorDetail` |
| **Private method** | `_leading_underscore` | `_validate_dni()`, `_format_timestamp()` |
| **Jinja2 template** | kebab-case | `consulta-cuentas.html`, `error-banner.html` |
| **i18n key** | `domain.specific_key` | `errors.invalid_dni`, `titles.submit_query`, `buttons.search` |

## File and Package Structure

```
app/
  main.py                    # FastAPI app initialization
  config.py                  # AppConfig (pydantic-settings)
  routes/                    # FastAPI route definitions
    __init__.py
    query_routes.py          # Query endpoints
    health_routes.py         # Health check endpoints
  services/                  # Business logic layer
    __init__.py
    query_service.py
    time_provider.py         # Deterministic time abstraction
  models/                    # Pydantic models
    __init__.py
    query.py                 # QueryRequest, QueryResponse
    error.py                 # ErrorDetail
    config.py                # AppConfig model
  templates/                 # Jinja2 HTML templates
    base.html                # Base layout
    consulta-cuentas.html    # Feature-specific pages
    components/
      error-banner.html      # Reusable components
      header.html
      footer.html
  static/                    # CSS, images (no JS)
    styles/
      main.css
  locales/                   # i18n translations (Babel/gettext)
    es_ES/
      LC_MESSAGES/
        messages.po          # Spanish translations
        messages.mo          # Compiled
    en_EN/
      LC_MESSAGES/
        messages.po          # English translations
        messages.mo          # Compiled
  utils/                     # Static utility functions
    __init__.py
    validators.py            # validate_dni(), format_date()

tests/
  __init__.py
  conftest.py                # pytest configuration + fixtures
  fixtures/                  # Test data fixtures
    query_fixtures.py
    config_fixtures.py
    time_fixtures.py
  routes/
    test_query_routes.py
  services/
    test_query_service.py
  integration/
    test_query_endpoint.py
  templates/
    test_template_rendering.py
```

**Layer conventions**:
- **routes/**: Accept HTTP requests, validate via Pydantic, delegate to service, return HTTP responses. NO business logic.
- **services/**: Business logic, orchestration, httpx calls. NO HTTP request/response handling.
- **models/**: Pydantic models for data validation. NO logic beyond validators.
- **templates/**: Jinja2 presentation only. NO logic beyond conditionals/loops.
- **utils/**: Pure functions (static helpers). NO state, NO side effects.

## Code Style

| Rule | Value |
|---|---|
| **Indentation** | 4 spaces (Python standard) |
| **Max line length** | 88 characters (Black/ruff default) |
| **Import ordering** | Standard library → third-party → local (sorted alphabetically within groups) |
| **Blank lines between methods** | 1 blank line between methods in a class; 2 blank lines between top-level classes/functions |
| **String quotes** | Double quotes `"..."` preferred (ruff default) |
| **Type hints** | Mandatory on all function signatures (enforced by ruff `--select ANN`) |

**Import order example**:
```python
# Standard library
import os
from datetime import datetime
from typing import Optional

# Third-party
import httpx
from fastapi import FastAPI, Depends
from pydantic import BaseModel

# Local
from app.config import AppConfig
from app.services.query_service import QueryService
```

## Approved Patterns

| Pattern | When to use | Notes |
|---|---|---|
| **Dependency Injection** | For services, config, time provider | Use FastAPI `Depends()` for injection |
| **Pydantic BaseModel** | For all request/response types | Automatic validation + serialization |
| **pydantic-settings** | For runtime configuration | Load from .env or environment variables |
| **Service Layer** | For business logic | One service class per domain area (e.g., QueryService) |
| **Repository Pattern** | (N/A) | No database in this project — all data from middleware |
| **Time Provider Abstraction** | When using `datetime.now()` | Inject TimeProvider for deterministic testing |

**Example: Service with DI**:
```python
class QueryService:
    def __init__(
        self,
        http_client: httpx.Client,
        config: AppConfig,
        time_provider: TimeProvider
    ):
        self.http_client = http_client
        self.config = config
        self.time_provider = time_provider
    
    def submit_query(self, request: QueryRequest) -> QueryResponse:
        # Business logic here
        pass
```

**Example: FastAPI route with DI**:
```python
@app.post("/api/query")
def submit_query(
    request: QueryRequest,
    service: QueryService = Depends(get_query_service)
) -> QueryResponse:
    return service.submit_query(request)
```

## Style Anti-Patterns

| Anti-pattern | Why avoid | Correct alternative |
|---|---|---|
| **Wildcard imports** (`from module import *`) | Pollutes namespace, hides dependencies | Explicit imports: `from module import SpecificClass` |
| **Mutable default arguments** (`def f(x=[]): ...`) | Shared mutable state across calls — classic Python bug | Use `None` and initialize inside: `def f(x=None): x = x or []` |
| **Bare `except:` clauses** | Catches SystemExit, KeyboardInterrupt — bad DX | Catch specific exceptions: `except ValueError:` |
| **String concatenation in loops** | Quadratic time complexity | Use `"".join(list)` or f-strings |
| **Manual file closing** (`f = open(...); f.read(); f.close()`) | Resource leak if exception occurs | Use context manager: `with open(...) as f:` |
| **Type hints without importing** | Type hints as strings lead to errors | Import types: `from typing import Optional` |

## Python Idiomatic Patterns

### Use context managers for resources
```python
# ✅ CORRECT
with open("file.txt") as f:
    data = f.read()

# ✅ CORRECT (httpx)
with httpx.Client() as client:
    response = client.get(url)
```

### Use list comprehensions (when readable)
```python
# ✅ CORRECT
account_ids = [acc.id for acc in accounts if acc.estado == "active"]

# ❌ AVOID (too complex for comprehension)
# Use explicit loop instead
```

### Use f-strings for formatting
```python
# ✅ CORRECT
message = f"User {user_id} submitted query at {timestamp}"

# ❌ AVOID (old style)
message = "User %s submitted query at %s" % (user_id, timestamp)
```

### Use `get()` for dict access with defaults
```python
# ✅ CORRECT
value = data.get("key", "default")

# ❌ AVOID (crashes if key missing)
value = data["key"]
```

### Use type hints on all public functions
```python
# ✅ CORRECT
def submit_query(request: QueryRequest) -> QueryResponse:
    pass

# ❌ AVOID (no type hints)
def submit_query(request):
    pass
```

## Framework-Specific Conventions

### FastAPI route patterns
```python
# ✅ CORRECT: Use Pydantic models
@app.post("/api/query", response_model=QueryResponse)
def submit_query(request: QueryRequest) -> QueryResponse:
    pass

# ✅ CORRECT: Use Depends() for injection
@app.post("/api/query")
def submit_query(
    request: QueryRequest,
    service: QueryService = Depends(get_query_service)
):
    pass

# ❌ AVOID: Untyped dict
@app.post("/api/query")
def submit_query(request: dict):
    pass
```

### Pydantic model patterns
```python
# ✅ CORRECT: Use Field() for validation
from pydantic import BaseModel, Field

class QueryRequest(BaseModel):
    operationType: str = Field(..., min_length=1)
    parameters: dict[str, Any]
    timestamp: Optional[str] = None

# ✅ CORRECT: Use validators for custom validation
from pydantic import validator

class QueryRequest(BaseModel):
    dni: str
    
    @validator("dni")
    def validate_dni_format(cls, v):
        if not re.match(r"^\d{8}[A-Z]$", v):
            raise ValueError("Invalid DNI format")
        return v
```

### Jinja2 template patterns
```python
# ✅ CORRECT: Use {{ }} for variables, {% %} for logic
<h2>{{ _("titles.submit_query") }}</h2>

{% if error_message %}
  <div class="error-banner">{{ error_message }}</div>
{% endif %}

{% for account in accounts %}
  <tr>
    <td>{{ account.id }}</td>
    <td>{{ account.estado }}</td>
  </tr>
{% endfor %}
```

## Contribution Entry

New conventions extracted from the latest documentation batch:
- Python module naming: snake_case for files (adapted from Angular kebab-case)
- Pydantic model naming: PascalCase (adapted from TypeScript interfaces)
- Service layer DI pattern: FastAPI Depends() (adapted from Angular inject())
- Template naming: kebab-case (preserved from Angular component naming)

---

## Module: frontend (AngularJS → Python Migration Mappings)

**Source**: Static code analysis via `@discovery-code`  
**Generated**: 2026-05-11

### Observed AngularJS Naming Patterns

The frontend module follows these AngularJS 1.7.x conventions that should be preserved or adapted during migration:

| AngularJS Pattern | Example | Python/FastAPI Equivalent | Migration Note |
|---|---|---|---|
| **Services**: `{Feature}Service` | `ConfigService`, `CuentasService` | `{Feature}Service` (keep name) | Python class in `services/` directory |
| **Components**: `app-{feature}` (kebab-case) | `app-header`, `app-footer` | `{feature}.html` template | Drop `app-` prefix, use Jinja2 includes |
| **Filters**: `{feature}` (camelCase) | `translate` | `gettext()` or `_()` | Use Babel/gettext functions |
| **Directives**: `{feature}Validator` | `dniValidator` | `@field_validator('{feature}')` | Pydantic validator decorator |
| **Methods**: camelCase | `consultarEstadosCuentas()` | `consultar_estados_cuentas()` | Convert to snake_case (Python convention) |
| **Config files**: JSON runtime load | `config.json` | Pydantic Settings + `.env` | Replace runtime JSON with compile-time settings |

### AngularJS File Structure → Python Structure Mapping

```
# AngularJS structure (observed)
src/app/
  ├── app.module.js                     → app/main.py (FastAPI app init)
  ├── config/
  │   ├── app.config.js                 → app/config.py (Pydantic Settings)
  │   └── http.interceptor.js           → app/middleware/error_interceptor.py
  ├── services/
  │   ├── api.service.js                → app/services/api_service.py (httpx wrapper)
  │   ├── config.service.js             → (eliminated — use Pydantic Settings)
  │   ├── cuentas.service.js            → app/services/cuentas_service.py
  │   ├── error.service.js              → app/services/error_service.py
  │   └── i18n.service.js               → (eliminated — use Babel/gettext directly)
  ├── components/
  │   ├── error-banner/                 → app/templates/components/error-banner.html
  │   ├── footer/                       → app/templates/components/footer.html
  │   ├── header/                       → app/templates/components/header.html
  │   └── loading-spinner/              → app/templates/components/loading-spinner.html
  ├── pages/
  │   └── consulta-estados-cuentas/     → app/templates/consulta-estados-cuentas.html
  │                                       + app/routes/consulta_routes.py
  └── i18n/
      ├── translate.filter.js           → (use Babel _() in templates)
      └── dni-validator.directive.js    → app/utils/validators.py::validate_dni()
```

### Dependency Injection Pattern Migration

**AngularJS** (array-based explicit DI):
```javascript
.service('CuentasService', ['ApiService', 'MockDataService', 
    function(ApiService, MockDataService) {
        this.consultarEstadosCuentas = function(dni) {
            return ApiService.get('/cuentas/' + dni);
        };
    }]);
```

**Python/FastAPI** (Depends() injection):
```python
from fastapi import Depends
import httpx

class CuentasService:
    def __init__(
        self,
        api_client: httpx.AsyncClient = Depends(get_api_client),
        config: AppConfig = Depends(get_config)
    ):
        self.api_client = api_client
        self.config = config
    
    async def consultar_estados_cuentas(self, dni: str) -> dict:
        url = f"{self.config.api_url}/cuentas/{dni}"
        response = await self.api_client.get(url)
        response.raise_for_status()
        return response.json()
```

### Error Handling Pattern Migration

**AngularJS** (centralized ErrorService + HTTP interceptor):
```javascript
// HTTP Interceptor
.service('HttpErrorInterceptor', ['$q', 'ErrorService', 
    function($q, ErrorService) {
        return {
            responseError: function(rejection) {
                ErrorService.setError(rejection.data.message);
                return $q.reject(rejection);
            }
        };
    }]);

// Registration
.config(['$httpProvider', function($httpProvider) {
    $httpProvider.interceptors.push('HttpErrorInterceptor');
}]);
```

**Python/FastAPI** (middleware + exception handlers):
```python
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException

@app.middleware("http")
async def error_handling_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except HTTPException as exc:
        # Log error, set error state for template
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail}
        )
    except Exception as exc:
        # Unexpected errors
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Internal server error"}
        )
```

### i18n Pattern Migration

**AngularJS** (custom filter + JSON translation files):
```javascript
// Template usage
{{ 'common.loading' | translate }}

// Service
.service('i18nService', ['$http', function($http) {
    this.load = function(lang) {
        return $http.get('/src/assets/i18n/' + lang + '.json');
    };
}]);
```

**Python/FastAPI** (Babel/gettext):
```python
# Setup (app/main.py)
from babel.support import Translations

translations = Translations.load('locales', ['es_ES'])
_ = translations.gettext

# Template usage (Jinja2)
<h2>{{ _('common.loading') }}</h2>

# Route/service usage
error_msg = _('errors.invalid_dni')
```

**Translation File Migration**:
```bash
# Extract keys from templates
pybabel extract -F babel.cfg -o messages.pot app/templates/

# Initialize language catalogs
pybabel init -i messages.pot -d app/locales -l es_ES
pybabel init -i messages.pot -d app/locales -l en_EN

# Compile .po → .mo
pybabel compile -d app/locales
```

### CSS Class Preservation

**Preserve these CSS classes** from AngularJS for visual consistency:

| Class | Purpose | Keep in Python/FastAPI |
|---|---|---|
| `.app-container`, `.app-main` | Layout structure | ✅ Yes |
| `.btn`, `.btn-primary`, `.btn-secondary` | Buttons | ✅ Yes |
| `.form-group`, `.form-control`, `.form-label` | Forms | ✅ Yes |
| `.error-message`, `.error` | Error display | ✅ Yes |
| `.loading-spinner` | Loading state | ✅ Yes |
| `.hidden`, `.visible` | Visibility toggles | ✅ Yes |

Copy `src/styles/main.css` to `app/static/styles/main.css` with minimal changes.

### Configuration Management Migration

**AngularJS** (runtime JSON load):
```json
{
  "mode": "demo",
  "apiUrl": "http://localhost:8080/api",
  "defaultLang": "es-ES"
}
```

**Python/FastAPI** (Pydantic Settings + environment variables):
```python
# app/config.py
from pydantic_settings import BaseSettings

class AppConfig(BaseSettings):
    mode: str = "demo"  # or "real"
    api_url: str = "http://localhost:8080/api"
    default_lang: str = "es-ES"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# .env file
MODE=real
API_URL=https://production.api.com
DEFAULT_LANG=es-ES
```

### Testing Pattern Migration

**AngularJS** (Karma + Jasmine + angular-mocks):
```javascript
describe('CuentasService', function() {
    var service, $httpBackend;
    
    beforeEach(module('appModule'));
    beforeEach(inject(function(_CuentasService_, _$httpBackend_) {
        service = _CuentasService_;
        $httpBackend = _$httpBackend_;
    }));
    
    it('should call API', function() {
        $httpBackend.expectGET('/api/cuentas/12345678Z')
            .respond(200, { data: 'test' });
        service.consultarEstadosCuentas('12345678Z');
        $httpBackend.flush();
    });
});
```

**Python/FastAPI** (pytest + httpx mocking):
```python
# tests/services/test_cuentas_service.py
import pytest
from httpx import AsyncClient, Response
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_consultar_estados_cuentas(mock_api_client):
    # Arrange
    mock_response = Response(200, json={"data": "test"})
    mock_api_client.get = AsyncMock(return_value=mock_response)
    
    service = CuentasService(api_client=mock_api_client, config=test_config)
    
    # Act
    result = await service.consultar_estados_cuentas("12345678Z")
    
    # Assert
    assert result == {"data": "test"}
    mock_api_client.get.assert_called_once_with(
        "http://localhost:8080/api/cuentas/12345678Z"
    )
```

### Validation Pattern Migration

**AngularJS** (custom directive):
```javascript
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

function isValidDni(dni) {
    var dniRegex = /^\d{8}[A-Z]$/;
    return dniRegex.test(dni);
}
```

**Python/FastAPI** (Pydantic validator):
```python
# app/models/query.py
from pydantic import BaseModel, field_validator
import re

class QueryRequest(BaseModel):
    dni: str
    
    @field_validator('dni')
    @classmethod
    def validate_dni_format(cls, v: str) -> str:
        if not re.match(r'^\d{8}[A-Z]$', v):
            raise ValueError('Invalid DNI format. Expected 8 digits + 1 uppercase letter')
        return v

# app/utils/validators.py (optional standalone)
def validate_dni(dni: str) -> bool:
    """Validate Spanish DNI format."""
    return bool(re.match(r'^\d{8}[A-Z]$', dni))
```

---

## 📎 Sources

- `.discovery/knowledge/ingested/04-patterns.md` → Component architecture, dependency injection, reactive patterns (adapted to Python FastAPI + Pydantic)
- `.discovery/knowledge/ingested/02-tech-stack.md` → TypeScript naming conventions (adapted to Python)
- `.discovery/knowledge/ingested/00-migration-requirements.md` → Python 3.12 stack, FastAPI framework, Jinja2 templating
- `.discovery/code/symbols/frontend/index.json` → AngularJS naming patterns (48 service/component/filter registrations)
- `.discovery/code/scans/frontend/scan-manifest.json` → File structure and organization
- `.discovery/code/graph/frontend/edges.json` → Dependency injection patterns (19 REGISTERS edges)
