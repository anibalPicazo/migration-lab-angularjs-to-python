## Why

The AngularJS application includes a persistent header component (`app-header`) with application title and language selector that needs to be migrated to Python FastAPI server-side rendering. Currently, the migrated Python application has no header, resulting in inconsistent UX and no way for users to change language. This blocks ADR-004 (backend-managed i18n) implementation and leaves users without language switching capability.

## What Changes

- Add reusable Jinja2 base template (`base.html`) with header component inclusion
- Create header component template (`components/header.html`) showing app title (left) and language selector (right)
- Implement FastAPI endpoint `POST /api/set-language` for language preference persistence
- Add language detection service with priority: cookie → query param → Accept-Language header → default
- Store language preference in HttpOnly session cookie (`lang`, 7-day expiry)
- Integrate Babel/gettext for header internationalization
- Refactor existing page template (`consulta_estados_cuentas.html`) to extend base template
- Add translation keys: `page_title`, `language_selector_label`, `locale_es_ES`, `locale_en_EN`
- Implement responsive CSS for header layout (mobile-friendly)

## Capabilities

### New Capabilities

- `navigation-header`: Persistent header bar across all pages with application title and language selector dropdown
- `language-switching`: Server-side language preference management with session cookie persistence and detection logic
- `i18n-header`: Backend internationalization for header text using Babel/gettext

### Modified Capabilities

<!-- No existing capabilities are being modified - this is net new functionality -->

## Impact

**Code**:
- New: `src/templates/base.html`, `src/templates/components/header.html`, `src/routes/language_routes.py`, `src/services/language_service.py`, `src/models/language.py`
- Modified: `src/templates/consulta_estados_cuentas.html` (refactor to extend base), `src/main.py` (register language routes, configure Jinja2 globals)
- Tests: 8 new test files (unit, integration, template rendering)

**APIs**:
- New endpoint: `POST /api/set-language` (public, no auth required)

**Dependencies**:
- No new dependencies (Babel and Pydantic already in project)

**Configuration**:
- Uses existing `AppConfig.default_locale` and `AppConfig.supported_locales` (no changes needed)

**User Experience**:
- All pages now include persistent header with language selector
- Users can switch between Spanish (es-ES) and English (en-EN) instantly
- Language preference persists across sessions (7-day cookie)
