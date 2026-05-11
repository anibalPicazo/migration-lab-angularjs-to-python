## Context

The AngularJS 1.x frontend currently implements account balance querying through a client-side component (`consulta-estados-cuentas`) that handles:
- DNI-based account search with real-time validation
- Interactive table with multi-select checkboxes
- Bulk operations (query all accounts or only selected ones)
- Real-time loading states and validation feedback

The Python migration requires server-side rendering (SSR) using FastAPI + Jinja2. This design addresses the challenge of replicating interactive form validation and multi-step workflows without client-side JavaScript frameworks.

**Constraints:**
- No client-side SPA frameworks (React, Vue, Angular)
- Server-side rendering only (Jinja2 templates)
- Synchronous httpx for backend calls
- Support demo mode (mocks) and real mode (Spring Boot middleware)
- Maintain identical UX and validation behavior

## Goals / Non-Goals

**Goals:**
- Implement DNI validation on the server with proper Spanish checksum calculation
- Render account query page with form validation errors displayed inline
- Support POST-based form submissions with redirect-after-post pattern to avoid double submissions
- Integrate with CuentasService backend (real or mock mode) via httpx
- Maintain functional parity with AngularJS version (same inputs, outputs, validations, error states)
- Preserve i18n support for es-ES and en-EN

**Non-Goals:**
- Client-side JavaScript validation or AJAX calls (SSR only)
- Persistent session state across requests (stateless BFF pattern)
- Database integration in FastAPI layer (middleware handles data)
- Real-time field validation without form submission (not possible with SSR)

## Decisions

### Decision 1: Form Submission Architecture

**Chosen:** POST-redirect-GET (PRG) pattern for all form submissions.

**Rationale:** 
- Prevents accidental duplicate submissions on browser refresh
- Standard pattern for server-side form handling
- Allows clean separation between rendering (GET) and processing (POST)

**Alternatives considered:**
- Single endpoint with GET/POST combined → rejected due to complexity in distinguishing render vs submit
- AJAX + JSON responses → rejected (violates SSR-only constraint)

**Implementation:**
- GET `/consulta-estados-cuentas` → render form (optionally with validation errors from flash session)
- POST `/consulta-estados-cuentas/buscar-dni` → validate + search → redirect to GET with results
- POST `/consulta-estados-cuentas/consultar-todos` → query all → redirect to GET with updated results
- POST `/consulta-estados-cuentas/consultar-seleccionados` → query selected → redirect to GET with updated results

### Decision 2: DNI Validation Strategy

**Chosen:** Server-side validation with Spanish DNI checksum algorithm.

**Rationale:**
- Spanish DNI format: 8 digits + 1 letter (e.g., 12345678Z)
- Letter is calculated from modulo 23 of the numeric part
- Validation must happen on server to prevent bypass

**Algorithm:**
```python
VALID_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"

def validate_dni(dni: str) -> bool:
    if not re.match(r'^\d{8}[A-Z]$', dni.upper()):
        return False
    digits = int(dni[:8])
    letter = dni[8].upper()
    return VALID_LETTERS[digits % 23] == letter
```

**Alternatives considered:**
- Regex-only validation without checksum → rejected (doesn't catch invalid letter)
- Third-party library for Spanish ID validation → rejected (overkill for single algorithm)

### Decision 3: Account Selection State Management

**Chosen:** Form-based checkbox submission with hidden fields for account IDs.

**Rationale:**
- Standard HTML form pattern compatible with SSR
- Selected account IDs sent as repeated form field (`account_id=1&account_id=2&...`)
- Server receives list, validates existence, and processes

**Implementation:**
```html
<form method="POST" action="/consulta-estados-cuentas/consultar-seleccionados">
    {% for cuenta in cuentas %}
    <input type="checkbox" name="account_id" value="{{ cuenta.id }}" 
           {% if cuenta.id in selected_ids %}checked{% endif %}>
    {% endfor %}
    <button type="submit">Consultar Seleccionados</button>
</form>
```

**Alternatives considered:**
- JavaScript-based selection tracking → rejected (violates SSR constraint)
- Stateful session storage of selections → rejected (complicates stateless BFF pattern)

### Decision 4: Backend Integration Mode Selection

**Chosen:** Runtime configuration via `pydantic-settings` to switch between demo and real modes.

**Rationale:**
- `config.mode` (from environment or config file) determines mock vs real backend
- CuentasService internally routes to MockDataService or HttpxBackendClient
- No code changes needed to switch modes

**Implementation:**
```python
class CuentasService:
    def __init__(self, config: AppConfig):
        self.backend = (
            MockDataService() if config.mode == "demo" 
            else HttpxBackendClient(config.api_url)
        )
    
    def buscar_por_dni(self, dni: str) -> List[Cuenta]:
        return self.backend.buscar_por_dni(dni)
```

**Alternatives considered:**
- Separate code paths with if/else in every endpoint → rejected (duplication)
- Feature flags at route level → rejected (violates single responsibility)

### Decision 5: Validation Feedback Display

**Chosen:** Flash messages + inline form errors in Jinja2 template.

**Rationale:**
- After POST with validation error, redirect to GET with error details in session flash
- Template renders errors next to form fields
- Preserves user input values via query params or flash data

**Implementation:**
```python
# In route handler
if not validate_dni(form_dni):
    flash("errors.invalid_dni", "error")
    return RedirectResponse(url=f"/consulta-estados-cuentas?dni={form_dni}", status_code=303)

# In template
{% if get_flashed_messages(category_filter=["error"]) %}
    <div class="error">{{ _('errors.invalid_dni') }}</div>
{% endif %}
```

**Alternatives considered:**
- Query string for errors → rejected (exposes internal error codes, ugly URLs)
- Separate error page → rejected (poor UX, breaks form context)

## Risks / Trade-offs

### Risk 1: Real-time validation feedback not possible

**Risk:** Users accustomed to AngularJS version see immediate DNI validation (✓/✗ icons). SSR version requires form submission to validate.

**Mitigation:** 
- Add clear placeholder text with DNI format example
- Show validation error prominently after submission
- Consider progressive enhancement with minimal JavaScript for client-side regex validation (future)

### Risk 2: Checkbox state lost on validation error

**Risk:** If user selects multiple accounts and form validation fails, selections could be lost on redirect.

**Mitigation:** 
- Pass selected IDs via flash session or query params
- Template pre-checks boxes based on preserved state
- Document limitation in migration notes if edge cases exist

### Risk 3: Performance overhead from POST-redirect-GET

**Risk:** Every form submission requires 2 HTTP requests (POST + redirect GET), doubling latency.

**Mitigation:** 
- Acceptable trade-off for SSR architecture benefits (simplicity, security)
- Typical form interactions are infrequent (not real-time)
- If performance becomes issue, consider caching rendered partials

### Risk 4: Backend API changes not detected at compile time

**Risk:** Spring Boot middleware API contract changes won't be caught by Pydantic until runtime.

**Mitigation:** 
- Define Pydantic models matching middleware contract (manual alignment)
- Comprehensive integration tests with respx mocking
- Future: Consider OpenAPI spec generation from middleware for contract validation

## Migration Plan

### Phase 1: Core structure (1 session)
1. Create route module `src/routes/consulta_estados_cuentas.py` with GET endpoint
2. Create base Jinja2 template `src/templates/consulta_estados_cuentas.html` with form
3. Wire route into FastAPI app

### Phase 2: DNI validation (1 session)
1. Implement `validate_dni()` in `src/utils/validators.py`
2. Add POST `/consulta-estados-cuentas/buscar-dni` endpoint
3. Add Pydantic model `DniBuscarForm` in `src/models/consulta.py`
4. Unit tests for DNI validation edge cases

### Phase 3: Backend integration (1 session)
1. Add methods to `src/services/cuentas_service.py`: `buscar_por_dni()`, `consultar_estados()`
2. Add Pydantic models: `Cuenta`, `EstadoCuenta`, `CuentasResponse`
3. Integration tests with respx mocking

### Phase 4: Multi-select + bulk operations (1 session)
1. Add checkbox rendering in template
2. Add POST endpoints for `consultar-todos` and `consultar-seleccionados`
3. Implement selection state preservation on redirect

### Phase 5: i18n + error handling (1 session)
1. Add translation keys to `messages.po` files
2. Implement flash message error display
3. E2E test coverage for full flow

### Rollback Strategy

Since this is a new feature in the Python stack (not replacing existing functionality), rollback is not applicable. If bugs are discovered:
- Fix forward (hotfix branch)
- Disable route via feature flag if critical issue
- Users can continue using AngularJS version until fixed
