## ADDED Requirements

### Requirement: Page renders form with DNI input field

The system SHALL render an HTML page at `/consulta-estados-cuentas` containing a form with a DNI input field, search button, and empty results section.

#### Scenario: Initial page load (no search performed)
- **WHEN** user navigates to `/consulta-estados-cuentas` via GET
- **THEN** system returns HTTP 200 with HTML page containing:
  - DNI input field (empty, with placeholder "Ej. 12345678A")
  - Search button (enabled)
  - Help text explaining DNI format
  - Empty results section (no table displayed)
  - Two bulk operation buttons (disabled)

### Requirement: Form accepts DNI input and validates on submission

The system SHALL validate DNI format (8 digits + 1 letter with valid checksum) when user submits search form.

#### Scenario: Valid DNI submitted
- **WHEN** user enters "12345678Z" and clicks search button
- **THEN** system validates DNI format and checksum
- **THEN** system calls backend `/api/cuentas/buscar-por-dni?dni=12345678Z`
- **THEN** system redirects to GET with search results displayed

#### Scenario: Invalid DNI format submitted
- **WHEN** user enters "1234" (incomplete) and clicks search button
- **THEN** system validates DNI format
- **THEN** system redirects to GET with error message "DNI inválido. Formato: 8 dígitos + 1 letra (Ej. 12345678Z)"
- **THEN** input field preserves entered value "1234"

#### Scenario: Invalid DNI checksum submitted
- **WHEN** user enters "12345678A" (wrong letter) and clicks search button
- **THEN** system validates DNI checksum
- **THEN** system redirects to GET with error message "DNI inválido. La letra no coincide con el número."
- **THEN** input field preserves entered value "12345678A"

### Requirement: Results table displays accounts with selection checkboxes

The system SHALL display search results in an HTML table with checkboxes for multi-selection.

#### Scenario: Accounts found for DNI
- **WHEN** backend returns list of 3 accounts for DNI "12345678Z"
- **THEN** system displays table with columns: [Checkbox, Cuenta ID, Estado]
- **THEN** each row contains: checkbox (unchecked), account ID, account status (empty initially)
- **THEN** table header has "Select All" checkbox (unchecked)
- **THEN** bulk operation buttons are enabled

#### Scenario: No accounts found for DNI
- **WHEN** backend returns empty list for DNI "99999999R"
- **THEN** system displays message "No se encontraron cuentas para este DNI"
- **THEN** bulk operation buttons remain disabled

### Requirement: Bulk operation - Query all accounts

The system SHALL allow querying status for all accounts in results table.

#### Scenario: User clicks "Consultar Todos" button
- **WHEN** user has searched and found 3 accounts
- **WHEN** user clicks "Consultar Todos" button
- **THEN** system calls backend `/api/cuentas/consultar-estados` with all 3 account IDs
- **THEN** system redirects to GET with updated results showing status column populated
- **THEN** results table displays: account IDs with their fetched statuses

### Requirement: Bulk operation - Query selected accounts only

The system SHALL allow querying status for only user-selected accounts.

#### Scenario: User selects 2 of 3 accounts and queries
- **WHEN** user has searched and found 3 accounts
- **WHEN** user checks checkboxes for accounts "ACC001" and "ACC003"
- **WHEN** user clicks "Consultar Seleccionados" button
- **THEN** system calls backend `/api/cuentas/consultar-estados` with only 2 selected account IDs
- **THEN** system redirects to GET with updated results
- **THEN** status column shows values only for selected accounts

#### Scenario: Button disabled when no selection
- **WHEN** user has searched and found accounts
- **WHEN** no checkboxes are selected
- **THEN** "Consultar Seleccionados" button SHALL be disabled

### Requirement: Multi-select UI interactions

The system SHALL support "Select All" checkbox to toggle all account selections.

#### Scenario: Select All checkbox toggles all rows
- **WHEN** user has 5 accounts in results table
- **WHEN** user clicks "Select All" checkbox in table header
- **THEN** all 5 row checkboxes become checked
- **THEN** "Consultar Seleccionados" button becomes enabled
- **WHEN** user clicks "Select All" again
- **THEN** all 5 row checkboxes become unchecked
- **THEN** "Consultar Seleccionados" button becomes disabled

### Requirement: Internationalization support

The system SHALL display all UI text in user's selected language (es-ES or en-EN).

#### Scenario: Page renders in Spanish
- **WHEN** user's language preference is "es-ES"
- **THEN** page displays labels in Spanish:
  - DNI field label: "DNI"
  - Search button: "🔍 Buscar"
  - "Consultar Todos" button: "Consultar Todos"
  - "Consultar Seleccionados" button: "Consultar Seleccionados"

#### Scenario: Page renders in English
- **WHEN** user's language preference is "en-EN"
- **THEN** page displays labels in English:
  - DNI field label: "DNI"
  - Search button: "🔍 Search"
  - "Consultar Todos" button: "Query All"
  - "Consultar Seleccionados" button: "Query Selected"

### Requirement: Loading states during backend calls

The system SHALL display loading indicators during asynchronous operations.

#### Scenario: Loading spinner during search
- **WHEN** user clicks search button
- **THEN** search button SHALL display loading spinner and text "Cargando..."
- **THEN** DNI input field SHALL be disabled
- **WHEN** backend responds
- **THEN** loading spinner disappears and button returns to normal state

#### Scenario: Loading spinner during bulk query
- **WHEN** user clicks "Consultar Todos" button
- **THEN** button SHALL display loading spinner
- **THEN** all form controls SHALL be disabled
- **WHEN** backend responds
- **THEN** loading spinner disappears

### Requirement: Error handling for backend failures

The system SHALL display user-friendly error messages when backend calls fail.

#### Scenario: Backend API unavailable during search
- **WHEN** user submits valid DNI
- **WHEN** backend API returns HTTP 500 or times out
- **THEN** system redirects to GET with error banner: "Error al conectar con el servicio. Intente nuevamente."
- **THEN** form remains usable for retry

#### Scenario: Backend returns invalid data format
- **WHEN** backend returns malformed JSON
- **THEN** system logs error and displays generic error message
- **THEN** system does NOT crash or expose stack traces
