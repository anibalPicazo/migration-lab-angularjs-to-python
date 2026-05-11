---
version: "1.0"
generated_at: "2026-05-08T13:17:00Z"
source: discovery-knowledge
---

# Task Specification Template
Level: 1 (Global)
Scope: Governance
Category: Process & Templates
Purpose: Standard delivery task template for the Python FastAPI migration project. Pre-filled with project-specific context. Intended for use by @delivery agents to structure all implementation tasks consistently.

> Template for all implementation tasks delivered by `@delivery`.
> Fill in ALL sections before starting implementation.

---

## Task: [TASK-ID] — <Title>

**Scope**: <feature/area>
**Type**: feature | bug | migration | refactor
**Priority**: high | medium | low

## Description

<1-3 sentences describing what needs to be done and why>

## Acceptance Criteria

- [ ] <criterion 1 — testable, specific>
- [ ] <criterion 2>
- [ ] All existing tests pass
- [ ] New tests cover the acceptance criteria
- [ ] Code passes `ruff check .` with zero errors
- [ ] Code passes `ruff format --check .` (no formatting issues)
- [ ] Test coverage ≥ 80% for new code

## References

- Foundation: `.foundation/`
- Guardrails: `.foundation/guardrails.md`
- Anti-patterns: `.foundation/anti-patterns.md`
- Architecture Decisions: `.foundation/architecture-decisions.md`
- Testing Strategy: `.foundation/testing-strategy.md`

## Technical Notes

<optional: implementation hints, known constraints, relevant code paths>

## Out of Scope

<what this task explicitly does NOT cover>

---

## Authoring Rules

### A. Spec Quality Rules (R-1 to R-8)

**R-1: Required Features Must Be Explicit**
- ✅ List all features this task implements with acceptance criteria
- ❌ NEVER write "implement as needed" or "standard CRUD"

**R-2: Forms Consumed/Produced Must Be Named**
- ✅ List all Pydantic models (request/response) with field names and types
- ❌ NEVER write "standard request" or "TBD"

**R-3: Action Types Must Be Listed**
- ✅ Enumerate all endpoint paths and HTTP methods (POST /api/query, GET /api/status)
- ❌ NEVER write "usual endpoints"

**R-4: Error Keys Must Be Enumerated**
- ✅ List all error codes with format `ERROR_<CATEGORY>_<SPECIFIC>` (e.g., `ERROR_VAL_MISSING_DNI`, `ERROR_HTTP_TIMEOUT`)
- ❌ NEVER write "standard validation errors"

**R-5: Package Structure Must Be Defined**
- ✅ Show exact directory structure (`app/routes/`, `app/services/`, `app/models/`, `app/templates/`)
- ❌ NEVER write "organize as appropriate"

**R-6: Endpoint Must Define Request/Response Models**
- ✅ Every endpoint spec includes: path, HTTP method, Pydantic request model, Pydantic response model, error responses
- ❌ NEVER write "returns data" or "accepts parameters"

**R-7: Configuration Keys Must Be Named**
- ✅ List all config keys in `AppConfig` (e.g., `api_base_url`, `request_timeout_ms`, `default_lang`)
- ❌ NEVER write "configure as needed"

**R-8: UI Templates Must List Variables Passed**
- ✅ List all Jinja2 context variables passed to templates (e.g., `{{ document_id }}`, `{{ error_message }}`)
- ❌ NEVER write "template receives data"

### B. Implementation Quality Rules (R-9 to R-16)

**R-9: No Business Logic in Routes (AP-001)**
- ✅ Routes delegate to service layer immediately after request validation
- ❌ NEVER: Route contains httpx calls, business logic, or data processing
- Detection: `grep -rn "httpx\|ValidationError" app/routes/`

**R-10: No Hardcoded Config (AP-002)**
- ✅ All config values loaded from `pydantic-settings` AppConfig class
- ❌ NEVER: Hardcoded URLs, timeouts, or environment-specific values in code
- Detection: `grep -rn "http://\|https://" app/services/`

**R-11: All API Models Are Pydantic (AP-003)**
- ✅ Every route function uses typed Pydantic models for request/response
- ❌ NEVER: `def endpoint(request: dict)` — untyped dicts bypass validation
- Detection: `ruff check --select ANN` (missing annotations)

**R-12: No Async/Sync Mixing (AP-004)**
- ✅ Use synchronous httpx (`httpx.Client()`) consistently
- ❌ NEVER: `httpx.AsyncClient()` or `await client.post(...)` — project is sync-only
- Detection: `grep -rn "AsyncClient\|await.*httpx" app/`

**R-13: No Hardcoded i18n Strings (AP-005)**
- ✅ All user-facing text uses Babel gettext (`_("key")`)
- ❌ NEVER: Hardcoded English/Spanish strings in routes, services, or templates
- Detection: `grep -rn '\"[A-Z][a-z]* [a-z]*\"' app/routes/ app/services/`

**R-14: No Mocking Static Helpers (AP-006)**
- ✅ Static utility functions called directly in tests
- ❌ NEVER: `mocker.patch("app.utils.validate_dni")` — pure functions don't need mocking
- Detection: `grep -rn "mocker.patch.*utils" tests/`

**R-15: Null-Safe Collection Access (Guardrails → Code Safety)**
- ✅ Use `items[0] if items else None` or try/except for list access; use `dict.get("key")` for dict access
- ❌ NEVER: `items[0]` without checking if list is empty; `dict["key"]` without checking if key exists
- Detection: `grep -rn "\[0\]\|data\[\"" app/ | grep -v "\.get("`

**R-16: Deterministic Time via Injection (Guardrails → Deterministic Time)**
- ✅ Inject `TimeProvider` abstraction into services; use `time_provider.get_current_time()` instead of `datetime.now()`
- ❌ NEVER: Direct calls to `datetime.now()` or `time.time()` in service code — makes tests non-deterministic
- Detection: `grep -rn "datetime.now()\|time.time()" app/services/`

---

## §9 Test Specification

> Adapt test structure, annotations, and tooling to pytest for this Python project.

### 9.1 Fixtures Layer

**Rule**: Create test fixtures before writing tests. One fixture module per entity or endpoint.

**Example structure**:
```
tests/
  fixtures/
    query_fixtures.py        # QueryRequest, QueryResponse test data
    config_fixtures.py       # AppConfig test instances
    time_fixtures.py         # FakeTimeProvider for deterministic time
    http_fixtures.py         # respx mocks for httpx calls
```

**Example fixture** (`tests/fixtures/query_fixtures.py`):
```python
import pytest
from app.models.query import QueryRequest, QueryResponse

@pytest.fixture
def valid_query_request():
    return QueryRequest(
        operationType="check_status",
        parameters={"documentId": "12345678A", "documentType": "DNI"},
        timestamp="2026-05-08T12:00:00Z"
    )

@pytest.fixture
def success_query_response():
    return QueryResponse(
        id="req-uuid-1234",
        status="success",
        data={"state": "active", "balance": 1000.50},
        metadata={
            "processingTimeMs": 150,
            "requestId": "req-uuid-1234",
            "timestamp": "2026-05-08T12:00:01Z"
        }
    )
```

### 9.2 Unit Tests

**Test setup** (adapt to pytest):
- Declare mocks for injected dependencies using `pytest-mock` or `unittest.mock`
- **Do NOT mock static utility helpers** — call them directly (e.g., `validate_dni()`, `format_timestamp()`)
- Inject the unit under test with its mocked dependencies
- Set any required configuration values for the test context

**Example unit test** (`tests/services/test_query_service.py`):
```python
import pytest
from unittest.mock import Mock
from app.services.query_service import QueryService
from app.models.query import QueryRequest, QueryResponse

def test_submit_query_success(valid_query_request, success_query_response):
    # Arrange: mock httpx client
    mock_http_client = Mock()
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = success_query_response.dict()
    mock_http_client.post.return_value = mock_response
    
    mock_config = Mock()
    mock_config.api_base_url = "http://mock-middleware.test/api"
    
    service = QueryService(http_client=mock_http_client, config=mock_config)
    
    # Act
    result = service.submit_query(valid_query_request)
    
    # Assert
    assert result.status == "success"
    assert result.id == "req-uuid-1234"
    mock_http_client.post.assert_called_once()
```

**Error test mandatory verifications (all three required per error branch):**

1. **Assert the exception is thrown** — verify it is of the expected type
2. **Assert the error-registration call occurred** — verify the project's error service received the correct arguments (if applicable)
3. **Assert the exact error code** — capture the exception argument and verify the error code constant matches the expected value

**Example error branch test**:
```python
def test_submit_query_missing_document_id(valid_query_request):
    # Arrange
    invalid_request = valid_query_request.copy()
    invalid_request.parameters = {}  # Missing documentId
    
    service = QueryService(...)
    
    # Act & Assert all three verifications
    with pytest.raises(ValidationError) as exc_info:  # 1. Assert exception is thrown
        service.submit_query(invalid_request)
    
    # 3. Assert exact error code
    assert exc_info.value.code == "ERROR_VAL_MISSING_DOCUMENT_ID"
    assert "documentId" in str(exc_info.value)
```

> ⚠️ **A test that only verifies the error-registration call without asserting the exception is thrown is INCOMPLETE** — it cannot detect if the exception is swallowed. All three checks are always required.

### 9.3 Integration Tests

**Purpose**: Test route → service → httpx flow with mocked backend (using `respx`).

**Example** (`tests/integration/test_query_endpoint.py`):
```python
import pytest
import respx
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

@respx.mock
def test_query_endpoint_success(client, valid_query_request, success_query_response):
    # Mock the backend HTTP call
    respx.post("http://mock-middleware.test/api/query").mock(
        return_value=httpx.Response(200, json=success_query_response.dict())
    )
    
    # Act
    response = client.post("/api/query", json=valid_query_request.dict())
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["id"] == "req-uuid-1234"
```

### 9.4 Route / Handler Tests

**Purpose**: Test FastAPI route functions in isolation with mocked service layer.

**Example** (`tests/routes/test_query_routes.py`):
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock
from app.main import app
from app.services.query_service import QueryService

def test_query_route_delegates_to_service(valid_query_request, success_query_response, monkeypatch):
    # Mock the service
    mock_service = Mock(spec=QueryService)
    mock_service.submit_query.return_value = success_query_response
    
    # Inject mock service into FastAPI dependency
    def override_get_service():
        return mock_service
    
    app.dependency_overrides[QueryService] = override_get_service
    
    client = TestClient(app)
    
    # Act
    response = client.post("/api/query", json=valid_query_request.dict())
    
    # Assert
    assert response.status_code == 200
    mock_service.submit_query.assert_called_once()
```

### 9.5 Coverage Thresholds

| Level | Minimum threshold | Enforced by |
|---|---|---|
| **Unit tests** | ≥ 80% | pytest-cov |
| **Integration tests** | ≥ 70% | pytest-cov |
| **Overall** | ≥ 80% | pytest-cov + CI gate |

**Command**:
```bash
pytest --cov=app --cov-report=term-missing --cov-fail-under=80
```

### 9.6 Application Bootstrap Test (mandatory)

**Purpose**: Verify the application starts correctly under the test profile. Uses the project's test configuration (e.g., `tests/.env.test`) with all component URLs and settings populated.

**Example** (`tests/test_app_bootstrap.py`):
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_app_starts_with_test_config():
    """
    Verify the application starts without errors using test configuration.
    This test catches missing config keys, import errors, and startup failures.
    """
    # Arrange: Load test environment
    import os
    os.environ["ENV"] = "test"
    
    # Act: Create test client (triggers app startup)
    client = TestClient(app)
    
    # Assert: Health check or root endpoint responds
    response = client.get("/health")  # Or "/" if no health endpoint
    assert response.status_code == 200
```

**Test environment file** (`tests/.env.test`):
```ini
ENV=test
API_BASE_URL=http://mock-middleware.test/api
DEFAULT_LANG=es-ES
SUPPORTED_LANGS=es-ES,en-EN
REQUEST_TIMEOUT_MS=5000
```

---

## 📎 Sources

- `.discovery/knowledge/ingested/00-migration-requirements.md` → Python tech stack, pytest, respx
- `.discovery/knowledge/ingested/05-guardrails.md` → Test coverage, mocking conventions, quality gates (adapted to pytest)
- `.foundation/guardrails.md` → Authoring rules R-9 to R-16 extracted from anti-patterns and guardrails
- `.foundation/anti-patterns.md` → Implementation quality rules (no business logic in routes, no hardcoded config, etc.)
