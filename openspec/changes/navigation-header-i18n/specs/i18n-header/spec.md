## ADDED Requirements

### Requirement: Babel gettext integration for header text
The system SHALL use Babel/gettext for all user-facing header text with translation keys stored in PO files for each supported locale.

#### Scenario: Translation keys exist for both locales
- **WHEN** system initializes i18n for header
- **THEN** translation keys `page_title`, `language_selector_label`, `locale_es_ES`, `locale_en_EN` exist in both es_ES and en_EN PO files

#### Scenario: Header text renders from translations
- **WHEN** header template renders with locale es_ES
- **THEN** all text uses Babel gettext function and displays Spanish translations

#### Scenario: Missing translation shows key
- **WHEN** a translation key is not found in PO file
- **THEN** system displays the key itself as fallback without breaking page render

### Requirement: Jinja2 template receives locale context
The system SHALL pass current locale and locale labels to all Jinja2 templates via global context variables.

#### Scenario: Current locale is available in templates
- **WHEN** any Jinja2 template renders
- **THEN** template has access to `current_locale` variable containing detected locale (es_ES or en_EN)

#### Scenario: Locale labels for dropdown
- **WHEN** header template renders
- **THEN** template has access to `locale_labels` dict mapping locale codes to translated language names

#### Scenario: Supported locales list available
- **WHEN** header template renders language selector
- **THEN** template has access to `supported_locales` list from AppConfig

### Requirement: Translation keys follow namespace convention
The system SHALL organize translation keys using domain.specific_key format as defined in coding conventions.

#### Scenario: Header keys use correct namespace
- **WHEN** header translation keys are defined
- **THEN** keys follow pattern: `page_title`, `language_selector_label`, `locale_<code>` (flat structure for header domain)

#### Scenario: Translations are compiled to MO files
- **WHEN** PO files are updated with new translations
- **THEN** system compiles them to MO files for runtime use

### Requirement: Gettext function available in templates
The system SHALL configure Jinja2 environment to provide `_()` function for inline translations in templates.

#### Scenario: Inline translation in header
- **WHEN** header template uses `{{ _('page_title') }}`
- **THEN** Babel gettext resolves to translated value based on current locale

#### Scenario: Gettext function available in Python
- **WHEN** Python code needs to generate translated text (e.g., for API responses)
- **THEN** `_("key")` function is available and returns translated string
