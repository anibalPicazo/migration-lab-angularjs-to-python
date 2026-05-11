## ADDED Requirements

### Requirement: Service fetches accounts by DNI from backend

The system SHALL call Spring Boot middleware endpoint `/api/cuentas/buscar-por-dni` to fetch accounts associated with a given DNI.

#### Scenario: Successful account retrieval in real mode
- **WHEN** service is in "real" mode
- **WHEN** `buscar_por_dni("12345678Z")` is called
- **THEN** system SHALL make GET request to `{api_url}/api/cuentas/buscar-por-dni?dni=12345678Z`
- **THEN** system SHALL parse JSON response: `[{"id": "ACC001", "estado": null}, {"id": "ACC002", "estado": null}]`
- **THEN** system SHALL return list of Cuenta objects

#### Scenario: Successful account retrieval in demo mode
- **WHEN** service is in "demo" mode
- **WHEN** `buscar_por_dni("12345678Z")` is called
- **THEN** system SHALL NOT make network request
- **THEN** system SHALL return mock data from local fixture

#### Scenario: DNI not found returns empty list
- **WHEN** backend returns HTTP 404 or empty array
- **THEN** system SHALL return empty list `[]`
- **THEN** system SHALL NOT raise exception

### Requirement: Service queries account status for multiple accounts

The system SHALL call Spring Boot middleware endpoint `/api/cuentas/consultar-estados` to fetch status for one or more accounts.

#### Scenario: Query status for multiple accounts
- **WHEN** `consultar_estados(["ACC001", "ACC003", "ACC005"])` is called in real mode
- **THEN** system SHALL make POST request to `{api_url}/api/cuentas/consultar-estados`
- **THEN** request body SHALL be: `{"accountIds": ["ACC001", "ACC003", "ACC005"]}`
- **THEN** system SHALL parse response: `[{"id": "ACC001", "estado": "ACTIVO"}, {"id": "ACC003", "estado": "BLOQUEADO"}, {"id": "ACC005", "estado": "INACTIVO"}]`
- **THEN** system SHALL return list of EstadoCuenta objects

#### Scenario: Query status for single account
- **WHEN** `consultar_estados(["ACC001"])` is called
- **THEN** system SHALL make POST request with single account ID
- **THEN** backend returns status for that single account

#### Scenario: Demo mode returns mock status data
- **WHEN** service is in "demo" mode
- **WHEN** `consultar_estados(["ACC001"])` is called
- **THEN** system SHALL return mock status from local fixture
- **THEN** system SHALL NOT make network request

### Requirement: Service handles backend timeout gracefully

The system SHALL handle backend timeout scenarios without crashing.

#### Scenario: Backend takes too long to respond
- **WHEN** backend does not respond within configured timeout (e.g., 5 seconds)
- **THEN** httpx client SHALL raise timeout exception
- **THEN** service SHALL catch exception and raise `BackendTimeoutError`
- **THEN** route handler SHALL display user-friendly error message

### Requirement: Service handles backend HTTP errors gracefully

The system SHALL handle HTTP error responses (4xx, 5xx) from backend.

#### Scenario: Backend returns HTTP 500 internal error
- **WHEN** backend returns HTTP 500
- **THEN** service SHALL raise `BackendServerError`
- **THEN** route handler SHALL display error message "Error del servidor. Intente más tarde."

#### Scenario: Backend returns HTTP 503 service unavailable
- **WHEN** backend returns HTTP 503
- **THEN** service SHALL raise `BackendUnavailableError`
- **THEN** route handler SHALL display error message "Servicio no disponible temporalmente"

#### Scenario: Backend returns HTTP 400 bad request
- **WHEN** backend returns HTTP 400 (e.g., invalid account ID format)
- **THEN** service SHALL raise `BackendValidationError` with details
- **THEN** route handler SHALL display validation error to user

### Requirement: Service validates response data structure

The system SHALL validate backend JSON responses against expected Pydantic models.

#### Scenario: Valid response structure parsed correctly
- **WHEN** backend returns valid JSON matching Cuenta model schema
- **THEN** Pydantic SHALL parse into Cuenta objects successfully
- **THEN** service SHALL return typed objects

#### Scenario: Invalid response structure raises validation error
- **WHEN** backend returns JSON missing required fields (e.g., `{"id": "ACC001"}` without "estado")
- **THEN** Pydantic SHALL raise ValidationError
- **THEN** service SHALL catch and raise `BackendDataError`
- **THEN** system SHALL log error details for debugging

#### Scenario: Response is not JSON
- **WHEN** backend returns HTML error page or plain text
- **THEN** httpx SHALL fail to parse JSON
- **THEN** service SHALL raise `BackendDataError`

### Requirement: Service uses synchronous httpx client

The system SHALL use synchronous `httpx.Client()` for all HTTP calls (not async).

#### Scenario: All backend calls are synchronous
- **WHEN** any service method is called
- **THEN** method SHALL use `httpx.Client().get()` or `httpx.Client().post()`
- **THEN** method SHALL NOT use `httpx.AsyncClient()` or `await`

### Requirement: Service supports configurable timeout

The system SHALL allow configurable timeout for backend HTTP calls.

#### Scenario: Timeout loaded from configuration
- **WHEN** AppConfig specifies `backend_timeout_seconds: 10`
- **THEN** httpx client SHALL use 10-second timeout for all requests

#### Scenario: Default timeout used if not configured
- **WHEN** AppConfig does not specify timeout
- **THEN** httpx client SHALL use default 5-second timeout

### Requirement: Demo mode data fixtures are deterministic

The system SHALL return consistent mock data in demo mode for testing.

#### Scenario: Same DNI returns same mock accounts
- **WHEN** service is in demo mode
- **WHEN** `buscar_por_dni("12345678Z")` is called multiple times
- **THEN** system SHALL return identical list of accounts each time

#### Scenario: Mock data covers edge cases
- **WHEN** demo mode mock data is defined
- **THEN** fixtures SHALL include:
  - DNI with multiple accounts (3+)
  - DNI with single account
  - DNI with no accounts (empty list)
  - Accounts with various status values (ACTIVO, BLOQUEADO, INACTIVO, null)

### Requirement: Service logs backend interactions for debugging

The system SHALL log backend API calls and responses for troubleshooting.

#### Scenario: Successful API call logged
- **WHEN** backend call succeeds
- **THEN** system SHALL log: request URL, status code, response time
- **THEN** log level SHALL be INFO

#### Scenario: Failed API call logged with details
- **WHEN** backend call fails
- **THEN** system SHALL log: request URL, error type, error message
- **THEN** log level SHALL be ERROR
- **THEN** sensitive data (DNI, account details) SHALL be redacted from logs
