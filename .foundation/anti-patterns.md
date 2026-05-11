---
version: "1.0"
generated_at: "2026-05-08T13:17:00Z"
source: discovery-knowledge
---

# Anti-Patterns
Level: 1 (Global)
Scope: Governance
Category: Engineering Standards
Purpose: Forbidden patterns for the Python FastAPI migration project. Extracted from original Angular patterns/guardrails docs and adapted to Python layered service architecture. Each entry includes detection command and correct alternative.

> Forbidden patterns extracted from documentation. Each entry includes detection and correct alternative.
> Updated by `@discovery-knowledge` as new documentation is analyzed.

## AP-001 — Business Logic in FastAPI Route

**Context**: FastAPI routes (endpoints) should only handle HTTP concerns — request validation, response formatting, and delegation to service layer.

**Why forbidden**: Mixing business logic into routes violates separation of concerns, makes testing harder (requires HTTP mocking), and prevents logic reuse across multiple endpoints.

❌ **Wrong**:
```python
@app.post("/api/query")
def submit_query(request: QueryRequest):
    # Business logic directly in route
    if not request.parameters.get("documentId"):
        raise HTTPException(status_code=400, detail="Missing documentId")
    
    # Direct HTTP call in route
    response = httpx.post(
        f"{config.api_base_url}/query",
        json=request.dict()
    )
    
    # Processing in route
    if response.status_code == 200:
        data = response.json()
        # ...more logic
        return QueryResponse(**data)
    else:
        raise HTTPException(status_code=500, detail="Backend error")
```

✅ **Correct**:
```python
# Route delegates to service
@app.post("/api/query")
def submit_query(request: QueryRequest, service: QueryService = Depends()):
    return service.submit_query(request)

# Service contains business logic
class QueryService:
    def __init__(self, http_client: httpx.Client, config: AppConfig):
        self.http_client = http_client
        self.config = config
    
    def submit_query(self, request: QueryRequest) -> QueryResponse:
        # Validation
        if not request.parameters.get("documentId"):
            raise ValidationError("Missing documentId")
        
        # HTTP call
        response = self.http_client.post(
            f"{self.config.api_base_url}/query",
            json=request.dict()
        )
        
        # Processing
        if response.status_code == 200:
            return QueryResponse(**response.json())
        else:
            raise BackendError(f"Middleware error: {response.status_code}")
```

**Detection**:
```bash
# Search for httpx calls or business logic in route files
grep -rn "httpx\|ValidationError" app/routes/
# Should return 0 matches — all logic should be in services
```

---

## AP-002 — Hardcoded Configuration Values

**Context**: Application must support demo mode vs real mode, different API URLs per environment, and runtime language selection without recompiling.

**Why forbidden**: Hardcoding values requires rebuilding the application for each environment change. Violates "Configuration Without Recompilation" guardrail.

❌ **Wrong**:
```python
# Hardcoded in service
class QueryService:
    def submit_query(self, request: QueryRequest):
        response = httpx.post(
            "http://localhost:8080/api/query",  # ❌ Hardcoded
            json=request.dict(),
            timeout=5.0  # ❌ Hardcoded timeout
        )
```

✅ **Correct**:
```python
# Configuration class using pydantic-settings
from pydantic_settings import BaseSettings

class AppConfig(BaseSettings):
    api_base_url: str
    request_timeout_ms: int
    default_lang: str
    
    class Config:
        env_file = ".env"

# Inject config into service
class QueryService:
    def __init__(self, config: AppConfig, http_client: httpx.Client):
        self.config = config
        self.http_client = http_client
    
    def submit_query(self, request: QueryRequest):
        response = self.http_client.post(
            f"{self.config.api_base_url}/query",
            json=request.dict(),
            timeout=self.config.request_timeout_ms / 1000
        )
```

**Detection**:
```bash
# Search for hardcoded URLs in service files
grep -rn "http://\|https://" app/services/
# Should only find references to config variables, not literal URLs
```

---

## AP-003 — Untyped API Models (Dict Instead of Pydantic)

**Context**: All API request/response structures must use Pydantic models for validation and type safety.

**Why forbidden**: Using untyped `dict` bypasses Pydantic validation, allows invalid data to propagate, and eliminates IDE autocomplete/type checking benefits.

❌ **Wrong**:
```python
@app.post("/api/query")
def submit_query(request: dict):  # ❌ Untyped dict
    operation_type = request.get("operationType")  # No validation
    if not operation_type:
        # Manual validation required
        raise HTTPException(status_code=400, detail="Missing operationType")
    # ...
```

✅ **Correct**:
```python
# Define Pydantic model
class QueryRequest(BaseModel):
    operationType: str
    parameters: dict[str, Any]
    timestamp: Optional[str] = None

@app.post("/api/query")
def submit_query(request: QueryRequest):  # ✅ Typed and validated
    # operationType is guaranteed to exist and be a string
    operation_type = request.operationType
    # ...
```

**Detection**:
```bash
# Search for route functions with dict parameters
ruff check --select ANN # Missing type annotations
grep -rn "def.*request: dict" app/routes/
```

---

## AP-004 — Mixing Async/Sync HTTP Calls

**Context**: Architecture decision is to use synchronous httpx (not async), because FastAPI route functions are not async in this project.

**Why forbidden**: Mixing async and sync httpx calls creates confusion, requires different client initialization, and violates architectural consistency.

❌ **Wrong**:
```python
# Service uses async httpx
class QueryService:
    async def submit_query(self, request: QueryRequest):
        async with httpx.AsyncClient() as client:
            response = await client.post(...)  # ❌ Async in sync project
```

✅ **Correct**:
```python
# Service uses sync httpx
class QueryService:
    def __init__(self, http_client: httpx.Client):
        self.http_client = http_client
    
    def submit_query(self, request: QueryRequest):
        response = self.http_client.post(...)  # ✅ Sync
```

**Detection**:
```bash
# Search for async httpx usage
grep -rn "AsyncClient\|await.*httpx" app/
# Should return 0 matches
```

---

## AP-005 — Hardcoded i18n Strings

**Context**: Application must support Spanish (es-ES) and English (en-EN). All user-facing text must be translatable.

**Why forbidden**: Hardcoded strings cannot be translated. Breaks internationalization requirement.

❌ **Wrong**:
```python
# Hardcoded error message
if not document_id:
    raise HTTPException(status_code=400, detail="Document ID is required")

# Hardcoded template text
return templates.TemplateResponse("query.html", {
    "title": "Submit Query"  # ❌ Hardcoded English
})
```

✅ **Correct**:
```python
# Using Babel gettext
from flask_babel import gettext as _

if not document_id:
    raise HTTPException(
        status_code=400,
        detail=_("errors.document_id_required")
    )

# Template with i18n
return templates.TemplateResponse("query.html", {
    "title": _("titles.submit_query")
})
```

**Detection**:
```bash
# Search for English strings in routes/services (heuristic: strings with spaces)
grep -rn '\"[A-Z][a-z]* [a-z]*\"' app/routes/ app/services/
# Should return 0 user-facing strings
```

---

## AP-006 — Mocking Static Utility Functions in Tests

**Context**: Static utility helpers (e.g., `validate_dni()`, `format_timestamp()`) are pure functions with no side effects.

**Why forbidden**: Mocking static helpers adds noise without value. These functions should be tested directly, not mocked.

❌ **Wrong**:
```python
# Test mocks a static helper
def test_submit_query(mocker):
    mocker.patch("app.utils.validate_dni", return_value=True)
    # ❌ Mocking a pure function is noise
    service = QueryService()
    result = service.submit_query(...)
```

✅ **Correct**:
```python
# Test calls static helper directly
def test_submit_query():
    # No mocking of validate_dni — call it directly
    service = QueryService()
    result = service.submit_query(...)
    # validate_dni is called as part of service execution
```

**Detection**:
```bash
# Search for mocker.patch on utility modules
grep -rn "mocker.patch.*utils\|mock.*utils" tests/
# Should return 0 matches on pure utility functions
```

---

## AP-007 — Tests Without Assertions

**Context**: Every test must verify expected behavior with at least one assertion.

**Why forbidden**: Tests without assertions cannot detect failures. They pass even when the code is broken.

❌ **Wrong**:
```python
def test_submit_query():
    service = QueryService()
    service.submit_query(QueryRequest(...))
    # ❌ No assertion — test always passes
```

✅ **Correct**:
```python
def test_submit_query():
    service = QueryService()
    result = service.submit_query(QueryRequest(...))
    assert result.status == "success"  # ✅ Verifies expected outcome
    assert result.id is not None
```

**Detection**:
```bash
# Search for test functions without 'assert'
pytest --collect-only -q | while read test; do
  grep -L "assert" "$test" 2>/dev/null
done
```

---

## AP-008 — Client-Side JavaScript Frameworks

**Context**: Migration target is server-side rendering (Jinja2). No client-side SPA frameworks.

**Why forbidden**: Introduces complexity, violates SSR architecture decision, and defeats the purpose of the migration (simplifying frontend).

❌ **Wrong**:
```html
<!-- Template includes React/Vue/Angular -->
<div id="app"></div>
<script src="react.js"></script>
<script src="app.bundle.js"></script>
```

✅ **Correct**:
```html
<!-- Server-rendered HTML with Jinja2 -->
<div class="query-form">
  <h2>{{ _("titles.submit_query") }}</h2>
  <form method="POST" action="/api/query">
    <input type="text" name="documentId" value="{{ document_id }}">
    <button type="submit">{{ _("buttons.submit") }}</button>
  </form>
</div>
```

**Detection**:
```bash
# Search for SPA framework references in templates
grep -rn "react\|vue\|angular\|@angular" app/templates/
# Should return 0 matches
```

---

## AP-009 — Unsafe Collection/Index Access

**Context**: Accessing list elements or dict keys without checking existence causes IndexError or KeyError.

**Why forbidden**: Leads to runtime crashes that could be prevented with safe access patterns.

❌ **Wrong**:
```python
# Unsafe list access
first_item = items[0]  # ❌ Crashes if list is empty

# Unsafe dict access
value = data["key"]  # ❌ Crashes if key missing
```

✅ **Correct**:
```python
# Safe list access
first_item = items[0] if items else None

# Safe dict access
value = data.get("key")  # Returns None if missing
value = data.get("key", "default")  # Returns default if missing
```

**Detection**:
```bash
# Search for direct indexing without guards
ruff check --select PT # pytest-specific rules
grep -rn "\[0\]\|\[1\]\|data\[\"" app/ | grep -v "\.get("
```

---

## 📎 Sources

- `.discovery/knowledge/ingested/04-patterns.md` → Component architecture, Signals patterns (adapted to Python services)
- `.discovery/knowledge/ingested/05-guardrails.md` → TypeScript strict mode, change detection, optional chaining (adapted to Python type safety)
- `.discovery/knowledge/ingested/00-migration-requirements.md` → SSR architecture, sync httpx, demo mode
- `.discovery/knowledge/ingested/02-tech-stack.md` → Angular patterns (adapted to FastAPI/Pydantic)
