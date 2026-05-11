## 1. Project Structure and Dependencies

- [ ] 1.1 Create route module `src/routes/consulta_estados_cuentas.py`
- [ ] 1.2 Create Pydantic models module `src/models/consulta.py`
- [ ] 1.3 Create validators utility module `src/utils/validators.py`
- [ ] 1.4 Create Jinja2 template `src/templates/consulta_estados_cuentas.html`
- [ ] 1.5 Verify all dependencies are in pyproject.toml (httpx, Jinja2, Pydantic, Babel)

## 2. DNI Validation Backend (dni-validation-backend capability)

- [ ] 2.1 Implement `validate_dni()` function in `src/utils/validators.py` with Spanish checksum algorithm
- [ ] 2.2 Implement format validation (8 digits + 1 letter regex)
- [ ] 2.3 Implement checksum validation using modulo 23 algorithm with letter table
- [ ] 2.4 Add case normalization (lowercase to uppercase)
- [ ] 2.5 Add whitespace trimming
- [ ] 2.6 Return structured validation result `{"valid": bool, "error": str | None}`
- [ ] 2.7 Write unit tests for valid DNI cases (12345678Z, 00000001R)
- [ ] 2.8 Write unit tests for invalid format cases (too short, too long, special chars)
- [ ] 2.9 Write unit tests for invalid checksum cases (wrong letter)
- [ ] 2.10 Write unit tests for empty/whitespace input
- [ ] 2.11 Write unit tests for case insensitivity
- [ ] 2.12 Add performance test (validation under 10ms)

## 3. Pydantic Models

- [ ] 3.1 Define `Cuenta` model (id: str, estado: str | None)
- [ ] 3.2 Define `DniBuscarForm` model (dni: str with validator)
- [ ] 3.3 Define `EstadoCuenta` model (id: str, estado: str)
- [ ] 3.4 Define `CuentasResponse` model (list of Cuenta)
- [ ] 3.5 Define `ConsultarEstadosRequest` model (accountIds: List[str])
- [ ] 3.6 Add validators for empty strings and required fields

## 4. Backend Service Integration (account-status-query capability)

- [ ] 4.1 Update `src/services/cuentas_service.py` with `buscar_por_dni(dni: str)` method
- [ ] 4.2 Implement synchronous httpx client call to `/api/cuentas/buscar-por-dni?dni={dni}`
- [ ] 4.3 Add Pydantic response validation for `buscar_por_dni` endpoint
- [ ] 4.4 Implement `consultar_estados(account_ids: List[str])` method
- [ ] 4.5 Implement synchronous httpx POST call to `/api/cuentas/consultar-estados`
- [ ] 4.6 Add Pydantic response validation for `consultar_estados` endpoint
- [ ] 4.7 Implement demo mode branch (return mock data instead of HTTP call)
- [ ] 4.8 Add timeout configuration (load from AppConfig, default 5 seconds)
- [ ] 4.9 Add custom exception classes (BackendTimeoutError, BackendServerError, BackendUnavailableError, BackendDataError, BackendValidationError)
- [ ] 4.10 Implement error handling for HTTP 4xx/5xx responses
- [ ] 4.11 Implement error handling for timeout scenarios
- [ ] 4.12 Implement error handling for malformed JSON responses
- [ ] 4.13 Add logging for successful API calls (INFO level)
- [ ] 4.14 Add logging for failed API calls (ERROR level with redacted sensitive data)
- [ ] 4.15 Create mock data fixtures in `tests/fixtures/cuentas_fixtures.py`
- [ ] 4.16 Write integration tests with respx for `buscar_por_dni` (success, 404, timeout)
- [ ] 4.17 Write integration tests with respx for `consultar_estados` (success, 500, malformed JSON)
- [ ] 4.18 Write tests for demo mode data consistency

## 5. FastAPI Routes (account-query-page capability)

- [ ] 5.1 Implement GET `/consulta-estados-cuentas` endpoint (render initial form)
- [ ] 5.2 Implement POST `/consulta-estados-cuentas/buscar-dni` endpoint (DNI search)
- [ ] 5.3 Add DNI validation in POST handler using validators module
- [ ] 5.4 Add redirect with flash message on validation error
- [ ] 5.5 Add redirect with results on successful search
- [ ] 5.6 Implement POST `/consulta-estados-cuentas/consultar-todos` endpoint (query all accounts)
- [ ] 5.7 Implement POST `/consulta-estados-cuentas/consultar-seleccionados` endpoint (query selected accounts)
- [ ] 5.8 Parse checkbox form data for selected account IDs
- [ ] 5.9 Add error handling for backend service exceptions
- [ ] 5.10 Return user-friendly error messages via flash session
- [ ] 5.11 Wire route module into FastAPI app initialization

## 6. Jinja2 Template Implementation

- [ ] 6.1 Create base HTML structure with form for DNI input
- [ ] 6.2 Add DNI input field with placeholder "Ej. 12345678A"
- [ ] 6.3 Add search button with loading spinner state
- [ ] 6.4 Add help text explaining DNI format
- [ ] 6.5 Add conditional results table section (shown only after search)
- [ ] 6.6 Implement table with columns: Checkbox, Cuenta ID, Estado
- [ ] 6.7 Add "Select All" checkbox in table header
- [ ] 6.8 Add row checkboxes for each account with `name="account_id" value="{{ cuenta.id }}"`
- [ ] 6.9 Add "Consultar Todos" button (disabled when no accounts)
- [ ] 6.10 Add "Consultar Seleccionados" button (disabled when no selection)
- [ ] 6.11 Add empty results message ("No se encontraron cuentas") when list is empty
- [ ] 6.12 Add error banner for validation errors (flash messages)
- [ ] 6.13 Add loading states (disable form controls during submission)
- [ ] 6.14 Preserve DNI input value on validation error
- [ ] 6.15 Add date display footer between table and bottom
- [ ] 6.16 Add CSS classes matching design system (use existing main.css variables)

## 7. Internationalization (i18n)

- [ ] 7.1 Add translation key `label_dni` to `messages.po` files (es: "DNI", en: "DNI")
- [ ] 7.2 Add translation key `btn_search` (es: "Buscar", en: "Search")
- [ ] 7.3 Add translation key `btn_consult_all` (es: "Consultar Todos", en: "Query All")
- [ ] 7.4 Add translation key `btn_consult_selected` (es: "Consultar Seleccionados", en: "Query Selected")
- [ ] 7.5 Add translation key `help_dni` (es: "Formato: 8 dígitos + 1 letra (Ej. 12345678Z)", en: "Format: 8 digits + 1 letter (e.g. 12345678Z)")
- [ ] 7.6 Add translation key `no_results` (es: "No se encontraron cuentas para este DNI", en: "No accounts found for this DNI")
- [ ] 7.7 Add translation key `label_cuenta_id` (es: "Cuenta ID", en: "Account ID")
- [ ] 7.8 Add translation key `label_estado` (es: "Estado", en: "Status")
- [ ] 7.9 Add translation key `errors.dni_required` (es: "El DNI es obligatorio", en: "DNI is required")
- [ ] 7.10 Add translation key `errors.dni_invalid_format` (es: "DNI inválido. Formato: 8 dígitos + 1 letra", en: "Invalid DNI. Format: 8 digits + 1 letter")
- [ ] 7.11 Add translation key `errors.dni_invalid_checksum` (es: "La letra del DNI no es correcta", en: "DNI letter is incorrect")
- [ ] 7.12 Add translation key `errors.backend_unavailable` (es: "Servicio no disponible temporalmente", en: "Service temporarily unavailable")
- [ ] 7.13 Add translation key `errors.backend_timeout` (es: "Error al conectar con el servicio. Intente nuevamente.", en: "Error connecting to service. Please retry.")
- [ ] 7.14 Compile translations with `pybabel compile`

## 8. Testing

- [ ] 8.1 Write route test for GET `/consulta-estados-cuentas` (renders form)
- [ ] 8.2 Write route test for POST with valid DNI (redirects with results)
- [ ] 8.3 Write route test for POST with invalid DNI format (redirects with error)
- [ ] 8.4 Write route test for POST with invalid DNI checksum (redirects with error)
- [ ] 8.5 Write route test for POST with empty DNI (redirects with error)
- [ ] 8.6 Write route test for POST `consultar-todos` (queries all accounts)
- [ ] 8.7 Write route test for POST `consultar-seleccionados` (queries selected only)
- [ ] 8.8 Write route test for POST with no accounts found (displays empty message)
- [ ] 8.9 Write route test for backend timeout scenario
- [ ] 8.10 Write route test for backend 500 error scenario
- [ ] 8.11 Write E2E test for full flow: search → results table → select accounts → query selected → verify status updates
- [ ] 8.12 Write E2E test for internationalization (verify labels in es-ES and en-EN)
- [ ] 8.13 Verify test coverage ≥ 80% with pytest-cov

## 9. Code Quality and Validation

- [ ] 9.1 Run `ruff check .` and fix any linting errors
- [ ] 9.2 Run `ruff format .` to format code
- [ ] 9.3 Verify all Pydantic models validate correctly
- [ ] 9.4 Run full test suite with `pytest`
- [ ] 9.5 Verify no hardcoded API URLs (loaded from AppConfig)
- [ ] 9.6 Verify no console.log equivalent (`print()`) in production code
- [ ] 9.7 Verify all user-facing strings use Babel gettext (`_("key")`)
- [ ] 9.8 Review logging statements (INFO for success, ERROR for failures with redacted PII)

## 10. Documentation and Cleanup

- [ ] 10.1 Add docstrings to all public functions and classes
- [ ] 10.2 Update README with new route documentation
- [ ] 10.3 Document demo mode fixture data structure
- [ ] 10.4 Add inline comments for DNI validation algorithm
- [ ] 10.5 Remove any debug code or temporary print statements
