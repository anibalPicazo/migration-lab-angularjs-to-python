## Context

The AngularJS legacy application uses client-side i18n with JSON translation files loaded at runtime. The migration to Python FastAPI with server-side rendering (ADR-001) requires backend-managed i18n (ADR-004) using Babel/gettext. The AngularJS `app-header` component displayed application title and language selector with client-side language switching via Angular's i18n service.

**Current State**:
- Python application has no header component
- No base template structure for reusable components
- Babel/gettext dependencies already in project but not configured
- `AppConfig` already has `default_locale` and `supported_locales` (no config changes needed)
- Single page exists: consulta_estados_cuentas (standalone HTML, not extending base template)

**Constraints**:
- SSR-only architecture (ADR-001) — no client-side JavaScript frameworks
- Backend-managed i18n via Babel/gettext (ADR-004)
- Configuration must be runtime-loadable without recompilation (GR-007)
- All code must pass ruff linting and achieve ≥80% test coverage

## Goals / Non-Goals

**Goals:**
- Establish reusable base template pattern for future pages
- Implement server-side language detection with cookie persistence
- Migrate AngularJS header component behavior to Jinja2 templates
- Support instant language switching via page reload (SSR pattern)
- Maintain functional parity with AngularJS header (title + selector)

**Non-Goals:**
- Client-side instant language switching (violates SSR architecture)
- Multiple navigation items or menu structure (single page exists currently)
- User profile-based language preference (no authentication yet)
- Additional languages beyond es-ES and en-EN
- Footer component migration (separate future feature)

## Decisions

### D1: Base Template with Component Inclusion Pattern

**Decision**: Create `base.html` template that all pages extend, with `{% include 'components/header.html' %}` for header component.

**Rationale**:
- Establishes reusable pattern for future pages (footer, navigation menu when added)
- Jinja2 `{% extends %}` / `{% block %}` is standard templating approach
- Component inclusion allows header to be reused without duplication
- Aligns with coding conventions (templates/base.html, templates/components/)

**Alternatives Considered**:
- **Duplicate header in each page**: rejected (violates DRY, hard to maintain)
- **Jinja2 macros**: rejected (includes are simpler for component-level reuse)

### D2: Session Cookie for Language Persistence

**Decision**: Store language preference in HttpOnly session cookie named `lang` with 7-day expiry.

**Rationale**:
- Persists across page reloads and sessions (better UX than URL params)
- HttpOnly prevents JavaScript access (security best practice)
- 7-day expiry balances convenience with shared device concerns
- SameSite=Lax prevents CSRF while allowing navigation

**Alternatives Considered**:
- **URL path prefix** (`/es/consulta`): rejected (complicates routing, ADR-004 suggests cookie/query param)
- **LocalStorage**: rejected (requires client-side JS, violates SSR-only)
- **Permanent cookie**: rejected (privacy concern for shared devices)

### D3: Language Detection Service Layer

**Decision**: Create `language_service.py` with detection logic separate from route handler.

**Rationale**:
- Follows AP-001 (no business logic in routes)
- Enables unit testing without HTTP overhead
- Reusable across multiple routes if needed
- Priority order (cookie → query → header → default) encapsulated in single function

**Implementation**:
```python
class LanguageService:
    def detect_language(
        self,
        cookie: Optional[str],
        query_param: Optional[str],
        accept_language_header: Optional[str],
        config: AppConfig
    ) -> str:
        # Priority order implementation
        pass
```

**Alternatives Considered**:
- **Middleware**: rejected (overkill for single feature, harder to test)
- **Route decorator**: rejected (less flexible, mixes concerns)

### D4: Form-based Language Selector with Auto-submit

**Decision**: Use HTML `<form>` with `<select onchange="this.form.submit()">` for language switching.

**Rationale**:
- SSR-only architecture requires form submission for server round-trip
- Auto-submit provides instant feedback (no separate submit button needed)
- Minimal JavaScript (single line, not a framework) is acceptable
- Gracefully degrades if JavaScript disabled (user can manually submit)

**Alternatives Considered**:
- **Links** (`<a href="?lang=en_EN">`): rejected (POST is more appropriate for state change)
- **Pure JavaScript fetch**: rejected (violates SSR-only, adds complexity)

### D5: POST Endpoint with 302 Redirect Pattern

**Decision**: `POST /api/set-language` sets cookie and returns HTTP 302 redirect to Referer or "/".

**Rationale**:
- POST is semantic for state-changing operation
- 302 redirect triggers full page reload with new language
- Referer header preserves user's current page context
- Aligns with SSR pattern (no client-side state management)

**Alternatives Considered**:
- **GET endpoint**: rejected (GET should be idempotent, not state-changing)
- **JSON response**: rejected (requires client-side handling, violates SSR)

### D6: Jinja2 Global Context for Locale Variables

**Decision**: Configure FastAPI to inject `current_locale`, `supported_locales`, `locale_labels` as Jinja2 globals.

**Rationale**:
- All templates need locale context (not just header)
- Globals avoid passing same variables to every template render
- Centralizes locale detection logic (called once per request)

**Implementation** (in `main.py`):
```python
@app.middleware("http")
async def add_locale_context(request: Request, call_next):
    locale = language_service.detect_language(...)
    request.state.locale = locale
    return await call_next(request)

templates.env.globals["current_locale"] = lambda: request.state.locale
```

**Alternatives Considered**:
- **Manual passing to each render**: rejected (repetitive, error-prone)
- **Context processor pattern**: considered (Jinja2 globals are simpler for FastAPI)

## Risks / Trade-offs

### R1: Page reload on language switch
**Risk**: Users lose unsaved form state when switching language.  
**Mitigation**: For forms with substantial input (future), consider warning user before reload or implement draft save.

### R2: Cookie conflicts in shared environments
**Risk**: Shared device/browser users may see unexpected language.  
**Mitigation**: 7-day expiry balances convenience with privacy. Query param override (`?lang=`) allows temporary switches.

### R3: Accept-Language parsing complexity
**Risk**: Browsers send varied header formats; parsing may fail.  
**Mitigation**: Fallback to default locale if parsing fails. Log warning for debugging.

### R4: Translation key maintenance
**Risk**: Adding new pages requires updating PO files for both locales.  
**Mitigation**: Babel provides extraction tools (`pybabel extract`). Document translation workflow in coding conventions.

### R5: Base template becomes coupling point
**Risk**: Changes to base.html affect all pages.  
**Mitigation**: Use Jinja2 blocks strategically (title, content, scripts) to allow page-level overrides. Test base template changes thoroughly.

## Migration Plan

### Phase 1: Infrastructure (no user-visible changes)
1. Create `base.html` with header inclusion
2. Create `components/header.html` template (static content initially)
3. Refactor `consulta_estados_cuentas.html` to extend base
4. Verify existing page still renders correctly

### Phase 2: Backend i18n setup
1. Create `language_service.py` with detection logic
2. Create `language_routes.py` with `/api/set-language` endpoint
3. Configure Jinja2 globals for locale context
4. Add translation keys to PO files and compile to MO

### Phase 3: Dynamic header
1. Update header template with language selector form
2. Wire selector to `/api/set-language` endpoint
3. Test language switching flow end-to-end

### Rollback Strategy
- Phase 1/2 failures: Revert to original standalone template (no base extension)
- Phase 3 failures: Remove language selector from header (keep static title)
- All phases: No data migration or database changes (stateless architecture)

## Open Questions

### Q1: Should we support language switching via keyboard shortcuts?
**Status**: Deferred (out of scope for initial migration)  
**Decision**: No — requires client-side JavaScript listener; revisit if accessibility audit recommends it.

### Q2: Should we add visual indicator (flag icons) for languages?
**Status**: Deferred (out of scope)  
**Decision**: No — text-only dropdown is sufficient; icons add complexity and may not align with future design system.

### Q3: How to handle middleware API responses that include locale-specific strings?
**Status**: Out of scope  
**Decision**: Middleware returns locale-agnostic data (IDs, numbers). BFF layer translates for display. If middleware returns translated strings, BFF accepts but doesn't translate further.
