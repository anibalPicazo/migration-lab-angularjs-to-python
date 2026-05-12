## 1. Data Models and Configuration

- [x] 1.1 Create `src/models/language.py` with `SetLanguageRequest` and `LanguageContext` Pydantic models
- [x] 1.2 Add translation keys to AngularJS source files for reference (`page_title`, `language_selector_label`, `locale_es_ES`, `locale_en_EN`)

## 2. Base Template Infrastructure

- [x] 2.1 Create `src/templates/base.html` with basic HTML structure, header inclusion, and content block
- [x] 2.2 Create `src/templates/components/` directory
- [x] 2.3 Create `src/templates/components/header.html` with static placeholder content

## 3. Language Detection Service

- [x] 3.1 Create `src/services/language_service.py` with `LanguageService` class
- [x] 3.2 Implement `detect_language()` method with priority logic (cookie → query → header → default)
- [x] 3.3 Implement `parse_accept_language()` helper for Accept-Language header parsing
- [x] 3.4 Implement `map_locale_code()` helper to map language codes (en, en-US, etc.) to supported locales (en_EN, es_ES)

## 4. Language Switching Route

- [x] 4.1 Create `src/routes/language_routes.py` with FastAPI router
- [x] 4.2 Implement `POST /api/set-language` endpoint with `SetLanguageRequest` body validation
- [x] 4.3 Add cookie setting logic with proper attributes (HttpOnly, SameSite=Lax, Max-Age=604800)
- [x] 4.4 Add redirect logic using Referer header or fallback to "/"

## 5. Jinja2 and i18n Integration

- [x] 5.1 Update `src/main.py` to register `language_routes` router
- [x] 5.2 Add middleware to detect language and store in `request.state.locale`
- [x] 5.3 Configure Jinja2 globals for `current_locale`, `supported_locales`, `locale_labels`
- [x] 5.4 Create translation files structure: `src/locales/{es_ES,en_EN}/LC_MESSAGES/`
- [x] 5.5 Create `messages.po` files for both locales with header translation keys
- [x] 5.6 Compile PO files to MO files using pybabel (or document manual compilation step)

## 6. Dynamic Header Component

- [x] 6.1 Update `src/templates/components/header.html` with full implementation (title + language selector form)
- [x] 6.2 Add language selector dropdown with current locale selected
- [x] 6.3 Add form auto-submit JavaScript (`onchange="this.form.submit()"`)
- [x] 6.4 Add CSS styles for header layout (flexbox, title left, selector right, responsive)

## 7. Refactor Existing Page

- [x] 7.1 Update `src/templates/consulta_estados_cuentas.html` to extend `base.html` instead of standalone HTML
- [x] 7.2 Move page-specific content into `{% block content %}` section
- [x] 7.3 Verify existing page functionality still works with base template

## 8. Unit Tests

- [x] 8.1 Create `tests/models/test_language.py` with tests for `SetLanguageRequest` validation
- [x] 8.2 Create `tests/services/test_language_service.py` with 8 test cases for language detection logic
- [x] 8.3 Add tests for `parse_accept_language()` helper
- [x] 8.4 Add tests for `map_locale_code()` helper

## 9. Integration Tests

- [x] 9.1 Create `tests/routes/test_language_routes.py` with integration tests for `/api/set-language` endpoint
- [x] 9.2 Add test for successful language switch with cookie verification
- [x] 9.3 Add test for redirect to Referer URL
- [x] 9.4 Add test for invalid locale validation error
- [x] 9.5 Add test for cookie attributes (HttpOnly, SameSite, Max-Age)

## 10. Template Rendering Tests

- [x] 10.1 Create `tests/templates/test_header_rendering.py` for header template tests
- [x] 10.2 Add test for header title rendering in Spanish
- [x] 10.3 Add test for header title rendering in English
- [x] 10.4 Add test for language selector showing correct selected option
- [x] 10.5 Add test for base template including header component

## 11. End-to-End Verification

- [ ] 11.1 Run all tests and verify ≥80% coverage
- [ ] 11.2 Run `ruff check .` and fix any linting errors
- [ ] 11.3 Run `ruff format .` to ensure code formatting
- [ ] 11.4 Manual test: Start app, verify header displays on page load
- [ ] 11.5 Manual test: Switch language via dropdown, verify page reloads with new language
- [ ] 11.6 Manual test: Verify language preference persists after browser refresh
