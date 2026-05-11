## Why

The current account balance query flow exists only in the legacy AngularJS 1.x frontend as a client-side component (`consulta-estados-cuentas`). To achieve functional parity and complete the migration to server-side rendering with Python/FastAPI, this flow must be migrated to eliminate client-side JavaScript framework dependencies while maintaining all existing functionality including DNI validation, account selection, and batch status queries.

## What Changes

- Migrate `consulta-estados-cuentas` AngularJS component to Python FastAPI route + Jinja2 template
- Implement server-side DNI validation with Spanish format validation (8 digits + 1 letter)
- Create Python endpoint `/consulta-estados-cuentas` with GET (render form) and POST (process search/queries) methods
- Integrate with CuentasService backend calls via httpx client (or mock mode)
- Implement server-side form validation with error messages displayed in template
- Support internationalization (es-ES/en-EN) for all labels, placeholders, and validation messages
- Maintain identical UX: DNI search, account results table with checkboxes, bulk operations (consult all/selected)
- Preserve validation feedback indicators (✓/✗ icons for DNI validity)

## Capabilities

### New Capabilities

- `account-query-page`: Server-side rendering of account query interface with DNI search form, results table, and bulk operation buttons
- `dni-validation-backend`: Server-side validation of Spanish DNI format (8 digits + letter with checksum calculation)
- `account-status-query`: Backend integration to fetch account status via httpx from Spring Boot middleware (with demo mode fallback)

### Modified Capabilities

<!-- No existing capabilities being modified - this is a new feature in the Python stack -->

## Impact

**Affected code:**
- New FastAPI route module: `src/routes/consulta_estados_cuentas.py`
- New Jinja2 template: `src/templates/consulta_estados_cuentas.html`
- New Pydantic models: `src/models/consulta.py` (DNI validation, account data structures)
- Updates to `src/services/cuentas_service.py` for account queries
- New i18n keys in `src/locales/es_ES/LC_MESSAGES/messages.po` and `en_EN/LC_MESSAGES/messages.po`

**APIs:**
- Consumes existing Spring Boot endpoints: `/api/cuentas/buscar-por-dni`, `/api/cuentas/consultar-estados` (or mocks)

**Dependencies:**
- No new external dependencies required (uses existing httpx, Jinja2, Babel stack)

**Testing:**
- New pytest test suite for DNI validation logic
- New integration tests using respx for httpx mocking
- E2E test coverage for full page flow (search → select → query)
