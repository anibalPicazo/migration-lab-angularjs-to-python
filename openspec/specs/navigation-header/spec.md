## ADDED Requirements

### Requirement: Header displays on all pages
The system SHALL render a persistent navigation header at the top of all application pages containing the application title and language selector.

#### Scenario: Header renders on page load
- **WHEN** user visits any application page
- **THEN** header is displayed at the top with application title on the left and language selector on the right

#### Scenario: Header persists across navigation
- **WHEN** user navigates between different pages
- **THEN** header remains visible and maintains the same layout and language selection

### Requirement: Application title is internationalized
The system SHALL display the application title in the user's selected language using the `page_title` translation key.

#### Scenario: Title displays in Spanish
- **WHEN** user's language preference is set to es_ES
- **THEN** header displays "Consulta Estados Cuenta" as the title

#### Scenario: Title displays in English
- **WHEN** user's language preference is set to en_EN
- **THEN** header displays "Account Status Inquiry" as the title

### Requirement: Language selector displays current selection
The system SHALL show the currently active language in the dropdown selector with supported languages es-ES and en-EN as options.

#### Scenario: Spanish is selected by default
- **WHEN** user has no language preference set
- **THEN** language selector shows "es-ES" as selected

#### Scenario: English shows as selected after switch
- **WHEN** user has selected English language
- **THEN** language selector dropdown displays "en-EN" as the selected option

### Requirement: Header layout is responsive
The system SHALL render the header in a mobile-friendly layout that adapts to different viewport sizes.

#### Scenario: Desktop layout
- **WHEN** viewport width is ≥ 768px
- **THEN** header displays title and selector on a single line with flexbox layout

#### Scenario: Mobile layout
- **WHEN** viewport width is < 768px
- **THEN** header wraps title to second line if needed while keeping selector top-right
