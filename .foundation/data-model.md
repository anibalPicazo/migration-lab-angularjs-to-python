---
version: "1.0"
slug: frontend
generated_at: 2026-05-11T00:00:00.000Z
source: discovery-code
---

# Data Model — frontend

Level: 3 (Application)  
Scope: Tactical  
Category: Technical Architecture  
Purpose: Data structures, i18n keys, configuration schemas, and style classes extracted from the AngularJS frontend module. Primary reference for Python/FastAPI migration, particularly for Jinja2 template data models and API response validation.

> Entities, configuration schemas, i18n translation keys, CSS classes, and validation patterns extracted from code.
> Source: `.discovery/code/symbols/frontend/index.json`

## Configuration Schema

### `src/assets/config.json`

Application configuration loaded at bootstrap.

| Key | Type | Purpose | Example Value |
|---|---|---|---|
| `mode` | string | Application mode | "demo" or "real" |
| `apiUrl` | string (endpoint_url) | Backend API base URL | "http://localhost:8080/api" |
| `defaultLang` | string | Default language | "es-ES" |

**Usage**: ConfigService.load() fetches this file at app startup.

## i18n Translation Keys

**Total Keys**: 240 keys across 2 languages (es-ES, en-EN)

### Language Files

| File | Language | Keys |
|---|---|---|
| `src/assets/i18n/es-ES.json` | Spanish (Spain) | 120 |
| `src/assets/i18n/en-EN.json` | English | 120 |

### Key Namespaces (inferred from structure)

| Namespace | Example Keys | Purpose |
|---|---|---|
| `common.*` | `common.loading`, `common.error`, `common.submit` | Common UI labels |
| `header.*` | `header.title`, `header.language` | Header component |
| `footer.*` | `footer.copyright`, `footer.version` | Footer component |
| `consulta.*` | `consulta.title`, `consulta.dni.label`, `consulta.dni.placeholder` | Account query page |
| `errors.*` | `errors.required`, `errors.invalid_dni`, `errors.api_error` | Error messages |
| `validation.*` | `validation.dni_invalid`, `validation.required_field` | Form validation |

**Usage**: 
- `{{ 'common.loading' | translate }}` in AngularJS templates
- `i18nService.translate('common.loading')` in JavaScript code

## Form Data Model

### Consulta Estados Cuentas Form

| Field | Type | Validation | Description |
|---|---|---|---|
| `dni` | string | required, pattern=DNI/NIE regex | Spanish DNI or NIE identifier |

**Validation Rules**:
- **DNI format**: 8 digits + 1 letter (e.g., "12345678Z")
- **NIE format**: X/Y/Z + 7 digits + 1 letter (e.g., "X1234567L")
- **Validation directive**: `dniValidator` (src/app/i18n/dni-validator.directive.js)

## API Response Schemas (Inferred from Service Layer)

### CuentasService.consultarEstadosCuentas(dni) Response

**Note**: Static analysis detected the service method but not the exact response schema. The actual schema depends on the backend API configuration.

**Mock data structure** (from MockDataService):

```json
{
  "estadosCuentas": [
    {
      "id": "string",
      "numeroCuenta": "string",
      "saldo": "number",
      "moneda": "string",
      "fechaActualizacion": "ISO date string"
    }
  ]
}
```

⚠️ **Migration note**: This schema is inferred from mock data. The Python/FastAPI migration must validate against the actual Spring Boot API response format.

## CSS Style Classes

**Total Classes**: 43 CSS selectors detected

### Layout Classes

| Class | File | Purpose |
|---|---|---|
| `.app-container` | src/styles/main.css | Main application container |
| `.app-main` | src/styles/main.css | Main content area |
| `.container` | src/styles/main.css | Generic container |
| `.stack` | src/styles/main.css | Vertical stack layout |
| `.row` | src/styles/main.css | Horizontal row layout |
| `.spacer` | src/styles/main.css | Spacing utility |

### Component Classes

| Class | File | Purpose |
|---|---|---|
| `.btn` | src/styles/main.css | Button base styles |
| `.btn-primary` | src/styles/main.css | Primary action button |
| `.btn-secondary` | src/styles/main.css | Secondary action button |
| `.form-group` | src/styles/main.css | Form field container |
| `.form-control` | src/styles/main.css | Form input styling |
| `.form-label` | src/styles/main.css | Form label styling |
| `.error-message` | src/styles/main.css | Error message display |
| `.loading-spinner` | src/styles/main.css | Loading spinner animation |

### State Classes

| Class | File | Purpose |
|---|---|---|
| `.error` | src/styles/main.css | Error state |
| `.success` | src/styles/main.css | Success state |
| `.disabled` | src/styles/main.css | Disabled state |
| `.hidden` | src/styles/main.css | Hidden element |
| `.visible` | src/styles/main.css | Visible element |

**Migration note**: These CSS classes must be preserved in the Python/FastAPI migration for visual consistency. Use the same class names in Jinja2 templates.

## NPM Dependencies (Data-relevant)

| Package | Version | Purpose |
|---|---|---|
| `angular` | 1.7.x | AngularJS framework |
| `@uirouter/angularjs` | 1.x | UI-Router for navigation |
| `angular-mocks` | ^1.8.3 | Testing mocks (devDependency) |
| `jasmine-core` | ^4.6.0 | Testing framework (devDependency) |
| `karma` | ^6.4.0 | Test runner (devDependency) |

## NPM Scripts

| Script | Command | Purpose |
|---|---|---|
| `start` | `http-server -p 8082 -c-1` | Start development server |
| `dev` | `http-server -p 8082 -c-1` | Start development server (alias) |
| `test` | `npx karma start karma.conf.js --single-run` | Run tests once |
| `test:watch` | `npx karma start karma.conf.js` | Run tests in watch mode |

## Validation Patterns

### DNI/NIE Validation

**Source**: `src/app/i18n/dni-validator.directive.js`

**Function**: `isValidDni(dni)` (line 9)

**Rules**:
1. Format: 8 digits + letter OR X/Y/Z + 7 digits + letter
2. Letter validation: calculated checksum letter must match
3. Invalid formats trigger `validation.dni_invalid` error message

**Usage in forms**:
```html
<input type="text" ng-model="dni" dni-validator />
```

**Migration note**: This validation logic must be replicated in Python (FastAPI) backend for server-side validation. Consider using Pydantic validators.

## Error Handling Data Model

### ErrorService State

| Property | Type | Description |
|---|---|---|
| `currentError` | string or null | Current error message |
| `hasError` | boolean | Whether an error is active |

### HTTP Error Interceptor

**Source**: `src/app/config/http.interceptor.js`

**Pattern**: Intercepts HTTP errors and delegates to ErrorService

**Error codes handled**: All HTTP 4xx and 5xx responses

**Migration note**: Python/FastAPI should implement similar error interception middleware with standardized error response format.

## Component Bindings (Data Flow)

### app-error-banner

**Bindings**: None (reads from ErrorService directly)

**Data**: `ErrorService.getError()` → displays error message

### consulta-estados-cuentas

**Inputs**: None (form-driven)

**Outputs**: None (displays results in template)

**Data flow**:
1. User input (`dni`) → form validation → CuentasService.consultarEstadosCuentas(dni)
2. Service response → component scope → template rendering

## Static Assets Inventory

| Asset Type | Count | Location |
|---|---|---|
| Translation files | 2 | src/assets/i18n/ |
| Configuration files | 1 | src/assets/config.json |
| CSS files | 1 | src/styles/main.css |
| HTML templates | 1 | index.html |
| JavaScript modules | 16 | src/app/ |
| Test files | 13 | tests/ |

## 📎 Sources

- `.discovery/code/symbols/frontend/index.json` — 336 symbols extracted (240 i18n keys, 43 CSS classes, 48 JS symbols)
- `.discovery/code/scans/frontend/scan-manifest.json` — File inventory and framework detection
- Confidence level: **high** (deterministic JSON parsing + regex extraction)

---

## Migration Checklist

For Python/FastAPI migration, preserve:

✅ **i18n keys**: Use Babel/gettext with same key structure  
✅ **CSS classes**: Copy all classes to new stylesheet  
✅ **Config structure**: Maintain `mode`, `apiUrl`, `defaultLang` in Pydantic settings  
✅ **DNI validation**: Implement in Pydantic validator + optional server-side check  
✅ **Error handling**: Implement FastAPI middleware for HTTP error interception  
✅ **Form fields**: Map `dni` field to Pydantic model with validation rules  

⚠️ **Verify manually**: API response schema from Spring Boot backend
