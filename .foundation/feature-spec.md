---
version: "1.0"
generated_at: "2026-05-08T13:17:00Z"
source: discovery-knowledge
---

# Feature Spec Template
Level: 1 (Global)
Scope: Governance
Category: Process & Templates
Purpose: Standardized feature specification template for the Python FastAPI migration project. Pre-filled with project-specific context from ingested docs. Used by @delivery agents to structure feature implementation consistently.

> Template for feature specifications delivered by `@delivery`.
> Fill in ALL sections before starting implementation.

---

# Feature Spec: <Feature Name>

**Feature ID**: <TASK-XXX / internal id>

**Owner**: <name/role>

**Service owner(s)**: <service/module names — see Domain Landscape>

**Status**: Draft | Ready for Plan | In Implementation | Validated | Done

**Last updated**: <YYYY-MM-DD>

---

## 0. Purpose of this Feature Spec

This document is the primary execution context for AI agents implementing this feature.

It must be operationally standalone: enough detail to implement + test without hunting through other docs.

Links exist for traceability, not as required reading for first-pass implementation.

---

## 1. Intent and Outcome

**Guidance**: One paragraph: what changes for the user/system when this feature is delivered.

**Example (Python migration context)**:

Enable users to submit DNI and retrieve all associated account states via server-rendered HTML form. The FastAPI application queries the Spring Boot middleware, renders results in a Jinja2 table, and displays operation status with internationalized messages (es-ES / en-EN).

---

## 2. Scope (In / Out)

**Guidance**: Define sharp scope boundaries; agents need explicit limits.

**In**:
- <what is included>

**Out**:
- <what is explicitly excluded>

**Example (Python migration context)**:

**In**:
- FastAPI route accepting POST with DNI parameter
- Pydantic model for request validation
- Service layer calling Spring Boot middleware via httpx (sync)
- Jinja2 template rendering results table
- Error handling with internationalized messages (Babel/gettext)
- Demo mode fixture data for standalone testing

**Out**:
- User authentication (handled by Spring Boot if required)
- Database persistence in FastAPI layer (stateless BFF)
- Client-side JavaScript interactivity (SSR-only)
- Document upload or file attachments

---

## 3. Primary Constraints and Guardrails

**Guidance**: Pull only the feature-relevant constraints from `.foundation/guardrails.md`.

**Must**:
- Use Pydantic models for all API request/response types
- Use synchronous httpx (no async)
- Delegate all business logic to service layer (no logic in routes)
- Load config from `pydantic-settings` (no hardcoded URLs)
- All user-facing text via Babel gettext (`_("key")`)
- Test coverage ≥ 80%
- Pass `ruff check .` and `ruff format --check .`

**Must not**:
- Hardcode API URLs, timeouts, or environment-specific values
- Use untyped `dict` for request/response (use Pydantic)
- Mix async/sync httpx calls
- Put business logic in FastAPI routes (AP-001)
- Mock static utility helpers in tests (AP-006)
- Call `datetime.now()` directly in services (use injected TimeProvider)

---

## 4. Functional Behaviour (What "correct" means)

**Guidance**: Describe behaviour in clear, testable terms. Avoid vague prose.

### 4.1 Acceptance Scenarios (executable style)

**Guidance**: Provide 2–5 scenarios. Keep them deterministic. These drive test generation.

**Format**:
```
Scenario: <name>
  Given <preconditions>
  When <action>
  Then <expected result>
```

**Example (Python migration context)**:

**Scenario 1: Submit valid DNI and retrieve accounts**
```
Given Spring Boot middleware has 3 accounts for DNI "12345678A"
When user submits POST /api/consulta-cuentas with DNI "12345678A"
Then FastAPI returns 200 with QueryResponse containing 3 accounts
And Jinja2 template renders table with 3 rows
And each row shows account ID and estado
```

**Scenario 2: Reject invalid DNI format**
```
Given user submits POST /api/consulta-cuentas with DNI "invalid"
When DNI validation fails (invalid format)
Then FastAPI returns 400 with ErrorDetail
And ErrorDetail.code == "ERROR_VAL_INVALID_DNI"
And Jinja2 template renders error banner with message from i18n key "errors.invalid_dni"
```

**Scenario 3: Handle middleware timeout**
```
Given Spring Boot middleware does not respond within 5000ms
When httpx timeout exception is raised
Then FastAPI returns 503 with ErrorDetail
And ErrorDetail.code == "ERROR_HTTP_TIMEOUT"
And error is logged with structured context (endpoint, timeout value)
```

---

## 5. Domain and Data (What changes in the model)

**Guidance**: Pull the minimum necessary from `.foundation/domain-landscape.md`; do not redefine the full model.

### 5.1 Entities and fields touched

**Example (Python migration context)**:

**QueryRequest** (Pydantic model):
- `operationType: str` (e.g., "consulta_cuentas")
- `parameters: dict[str, Any]` (e.g., `{"dni": "12345678A"}`)
- `timestamp: Optional[str]`

**QueryResponse** (Pydantic model):
- `id: str` (UUID)
- `status: Literal["success", "error", "pending"]`
- `data: Optional[Any]` (account list for this feature)
- `errors: Optional[List[ErrorDetail]]`
- `metadata: Optional[dict[str, Any]]`

**ErrorDetail** (Pydantic model):
- `code: str` (error constant)
- `message: str` (localized via i18n)
- `field: Optional[str]`
- `details: Optional[Any]`

### 5.2 Data invariants specific to this feature

**Example (Python migration context)**:
- QueryRequest.operationType must be from allowed list: `["consulta_cuentas", "consultar_todos", "consultar_seleccionados"]`
- If QueryResponse.status == "error", then QueryResponse.errors must be non-empty
- QueryResponse.id must match QueryRequest.id (correlation)

### 5.3 Persistence / migration notes (if needed)

**Guidance**: FastAPI application is stateless — no database migrations required. All state comes from Spring Boot middleware.

N/A for this project (stateless BFF).

---

## 6. Service Ownership and Boundaries

**Guidance**: Use `.foundation/domain-landscape.md` (Functional Areas) to place responsibilities.

**Example (Python migration context)**:

- **FastAPI BFF** owns:
  - HTTP request validation (Pydantic)
  - HTML rendering (Jinja2)
  - Internationalization (Babel/gettext)
  - Proxying requests to Spring Boot middleware
  - Error formatting and display
  
- **Spring Boot Middleware** owns (external):
  - Business logic for account queries
  - Legacy system integration
  - Data persistence
  - CORS headers (allows FastAPI origin)

**Boundary**:
- FastAPI does NOT call legacy systems directly → always via Spring Boot middleware
- FastAPI does NOT persist data → stateless; all state from middleware responses

---

## 7. Interfaces (API / Events / Integrations)

**Guidance**: Only include what this feature adds/changes.

### 7.1 API changes

**New endpoint**:
- `POST /api/consulta-cuentas`
  - **Request**: `QueryRequest` (Pydantic)
  - **Response**: `QueryResponse` (Pydantic)
  - **Errors**: 400 (validation), 503 (timeout), 500 (middleware error)

**Example request**:
```json
{
  "operationType": "consulta_cuentas",
  "parameters": {
    "dni": "12345678A"
  },
  "timestamp": "2026-05-08T12:00:00Z"
}
```

**Example success response**:
```json
{
  "id": "req-uuid-1234",
  "status": "success",
  "data": [
    {"id": "CTA-001", "estado": "active"},
    {"id": "CTA-002", "estado": "pending"}
  ],
  "metadata": {
    "processingTimeMs": 150,
    "requestId": "req-uuid-1234",
    "timestamp": "2026-05-08T12:00:01Z"
  }
}
```

### 7.2 Event changes (if applicable)

N/A for this project (no event bus).

### 7.3 External dependencies

**Spring Boot Middleware**:
- **Base URL**: Loaded from `AppConfig.api_base_url` (runtime config)
- **Timeout**: `AppConfig.request_timeout_ms` (default 5000ms)
- **HTTP method**: POST
- **Path**: `/api/query` (standard middleware endpoint)
- **Retry policy**: None (fail-fast per guardrails)
- **Error handling**: 4xx/5xx responses wrapped in ErrorDetail

---

## 8. UI / User Journey (required for SSR features)

**Journey slice**:

**Entry**: User navigates to `/consulta-cuentas` page (GET renders form)

**Steps**:
1. User sees HTML form with DNI input field (Jinja2 template)
2. User enters DNI (e.g., "12345678A")
3. User clicks "Buscar" button (submits POST to `/api/consulta-cuentas`)
4. FastAPI validates DNI, calls Spring Boot middleware
5. Middleware returns account list
6. FastAPI renders results in HTML table (Jinja2)
7. User sees table with account IDs and estados

**Exit**: User can select accounts and trigger further operations (consultar_todos / consultar_seleccionados)

**UI intent**:
- User must understand: which DNI was queried, how many accounts were found, status of each account
- User must be able to: enter DNI, submit query, see results, identify errors clearly

**Jinja2 context variables** (passed to template):
- `{{ dni }}` — the queried DNI
- `{{ accounts }}` — list of account dicts: `[{id, estado}, ...]`
- `{{ error_message }}` — localized error message (if error occurred)
- `{{ current_date }}` — footer date (formatted)

---

## 9. Test Expectations

**Guidance**: Explicitly state test types expected so the agent generates the right mix.

**Required test types for this feature**:

1. **Unit tests** (service layer):
   - `QueryService.submit_query()` with valid request → returns QueryResponse
   - `QueryService.submit_query()` with invalid DNI → raises ValidationError
   - `QueryService.submit_query()` with middleware timeout → raises TimeoutError
   - All error branches verify: (1) exception thrown, (2) error code correct, (3) error message localized

2. **Integration tests** (route + service + httpx mock):
   - `POST /api/consulta-cuentas` with valid DNI → 200 response with accounts
   - `POST /api/consulta-cuentas` with invalid DNI → 400 response with error
   - `POST /api/consulta-cuentas` with middleware timeout (respx mock) → 503 response
   
3. **Template rendering tests**:
   - Jinja2 template receives context with accounts → renders table with correct rows
   - Jinja2 template receives error context → renders error banner with localized message

4. **Negative tests**:
   - Missing DNI parameter → 400
   - Malformed JSON request → 400
   - Middleware returns 500 → FastAPI returns 500 with wrapped error

5. **Fixture tests** (demo mode):
   - Service in demo mode returns fixture data without calling httpx

**Coverage target**: ≥ 80% for new code (enforced by `pytest --cov-fail-under=80`)

---

## 10. Observability / Rollout (optional, but recommended)

**Guidance**: Keep it minimal; focus on what must be instrumented.

**Logging**:
- Structured log on request start: `{"event": "query_start", "operation": "consulta_cuentas", "dni": "<redacted>"}`
- Structured log on middleware call: `{"event": "middleware_call", "url": "<endpoint>", "timeout_ms": 5000}`
- Structured log on error: `{"event": "query_error", "error_code": "ERROR_HTTP_TIMEOUT", "details": "..."}`

**Metrics** (optional):
- `query_requests_total{operation="consulta_cuentas"}` — counter
- `middleware_response_time_ms{endpoint="/api/query"}` — histogram
- `query_errors_total{error_code="ERROR_HTTP_TIMEOUT"}` — counter

**Rollout**:
- N/A (no feature flag for migration — all features delivered incrementally)

---

## 11. Open Questions / Decisions Needed

**Guidance**: Keep short; unresolved items must block "Ready for Plan".

**Example**:
- [ ] Should DNI validation be strict (Spanish DNI format only) or accept international IDs?
- [ ] Should middleware timeout be configurable per-endpoint or global?
- [ ] Is demo mode activated by environment variable or config file?

---

## 12. References (canonical sources)

**Guidance**: Links for traceability. Do not require these for basic implementation.

- **Project Intent**: `.foundation/project-intent.md`
- **Domain Landscape**: `.foundation/domain-landscape.md`
- **Guardrails**: `.foundation/guardrails.md`
- **Anti-Patterns**: `.foundation/anti-patterns.md`
- **Architecture Decisions**: `.foundation/architecture-decisions.md`
- **Task Spec Template**: `.foundation/task-spec.md`
- **Testing Strategy**: `.foundation/testing-strategy.md` (if available)

---

## 13. Change Log

- `<YYYY-MM-DD>` — Initial draft — `<author>`
- `<YYYY-MM-DD>` — Updated scope and constraints — `<author>`

---

## 📎 Sources

- `.discovery/knowledge/ingested/00-migration-requirements.md` → Python tech stack, demo/real mode, i18n
- `.discovery/knowledge/ingested/03-data-model.md` → QueryRequest, QueryResponse, ErrorDetail entity definitions
- `.foundation/guardrails.md` → Endpoint conventions, testing guardrails, code safety patterns
- `.foundation/domain-landscape.md` → Functional areas, domain glossary
- `.foundation/project-intent.md` → Migration context, success criteria
- `.github/templates/foundational_context/feature-spec.md` → Base template structure (adapted)
