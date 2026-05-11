## 1. Project Structure and Dependencies

- [x] 1.1 Create route module `src/routes/consulta_estados_cuentas.py`
- [x] 1.2 Create Pydantic models module `src/models/consulta.py`
- [x] 1.3 Create validators utility module `src/utils/validators.py`
- [x] 1.4 Create Jinja2 template `src/templates/consulta_estados_cuentas.html`
- [x] 1.5 Verify all dependencies are in pyproject.toml (httpx, Jinja2, Pydantic, Babel)

## 2. DNI Validation Backend (dni-validation-backend capability)

- [x] 2.1 Implement `validate_dni()` function in `src/utils/validators.py` with Spanish checksum algorithm
- [x] 2.2 Implement format validation (8 digits + 1 letter regex)
- [x] 2.3 Implement checksum validation using modulo 23 algorithm with letter table
- [x] 2.4 Add case normalization (lowercase to uppercase)
- [x] 2.5 Add whitespace trimming
- [x] 2.6 Return structured validation result `{"valid": bool, "error": str | None}`
- [x] 2.7 Write unit tests for valid DNI cases (12345678Z, 00000001R)
- [x] 2.8 Write unit tests for invalid format cases (too short, too long, special chars)
- [x] 2.9 Write unit tests for invalid checksum cases (wrong letter)
- [x] 2.10 Write unit tests for empty/whitespace input
- [x] 2.11 Write unit tests for case insensitivity
- [x] 2.12 Add performance test (validation under 10ms)

## 3. Pydantic Models

- [x] 3.1 Define `Cuenta` model (id: str, estado: str | None)
- [x] 3.2 Define `DniBuscarForm` model (dni: str with validator)
- [x] 3.3 Define `EstadoCuenta` model (id: str, estado: str)
- [x] 3.4 Define `CuentasResponse` model (list of Cuenta)
- [x] 3.5 Define `ConsultarEstadosRequest` model (accountIds: List[str])
- [x] 3.6 Add validators for empty strings and required fields

## 4. Backend Service Integration (account-status-query capability)

- [x] 4.1 Update `src/services/cuentas_service.py` with `buscar_por_dni(dni: str)` method
- [x] 4.2 Implement synchronous httpx client call to `/api/cuentas/buscar-por-dni?dni={dni}`
- [x] 4.3 Add Pydantic response validation for `buscar_por_dni` endpoint
- [x] 4.4 Implement `consultar_estados(account_ids: List[str])` method
- [x] 4.5 Implement synchronous httpx POST call to `/api/cuentas/consultar-estados`
- [x] 4.6 Add Pydantic response validation for `consultar_estados` endpoint
- [x] 4.7 Implement demo mode branch (return mock data instead of HTTP call)
- [x] 4.8 Add timeout configuration (load from AppConfig, default 5 seconds)
- [x] 4.9 Add custom exception classes (BackendTimeoutError, BackendServerError, BackendUnavailableError, BackendDataError, BackendValidationError)
- [x] 4.10 Implement error handling for HTTP 4xx/5xx responses
- [x] 4.11 Implement error handling for timeout scenarios
- [x] 4.12 Implement error handling for malformed JSON responses
- [x] 4.13 Add logging for successful API calls (INFO level)
- [x] 4.14 Add logging for failed API calls (ERROR level with redacted sensitive data)
- [x] 4.15 Create mock data fixtures in `tests/fixtures/cuentas_fixtures.py`
- [x] 4.16 Write integration tests with respx for `buscar_por_dni` (success, 404, timeout)
- [x] 4.17 Write integration tests with respx for `consultar_estados` (success, 500, malformed JSON)
- [x] 4.18 Write tests for demo mode data consistency

## 5. FastAPI Routes (account-query-page capability)

- [x] 5.1 Implement GET `/consulta-estados-cuentas` endpoint (render initial form)
- [x] 5.2 Implement POST `/consulta-estados-cuentas/buscar-dni` endpoint (DNI search)
- [x] 5.3 Add DNI validation in POST handler using validators module
- [x] 5.4 Add redirect with flash message on validation error
- [x] 5.5 Add redirect with results on successful search
- [x] 5.6 Implement POST `/consulta-estados-cuentas/consultar-todos` endpoint (query all accounts)
- [x] 5.7 Implement POST `/consulta-estados-cuentas/consultar-seleccionados` endpoint (query selected accounts)
- [x] 5.8 Parse checkbox form data for selected account IDs
- [x] 5.9 Add error handling for backend service exceptions
- [x] 5.10 Return user-friendly error messages via flash session
- [x] 5.11 Wire route module into FastAPI app initialization

## 6. Jinja2 Template Implementation

- [x] 6.1 Create base HTML structure with form for DNI input
- [x] 6.2 Add DNI input field with placeholder "Ej. 12345678A"
- [x] 6.3 Add search button with loading spinner state
- [x] 6.4 Add help text explaining DNI format
- [x] 6.5 Add conditional results table section (shown only after search)
- [x] 6.6 Implement table with columns: Checkbox, Cuenta ID, Estado
- [x] 6.7 Add "Select All" checkbox in table header
- [x] 6.8 Add row checkboxes for each account with `name="account_id" value="{{ cuenta.id }}"`
- [x] 6.9 Add "Consultar Todos" button (disabled when no accounts)
- [x] 6.10 Add "Consultar Seleccionados" button (disabled when no selection)
- [x] 6.11 Add empty results message ("No se encontraron cuentas") when list is empty
- [x] 6.12 Add error banner for validation errors (flash messages)
- [x] 6.13 Add loading states (disable form controls during submission)
- [x] 6.14 Preserve DNI input value on validation error
- [x] 6.15 Add date display footer between table and bottom
- [x] 6.16 Add CSS classes matching design system (use existing main.css variables)

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

- [x] 8.1 Write route test for GET `/consulta-estados-cuentas` (renders form)
- [x] 8.2 Write route test for POST with valid DNI (redirects with results)
- [x] 8.3 Write route test for POST with invalid DNI format (redirects with error)
- [x] 8.4 Write route test for POST with invalid DNI checksum (redirects with error)
- [x] 8.5 Write route test for POST with empty DNI (redirects with error)
- [x] 8.6 Write route test for POST `consultar-todos` (queries all accounts)
- [x] 8.7 Write route test for POST `consultar-seleccionados` (queries selected only)
- [x] 8.8 Write route test for POST with no accounts found (displays empty message)
- [x] 8.9 Write route test for backend timeout scenario
- [x] 8.10 Write route test for backend 500 error scenario
- [x] 8.11 Write E2E test for full flow: search → results table → select accounts → query selected → verify status updates
- [x] 8.12 Write E2E test for internationalization (verify labels in es-ES and en-EN)
- [x] 8.13 Verify test coverage ≥ 80% with pytest-cov

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

- [x] 10.1 Add docstrings to all public functions and classes
- [x] 10.2 Update README with new route documentation
- [x] 10.3 Document demo mode fixture data structure
- [x] 10.4 Add inline comments for DNI validation algorithm
- [x] 10.5 Remove any debug code or temporary print statements
