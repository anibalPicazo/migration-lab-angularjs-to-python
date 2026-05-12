---
version: "1.1"
generated_at: "2026-05-11T00:00:00Z"
source: delivery-specify
status: READY
---

# Feature Spec: Navigation Header with Language Selector

**Feature ID**: NAV-HEADER-001

**Owner**: @delivery

**Service owner(s)**: app (main application)

**Status**: Ready for Plan

**Last updated**: 2026-05-11

---

## 0. Purpose of this Feature Spec

This document is the primary execution context for AI agents implementing the Navigation Header feature. It is operationally standalone: enough detail to implement + test without hunting through other docs. Links exist for traceability, not as required reading for first-pass implementation.

---

## 1. Intent and Outcome

Migrate the AngularJS `app-header` component to Python FastAPI server-side rendering. The header will display at the top of all pages, showing the application title (internationalized) on the left and a language selector dropdown on the right. When users select a different language (es-ES or en-EN), the page reloads with the new language preference persisted via session cookie, and all text is re-rendered in the selected language.

**User-visible change**: Users see a persistent header bar across all pages with a language selector that allows instant switching between Spanish and English.

**Technical change**: Jinja2 base template includes a reusable header component with server-side language detection and session-based persistence.

---

## 2. Scope (In / Out)

### In Scope

- Jinja2 base template (`src/templates/base.html`) with header inclusion
- Reusable header component template (`src/templates/components/header.html`)
- Language selector dropdown with es-ES and en-EN options
- FastAPI route to handle language switching: `POST /api/set-language`
- Session cookie persistence for language preference (`lang` cookie, HttpOnly, 7-day expiry)
- Language detection logic: cookie → query param (`?lang=`) → Accept-Language header → default (es_ES)
- Babel/gettext integration for header text: `page_title` translation key
- CSS styling for header layout (title left, selector right, responsive)
- Update existing page template (`consulta_estados_cuentas.html`) to extend `base.html`
- Unit tests for language detection logic
- Integration tests for `/api/set-language` endpoint
- Template rendering tests for header component

### Out of Scope

- User authentication/authorization (future feature)
- Navigation menu with multiple pages (only single page exists currently)
- Footer component migration (separate feature)
- Client-side JavaScript interactivity (SSR-only architecture)
- Language auto-detection based on geolocation
- Additional languages beyond es-ES and en-EN
- User profile language preference persistence (requires authentication)

---

## 3. Primary Constraints and Guardrails

**Must**:
- Use Jinja2 templates for all HTML rendering (no client-side frameworks)
- Use Babel/gettext for all user-facing strings (`_("key")` in Python, `{{ _('key') }}` in Jinja2)
- Store language preference in HttpOnly session cookie (`lang=es_ES|en_EN`, 7-day expiry, SameSite=Lax)
- Load `AppConfig.supported_locales` and `AppConfig.default_locale` from configuration
- Implement language detection in the following priority order:
  1. Session cookie (`lang`)
  2. Query parameter (`?lang=es_ES` or `?lang=en_EN`)
  3. `Accept-Language` HTTP header (parse first language code)
  4. Default from `AppConfig.default_locale`
- Pass `ruff check .` and `ruff format --check .` (zero errors)
- Test coverage ≥ 80%
- Header must be responsive (mobile-friendly)

**Must not**:
- Use client-side JavaScript for language switching (violates SSR-only architecture, see ADR-001)
- Hardcode language labels or translation keys (use Babel)
- Hardcode supported locales list (load from `AppConfig.supported_locales`)
- Store language preference in URL path (e.g., `/es/consulta`, `/en/consulta`) — use cookie/query param
- Implement logout or session management (out of scope, no authentication yet)

**Applicable guardrails** (from `.foundation/guardrails.md`):
- GR-004: Server-Side Rendering Only — no client-side frameworks
- GR-007: Configuration Without Recompilation — locale settings from `pydantic-settings`
- GR-008: Type Safety — all models use Pydantic

**Applicable anti-patterns** (from `.foundation/anti-patterns.md`):
- AP-001: Business logic in routes — language detection logic must be in service/utility layer
- AP-006: Mocking static utility helpers — do not mock `parse_accept_language()` in tests

---

## 4. Functional Behaviour (What "correct" means)

### 4.1 Acceptance Scenarios (executable style)

**Scenario 1: First visit with no language preference (uses default)**
```
Given user visits application for the first time
And no "lang" cookie exists
And no "lang" query parameter is present
And Accept-Language header is not set
When page loads
Then header displays application title in Spanish (es_ES default)
And language selector shows "es-ES" as selected
And "lang" cookie is set to "es_ES" (7-day expiry, HttpOnly, SameSite=Lax)
```

**Scenario 2: User changes language via selector**
```
Given user is viewing page in Spanish (es_ES)
And "lang" cookie is set to "es_ES"
When user selects "en-EN" from language dropdown
Then browser submits POST /api/set-language with body {"locale": "en_EN"}
And server sets "lang" cookie to "en_EN"
And server redirects to current page (HTTP 302, Location: Referer or "/")
And page reloads with header title in English
And all page content re-renders in English
```

**Scenario 3: Language preference persists across page reloads**
```
Given user previously selected English (en_EN)
And "lang" cookie is set to "en_EN"
When user navigates to any page
Then header displays application title in English
And language selector shows "en-EN" as selected
And all page content renders in English
```

**Scenario 4: Query parameter overrides cookie (temporary switch)**
```
Given user has "lang" cookie set to "es_ES"
When user visits page with "?lang=en_EN" query parameter
Then page renders in English (query param priority)
And header displays title in English
But "lang" cookie remains unchanged (no persistence from query param)
```

**Scenario 5: Accept-Language header detection (fallback)**
```
Given user has no "lang" cookie
And no "lang" query parameter is present
And browser sends "Accept-Language: en-US,en;q=0.9,es;q=0.8" header
When page loads
Then application detects "en" from header
And maps to "en_EN" locale
And header displays title in English
And "lang" cookie is set to "en_EN"
```

---

## 5. Domain and Data (What changes in the model)

### 5.1 Data Model Changes

**New Pydantic Models**:

```python
# src/models/language.py

from pydantic import BaseModel, Field

class SetLanguageRequest(BaseModel):
    """Request body for POST /api/set-language."""
    locale: str = Field(
        ...,
        description="Language locale code (es_ES or en_EN)",
        pattern="^(es_ES|en_EN)$"
    )

class LanguageContext(BaseModel):
    """Language detection result used in templates."""
    current_locale: str  # Detected locale (es_ES or en_EN)
    supported_locales: list[str]  # From AppConfig
    locale_labels: dict[str, str]  # {"es_ES": "Español", "en_EN": "English"}
```

**Configuration (existing `AppConfig` — no changes needed)**:
- `default_locale: str = "es_ES"` (already exists)
- `supported_locales: list[str] = ["es_ES", "en_EN"]` (already exists)

**Session Cookie Schema**:
- **Name**: `lang`
- **Value**: `es_ES` | `en_EN`
- **Expiry**: 7 days
- **HttpOnly**: `true` (prevents JavaScript access)
- **SameSite**: `Lax` (CSRF protection)
- **Secure**: `false` (local dev); `true` in production (if HTTPS)

### 5.2 Translation Keys (Babel/gettext)

**New keys** (to be added to `src/locales/{locale}/LC_MESSAGES/messages.po`):

| Key | es_ES Translation | en_EN Translation | Usage |
|---|---|---|---|
| `page_title` | "Consulta Estados Cuenta" | "Account Status Inquiry" | Header title |
| `language_selector_label` | "Idioma" | "Language" | Accessibility label for dropdown |
| `locale_es_ES` | "Español" | "Spanish" | Language option label |
| `locale_en_EN` | "Inglés" | "English" | Language option label |

**Existing keys to verify**:
- All existing keys in AngularJS `src/assets/i18n/*.json` must have corresponding Babel entries
- Priority: `page_title` (header), `label_dni`, `btn_search`, `no_results`, error messages

### 5.3 Template Data Context

**Data passed to all templates** (via Jinja2 globals or request context):

```python
{
    "current_locale": "es_ES",  # Detected locale
    "supported_locales": ["es_ES", "en_EN"],
    "locale_labels": {
        "es_ES": _("locale_es_ES"),  # "Español"
        "en_EN": _("locale_en_EN")   # "English"
    }
}
```

---

## 6. Service Ownership

**Primary Owner**: `app` (main application module)

**Impacted Files** (new):
- `src/templates/base.html` — Base layout with header inclusion
- `src/templates/components/header.html` — Reusable header component
- `src/routes/language_routes.py` — FastAPI route for `/api/set-language`
- `src/services/language_service.py` — Language detection logic
- `src/models/language.py` — Pydantic models for language switching
- `tests/routes/test_language_routes.py` — Route integration tests
- `tests/services/test_language_service.py` — Service unit tests
- `tests/templates/test_header_rendering.py` — Template rendering tests

**Impacted Files** (modified):
- `src/templates/consulta_estados_cuentas.html` — Extend `base.html` instead of standalone HTML
- `src/main.py` — Register `language_routes` router, configure Jinja2 globals for locale context
- `src/config.py` — No changes (locale config already exists)

**Dependencies**:
- `babel` — i18n library (already in dependencies)
- `pydantic` — data validation (already in dependencies)
- No new external dependencies required

---

## 7. Interfaces

### 7.1 New API Endpoint

**POST /api/set-language**

**Purpose**: Update user's language preference and persist in session cookie.

**Request**:
```json
POST /api/set-language
Content-Type: application/json

{
  "locale": "en_EN"
}
```

**Request Validation**:
- `locale` must be one of: `es_ES`, `en_EN` (Pydantic pattern validation)
- Returns 422 Unprocessable Entity if validation fails

**Response** (success):
```
HTTP/1.1 302 Found
Location: <Referer header value or "/">
Set-Cookie: lang=en_EN; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax
```

**Response** (validation error):
```json
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "detail": [
    {
      "loc": ["body", "locale"],
      "msg": "string does not match regex '^(es_ES|en_EN)$'",
      "type": "value_error.str.regex"
    }
  ]
}
```

**Authorization**: None (public endpoint)

**Idempotency**: Yes (multiple identical requests have same effect)

### 7.2 M3 Gate — API Contract Verification

**Verification Table**:

| Endpoint | Method | Request Schema | Response | Status | Foundation Source |
|---|---|---|---|---|---|
| `/api/set-language` | POST | `SetLanguageRequest` (new) | 302 redirect + cookie | ✅ New capability | `.foundation/architecture-decisions.md` (ADR-004: i18n backend-managed) |

**Notes**:
- This endpoint does not exist in the AngularJS original (client-side i18n did not require server endpoint)
- New capability is justified by architectural decision ADR-004 (backend-managed i18n)
- No conflicts with existing `.foundation/api-contracts.md` (backend contracts unchanged)

**M3 Gate Status**: ✅ **PASS** — New endpoint aligns with ADR-004; no contract conflicts

---

## 8. UI/Journey (What users see and do)

### 8.1 Visual Layout

**Header Structure**:
```
┌────────────────────────────────────────────────────┐
│  [Page Title]                      [🌐 es-ES ▼]   │
└────────────────────────────────────────────────────┘
```

**Layout Rules**:
- Header spans full viewport width
- Title on left (flex-start), language selector on right (flex-end)
- Mobile: title wraps to second line if needed; selector stays top-right
- Header background: light gray (#f5f5f5); border-bottom: 1px solid #ddd
- Padding: 15px horizontal, 10px vertical

### 8.2 Language Selector UI

**Component**: HTML `<form>` with `<select>` dropdown

**Behavior**:
- Dropdown shows current locale as selected
- Options: "Español (es-ES)", "English (en-EN)"
- On change: auto-submit form via JavaScript `onchange="this.form.submit()"`
- Form submits POST to `/api/set-language` with `locale` in body
- Server responds with 302 redirect → browser reloads page with new language

**Accessibility**:
- Label: `{{ _('language_selector_label') }}` (visually hidden but accessible to screen readers)
- Dropdown has `aria-label` attribute
- Keyboard navigable (arrow keys + Enter)

### 8.3 User Journey (Single Page Context)

**Current state**: Application has one page: "Consulta Estados Cuentas"

**Journey Flow**:
1. User visits `/` or `/consulta-estados-cuentas` (both render same page)
2. Header displays at top with language selector
3. User interacts with query form (existing functionality)
4. If user changes language:
   - Selects new locale from dropdown
   - Page reloads with header + form labels in new language
   - Query results (if any) re-render with new translations

### 8.4 M4 Gate — Route Inventory Verification

**Route Classification**:

| Route | Type | Migration Impact | Status | Foundation Source |
|---|---|---|---|---|
| `/` | Existing (implicit) | No change (already renders consulta page) | ✅ Verified | `.foundation/service-map.md` (bootstrap flow) |
| `/consulta-estados-cuentas` | Existing (not implemented yet in Python, only AngularJS) | Template refactor (extend `base.html`) | ✅ Verified | `.foundation/service-map.md` (UI-Router state) |
| `/api/set-language` | **New capability** | Required for backend i18n (ADR-004) | ✅ Approved | `.foundation/architecture-decisions.md` (ADR-004) |

**New Capability Justification**:
- AngularJS used client-side i18n (no server endpoint needed)
- Python SSR requires server-side language switching endpoint
- Aligns with architectural decision ADR-004 (backend-managed i18n via Babel/gettext)
- No alternative: SSR cannot switch language without server round-trip

**M4 Gate Status**: ✅ **PASS** — New route approved; existing routes verified

---

## 9. Test Expectations

### 9.1 Unit Tests

**File**: `tests/services/test_language_service.py`

| Test Case | Scenario | Assertion |
|---|---|---|
| `test_detect_language_from_cookie` | Cookie `lang=en_EN` exists | Returns `"en_EN"` |
| `test_detect_language_from_query_param` | Query `?lang=es_ES`, no cookie | Returns `"es_ES"` |
| `test_detect_language_from_header` | `Accept-Language: en-US` | Returns `"en_EN"` (mapped) |
| `test_detect_language_default` | No cookie, query, or header | Returns `"es_ES"` (config default) |
| `test_parse_accept_language_header` | Header `"en-US,en;q=0.9,es;q=0.8"` | Parses to `["en-US", "en", "es"]` |
| `test_map_locale_code_es` | Input `"es"` or `"es-ES"` | Maps to `"es_ES"` |
| `test_map_locale_code_en` | Input `"en"` or `"en-US"` | Maps to `"en_EN"` |
| `test_invalid_locale_fallback` | Input `"fr_FR"` (unsupported) | Falls back to `"es_ES"` |

**File**: `tests/models/test_language.py`

| Test Case | Scenario | Assertion |
|---|---|---|
| `test_set_language_request_valid_es` | `{"locale": "es_ES"}` | Validation passes |
| `test_set_language_request_valid_en` | `{"locale": "en_EN"}` | Validation passes |
| `test_set_language_request_invalid` | `{"locale": "fr_FR"}` | Validation fails (Pydantic error) |

### 9.2 Integration Tests

**File**: `tests/routes/test_language_routes.py`

| Test Case | Scenario | Assertion |
|---|---|---|
| `test_set_language_success` | POST `/api/set-language` with `{"locale": "en_EN"}` | Returns 302, sets cookie `lang=en_EN` |
| `test_set_language_redirect_to_referer` | POST with `Referer: /consulta-estados-cuentas` header | Redirects to `/consulta-estados-cuentas` |
| `test_set_language_invalid_locale` | POST with `{"locale": "invalid"}` | Returns 422 (validation error) |
| `test_set_language_cookie_attributes` | POST `/api/set-language` | Cookie has `HttpOnly`, `SameSite=Lax`, `Max-Age=604800` |

### 9.3 Template Rendering Tests

**File**: `tests/templates/test_header_rendering.py`

| Test Case | Scenario | Assertion |
|---|---|---|
| `test_header_renders_title_es` | Locale `es_ES` | Title displays "Consulta Estados Cuenta" |
| `test_header_renders_title_en` | Locale `en_EN` | Title displays "Account Status Inquiry" |
| `test_header_language_selector_selected` | Current locale `en_EN` | Dropdown shows `en_EN` as selected |
| `test_base_template_includes_header` | Render `base.html` | HTML contains `<header>` element with class `app-header` |

### 9.4 Coverage Target

- **Unit tests**: ≥ 85% coverage for `language_service.py`
- **Integration tests**: ≥ 80% coverage for `language_routes.py`
- **Overall**: ≥ 80% (enforced by pytest-cov)

---

## 10. Observability

### 10.1 Logging

**Events to log** (using Python `logging` module):

| Event | Level | Message Template | Context |
|---|---|---|---|
| Language detected | DEBUG | `"Language detected: {locale} (source: {source})"` | `locale="es_ES"`, `source="cookie|query|header|default"` |
| Language switched | INFO | `"User switched language: {old_locale} → {new_locale}"` | `old_locale="es_ES"`, `new_locale="en_EN"` |
| Invalid locale rejected | WARNING | `"Invalid locale received: {locale}"` | `locale="fr_FR"` |
| Accept-Language parse error | WARNING | `"Failed to parse Accept-Language header: {header}"` | `header=<raw header value>` |

**Log format** (structured JSON in production):
```json
{
  "timestamp": "2026-05-11T10:30:00Z",
  "level": "INFO",
  "message": "User switched language: es_ES → en_EN",
  "context": {
    "old_locale": "es_ES",
    "new_locale": "en_EN",
    "client_ip": "192.168.1.100"
  }
}
```

### 10.2 Metrics (Future)

**Potential metrics** (not implemented in this feature):
- Language distribution (% users per locale)
- Language switch frequency (switches per session)
- Default language override rate (% users changing from default)

---

## 11. Open Questions

### Resolved

✅ **Q1**: Should language preference persist indefinitely or have expiry?  
**A**: 7-day cookie expiry (industry standard for non-critical preferences). Rationale: Balances persistence with flexibility for shared devices.

✅ **Q2**: Should URL path include language prefix (e.g., `/es/consulta`)?  
**A**: No. Use cookie + query param. Rationale: Simpler routing, avoids URL duplication, aligns with ADR-004.

✅ **Q3**: Should language selector reload page or switch instantly (client-side)?  
**A**: Reload page (server round-trip). Rationale: SSR-only architecture (ADR-001); no client-side JavaScript allowed.

✅ **Q4**: Should Accept-Language header detection be case-insensitive?  
**A**: Yes. Parse `"en-US"`, `"en-us"`, `"EN-US"` all as `"en"`. Rationale: Browser implementations vary.

### Pending (Blocker)

None — all questions resolved. Feature is READY for plan/proposal.

---

## 12. References

### Foundation Documents

| Document | Section | Relevance |
|---|---|---|---|
| `.foundation/project-intent.md` | Vision, Objectives | Migration context: SSR, i18n requirement |
| `.foundation/architecture-decisions.md` | ADR-001, ADR-004 | SSR-only architecture; backend i18n via Babel |
| `.foundation/guardrails.md` | GR-004, GR-007, GR-008 | SSR-only, config without recompilation, type safety |
| `.foundation/coding-conventions.md` | Template structure, naming | Jinja2 conventions, file structure |
| `.foundation/testing-strategy.md` | Test pyramid, mocking rules | Coverage targets, fixture conventions |
| `.foundation/data-model.md` | i18n keys, config schema | Translation key namespaces, `AppConfig` |
| `.foundation/framework-api-registry.md` | AngularJS `app-header` | Original component structure, i18n patterns |
| `.foundation/service-map.md` | Component topology | Component dependencies, bootstrap flow |

### Source Code (AngularJS Original)

| File | Purpose |
|---|---|
| `vault/input/src/frontend/src/app/components/header/header.component.js` | Original `app-header` implementation |
| `vault/input/src/frontend/src/app/services/i18n.service.js` | Client-side i18n logic (reference only) |
| `vault/input/src/frontend/src/assets/i18n/es-ES.json` | Spanish translation keys (source for Babel) |
| `vault/input/src/frontend/src/assets/i18n/en-EN.json` | English translation keys (source for Babel) |

### External Documentation

- [Babel i18n Documentation](https://babel.pocoo.org/en/latest/)
- [Jinja2 Templates](https://jinja.palletsprojects.com/)
- [FastAPI Response Cookies](https://fastapi.tiangolo.com/advanced/response-cookies/)
- [HTTP Accept-Language Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)

---

## Definition of Ready Checklist

- [x] Intent is clear and concise
- [x] Scope (in/out) is explicit with sharp boundaries
- [x] Constraints from guardrails are applied (GR-004, GR-007, GR-008)
- [x] Functional behavior defined with 5 deterministic scenarios
- [x] Data model changes identified (Pydantic models, translation keys, cookie schema)
- [x] Service ownership assigned (`app` module)
- [x] Interfaces documented (new `/api/set-language` endpoint)
- [x] UI/Journey described with visual layout
- [x] Test expectations mapped (unit, integration, template rendering)
- [x] Observability plan defined (logging events)
- [x] Open questions resolved (no blockers)
- [x] References linked to foundation documents
- [x] **M3 Gate (API Contract Verification)**: PASS — new endpoint aligns with ADR-004
- [x] **M4 Gate (Route Inventory Verification)**: PASS — new route approved

**Status**: ✅ **READY** — Feature spec is complete and unblocked for planning/proposal phase.
