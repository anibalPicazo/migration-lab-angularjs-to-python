## ADDED Requirements

### Requirement: Language preference persists via cookie
The system SHALL store the user's language preference in an HttpOnly session cookie named `lang` with 7-day expiry and SameSite=Lax attribute.

#### Scenario: Cookie is set on first visit
- **WHEN** user visits the application for the first time with no existing language preference
- **THEN** system sets `lang` cookie to default locale (es_ES) with 7-day expiry

#### Scenario: Cookie persists language selection
- **WHEN** user selects a new language
- **THEN** system updates `lang` cookie value to the selected locale

#### Scenario: Cookie attributes are secure
- **WHEN** language cookie is set
- **THEN** cookie has HttpOnly=true, SameSite=Lax, and Max-Age=604800 attributes

### Requirement: Language detection follows priority order
The system SHALL detect the user's language preference using the following priority: session cookie → query parameter → Accept-Language header → configuration default.

#### Scenario: Cookie takes precedence
- **WHEN** user has `lang` cookie set to en_EN and query parameter `?lang=es_ES`
- **THEN** system uses en_EN from cookie (ignoring query parameter)

#### Scenario: Query parameter overrides when no cookie
- **WHEN** user has no `lang` cookie and visits with `?lang=en_EN` query parameter
- **THEN** system uses en_EN from query parameter

#### Scenario: Accept-Language header fallback
- **WHEN** user has no cookie or query parameter and browser sends Accept-Language: en-US header
- **THEN** system maps to en_EN locale

#### Scenario: Default locale as last resort
- **WHEN** no cookie, query parameter, or Accept-Language header is present
- **THEN** system uses default locale from AppConfig (es_ES)

### Requirement: Language switching endpoint
The system SHALL provide a POST endpoint at `/api/set-language` that accepts a locale code and updates the user's language preference.

#### Scenario: Successful language switch
- **WHEN** user POSTs to `/api/set-language` with valid locale {"locale": "en_EN"}
- **THEN** system returns HTTP 302 redirect, sets `lang` cookie to en_EN, and redirects to Referer URL or "/"

#### Scenario: Invalid locale rejected
- **WHEN** user POSTs to `/api/set-language` with invalid locale {"locale": "fr_FR"}
- **THEN** system returns HTTP 422 with validation error details

#### Scenario: Redirect preserves context
- **WHEN** user POSTs to `/api/set-language` from page `/consulta-estados-cuentas`
- **THEN** system redirects back to `/consulta-estados-cuentas` after setting cookie

### Requirement: Accept-Language header parsing
The system SHALL parse Accept-Language headers to extract language codes and map them to supported locales (es_ES or en_EN).

#### Scenario: Parse complex Accept-Language
- **WHEN** browser sends "Accept-Language: en-US,en;q=0.9,es;q=0.8"
- **THEN** system extracts ["en-US", "en", "es"] and maps first supported code to locale

#### Scenario: Case-insensitive mapping
- **WHEN** browser sends language code "EN-us" or "en-US" or "EN-US"
- **THEN** system maps all variations to en_EN locale

#### Scenario: Unsupported language fallback
- **WHEN** browser sends Accept-Language with only unsupported codes (e.g., "fr-FR,de-DE")
- **THEN** system falls back to default locale (es_ES)
