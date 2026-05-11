---
version: "1.0"
generated_at: "2026-05-08T13:17:00Z"
source: discovery-knowledge
---

# Architectural Guardrails
Level: 1 (Global)
Scope: Governance
Category: Engineering Standards
Purpose: Non-negotiable principles and constraints for the Python FastAPI migration project. Extracted from migration requirements, tech stack, and original Angular guardrails adapted to Python. Violation blocks delivery.

> Non-negotiable principles and constraints. Violation is a build blocker.
> Updated by `@discovery-knowledge` as new documentation is analyzed.

## Core Principles

1. **Python 3.12 Mandatory**: No fallback to older Python versions. All code must be compatible with Python 3.12.

2. **Virtual Environment via uv**: All development and runtime must use a venv created and managed by `uv`. Direct pip usage is forbidden.

3. **Dependency Declaration**: All runtime dependencies in `pyproject.toml` (direct), all locked versions in `uv.lock` (reproducible). Never commit lock file conflicts without resolution.

4. **Server-Side Rendering Only**: No client-side JavaScript frameworks. All HTML rendered by Jinja2 on the server. UI interactivity (if any) uses plain JavaScript or HTML forms only.

5. **Backend-for-Frontend Pattern**: FastAPI acts as an intermediary between browser and Spring Boot middleware. Direct browser-to-middleware calls are forbidden (CORS constraint).

6. **Stateless Application**: No database persistence in FastAPI layer. All state comes from middleware API responses or user session (if implemented).

7. **Configuration Without Recompilation**: Application configuration (API base URL, language, timeout) must be loaded at runtime. No hardcoded values that require rebuild.

8. **Type Safety**: All data models use Pydantic with strict validation. No untyped dictionaries for API requests/responses.

## Approved Tech Stack

| Role | Technology | Version | Notes |
|---|---|---|---|
| **Language** | Python | 3.12 | Mandatory, no fallback |
| **Framework** | FastAPI | latest | Web framework + BFF layer |
| **ASGI Server** | uvicorn[standard] | latest | Production server |
| **Templating** | Jinja2 | latest | Server-side HTML rendering |
| **HTTP Client** | httpx | latest | Synchronous mode only |
| **Data Validation** | Pydantic | latest | Request/response models |
| **Configuration** | pydantic-settings | latest | Environment-based config |
| **i18n** | Babel | latest | Backend internationalization (gettext) |
| **Testing** | pytest | latest | Unit + integration tests |
| **HTTP Mocking** | respx | latest | Mock httpx calls in tests |
| **Linting/Formatting** | ruff | latest | Code quality enforcement |
| **Dependency Manager** | uv | latest | Create venv, manage dependencies |

## Forbidden Patterns

| Pattern | Why forbidden | Correct alternative |
|---|---|---|
| **Client-side SPA frameworks** (React, Vue, Angular) | Migration target is server-side rendering | Use Jinja2 templates |
| **Async HTTP calls** | Architecture uses synchronous httpx | Use `httpx.Client()` (sync), not `httpx.AsyncClient()` |
| **Hardcoded API URLs** | Config must be runtime-loadable | Load from `pydantic-settings` config class |
| **Untyped API models** | Leads to runtime errors, bypasses validation | Define Pydantic models for all API contracts |
| **Direct pip install** | Bypasses uv lock file | Use `uv add <package>` or `uv sync` |
| **Console.log equivalent** (`print()` in production) | Noise in production logs | Use proper logging (Python `logging` module) |
| **Hardcoded i18n strings** | Breaks multi-language requirement | Use Babel gettext (`_("key")`) for all user-facing text |

## Quality Gates

| Gate | Requirement |
|---|---|
| **Test Coverage** | ≥ 80% (pytest with coverage plugin) |
| **Linting** | `ruff check .` must pass with zero errors |
| **Formatting** | `ruff format .` must pass (no uncommitted changes) |
| **Type Checking** | All Pydantic models must validate correctly |
| **Dependency Security** | No known vulnerabilities in `uv.lock` |

## Endpoint Conventions

### FastAPI Route Definitions

1. **Path structure**: `/api/<resource>` for all endpoints that proxy to middleware
   - ❌ Wrong: `/query`, `/getStatus`
   - ✅ Correct: `/api/query`, `/api/status`

2. **HTTP methods**: Use semantic HTTP verbs
   - POST for operations that submit/create data
   - GET for read-only queries
   - ❌ Wrong: GET request with body parameters
   - ✅ Correct: POST request with Pydantic model body

3. **Request/Response types**: All endpoints must use Pydantic models
   - ❌ Wrong: `async def query(request: dict)`
   - ✅ Correct: `async def query(request: QueryRequest) -> QueryResponse`

4. **Error responses**: Return structured ErrorDetail in response body
   - ❌ Wrong: Raise generic HTTPException with string message
   - ✅ Correct: Return QueryResponse with `status="error"` and `errors: List[ErrorDetail]`

### Detection Command

```bash
# Check for untyped endpoints
ruff check --select ANN # Missing type annotations
```

## Testing Guardrails

### Prohibited Test Patterns

| Anti-pattern | Why forbidden | Correct replacement |
|---|---|---|
| **Mocking static helpers** | Static functions have no side effects; mocking them is noise | Call static helpers directly |
| **Tests without assertions** | Cannot detect failures | Every test must have at least one assertion |
| **Hardcoded test data in test methods** | Duplication, hard to maintain | Use pytest fixtures |
| **Skipped tests without reason** | Technical debt | Remove skip or add `reason="<why>"` and ticket reference |

### Test Helper Usage

- One fixture module per entity or endpoint (e.g., `tests/fixtures/query_fixtures.py`)
- Reusable test data in fixtures, not duplicated across test files
- Use `respx` to mock httpx calls to middleware (never mock the middleware itself in unit tests)

### Test Environment Activation

⚠️ **Mandatory**: All integration tests must explicitly activate the test configuration.

**Test configuration**: `tests/.env.test` (or equivalent config file)

**Rule**: Without explicit test config activation, the application will attempt to load production config, and HTTP calls will target real URLs.

**Example activation** (adapt to project structure):

```python
# tests/conftest.py
import pytest
from pydantic_settings import BaseSettings

@pytest.fixture(scope="session", autouse=True)
def load_test_config():
    # Force test environment
    import os
    os.environ["ENV"] = "test"
    # Load test config
    from app.config import settings
    settings.reload()  # Reload with test env
```

**Template for `tests/.env.test`**:

```ini
ENV=test
API_BASE_URL=http://mock-middleware.test/api
DEFAULT_LANG=es-ES
SUPPORTED_LANGS=es-ES,en-EN
REQUEST_TIMEOUT_MS=5000
```

## Code Safety Patterns

### Null-Guard on Collection/Index Access

```python
# ❌ WRONG - crashes if list is empty
first_item = items[0]

# ✅ CORRECT - safe access
first_item = items[0] if items else None
# Or use try/except IndexError
```

### Null-Check on Dictionary Key Lookups

```python
# ❌ WRONG - crashes if key missing
value = data["key"]

# ✅ CORRECT - safe access
value = data.get("key")  # Returns None if missing
value = data.get("key", default_value)  # Returns default if missing
```

### Component Layer Rules

1. **Routes (FastAPI endpoints)**: Accept HTTP requests, validate via Pydantic, delegate to service layer, return HTTP responses. No business logic.
2. **Services**: Business logic, orchestration, calls to httpx client. No HTTP request/response handling.
3. **Models (Pydantic)**: Data validation only. No logic.
4. **Templates (Jinja2)**: Presentation only. No logic beyond conditionals/loops.

## Deterministic Time

⚠️ **Rule**: System time MUST NOT be called directly in service code.

**Context**: Testing code that uses `datetime.now()` or `time.time()` produces non-deterministic tests. Assertions on timestamps will fail on different runs.

**Requirements**:

1. A time-provider abstraction must be injected into the service (via constructor or FastAPI dependency injection)
2. The time-provider interface defines a single method: `get_current_time() -> datetime`
3. Production implementation returns `datetime.now()`; test implementation returns a fixed/controllable time

**Example implementation**:

```python
# app/services/time_provider.py
from datetime import datetime
from abc import ABC, abstractmethod

class TimeProvider(ABC):
    @abstractmethod
    def get_current_time(self) -> datetime:
        pass

class RealTimeProvider(TimeProvider):
    def get_current_time(self) -> datetime:
        return datetime.now()

# Inject into service
class QueryService:
    def __init__(self, time_provider: TimeProvider):
        self.time_provider = time_provider
    
    def create_query(self, operation_type: str, params: dict):
        return QueryRequest(
            operationType=operation_type,
            parameters=params,
            requestedAt=self.time_provider.get_current_time()
        )
```

**Test usage**:

```python
# tests/fixtures/time_fixtures.py
class FakeTimeProvider(TimeProvider):
    def __init__(self, fixed_time: datetime):
        self.fixed_time = fixed_time
    
    def get_current_time(self) -> datetime:
        return self.fixed_time

# In test
def test_query_timestamp():
    fixed_time = datetime(2026, 5, 8, 12, 0, 0)
    time_provider = FakeTimeProvider(fixed_time)
    service = QueryService(time_provider)
    
    query = service.create_query("check_status", {"id": "123"})
    assert query.requestedAt == fixed_time  # Deterministic!
```

## 📎 Sources

- `.discovery/knowledge/ingested/00-migration-requirements.md` → Tech stack, dependencies, Python version, uv requirement, architecture notes
- `.discovery/knowledge/ingested/02-tech-stack.md` → Original Angular tech stack (adapted principles to Python)
- `.discovery/knowledge/ingested/05-guardrails.md` → Code safety patterns, quality gates, testing rules (adapted to pytest)
- `.discovery/knowledge/ingested/03-data-model.md` → Endpoint structure, request/response models
