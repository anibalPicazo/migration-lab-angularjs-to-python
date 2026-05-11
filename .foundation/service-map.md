---
version: "1.0"
slug: frontend
generated_at: 2026-05-11T00:00:00.000Z
source: discovery-code
---

# Service Map — frontend

Level: 3 (Application)  
Scope: Tactical  
Category: Technical Architecture  
Purpose: Service topology, dependency injection patterns, and component relationships extracted from the AngularJS 1.7.x frontend module for migration planning to Python/FastAPI server-side rendering.

> Overview of AngularJS services, components, dependency injection graph, and data flow patterns.
> Source: `.discovery/code/symbols/frontend/index.json` + `.discovery/code/graph/frontend/edges.json`

## Module Overview

**Framework**: AngularJS 1.7.x + UI-Router  
**Module Name**: `appModule`  
**Entry Points**: 
- `index.html` — Main HTML entry with ng-app="appModule"
- `src/app/app.module.js` — Module definition and bootstrap

## Components

| Component | Type | File | Dependencies |
|---|---|---|---|
| `appModule` | module | src/app/app.module.js | ui.router |
| `ConfigService` | service | src/app/services/config.service.js | $http |
| `i18nService` | service | src/app/services/i18n.service.js | $http |
| `ErrorService` | service | src/app/services/error.service.js | — |
| `ApiService` | service | src/app/services/api.service.js | $http |
| `CuentasService` | service | src/app/services/cuentas.service.js | ApiService, MockDataService |
| `MockDataService` | service | src/app/services/mock-data.service.js | — |
| `HttpErrorInterceptor` | service | src/app/config/http.interceptor.js | $q, ErrorService |
| `app-header` | component | src/app/components/header/header.component.js | — |
| `app-footer` | component | src/app/components/footer/footer.component.js | — |
| `app-error-banner` | component | src/app/components/error-banner/error-banner.component.js | ErrorService |
| `app-loading-spinner` | component | src/app/components/loading-spinner/loading-spinner.component.js | — |
| `consulta-estados-cuentas` | page component | src/app/pages/consulta-estados-cuentas/consulta-estados-cuentas.component.js | CuentasService, i18nService |

## Service Topology

```
appModule [ui.router]
  │
  ├─ Bootstrap (run block)
  │   └─ ConfigService.load() → i18nService.load()
  │
  ├─ Configuration
  │   ├─ app.config.js (UI-Router routes)
  │   └─ http.interceptor.js (HttpErrorInterceptor)
  │
  ├─ Core Services
  │   ├─ ConfigService ($http)
  │   ├─ i18nService ($http)
  │   ├─ ErrorService
  │   └─ ApiService ($http)
  │
  ├─ Business Services
  │   ├─ CuentasService
  │   │   ├─ injects: ApiService
  │   │   └─ injects: MockDataService
  │   └─ MockDataService
  │
  ├─ UI Components
  │   ├─ app-header
  │   ├─ app-footer
  │   ├─ app-error-banner (injects: ErrorService)
  │   └─ app-loading-spinner
  │
  └─ Page Components
      └─ consulta-estados-cuentas
          ├─ injects: CuentasService
          └─ injects: i18nService
```

## Service Responsibilities

| Service | Responsibilities | Key Methods | Called By |
|---|---|---|---|
| **ConfigService** | Load application configuration from JSON | `load()` → GET /src/assets/config.json | Bootstrap (run block) |
| **i18nService** | Internationalization, load translation files | `load(lang)` → GET /src/assets/i18n/{lang}.json, `translate(key)` | Bootstrap, consulta-estados-cuentas |
| **ErrorService** | Global error state management | `setError(msg)`, `clearError()`, `getError()` | HttpErrorInterceptor, app-error-banner |
| **ApiService** | HTTP client wrapper for API calls | `get(url)`, `post(url, data)` | CuentasService |
| **CuentasService** | Business logic for account statements | `consultarEstadosCuentas(dni)` → delegates to ApiService or MockDataService | consulta-estados-cuentas |
| **MockDataService** | Provide mock data for demo mode | `getEstadosCuentas()` → returns hardcoded mock | CuentasService |

## Dependency Injection Graph

```
ConfigService
  └─ injects: $http (AngularJS built-in)

i18nService
  └─ injects: $http (AngularJS built-in)

ErrorService
  └─ no dependencies

ApiService
  └─ injects: $http (AngularJS built-in)

CuentasService
  ├─ injects: ApiService (project-local, src/app/services/api.service.js)
  └─ injects: MockDataService (project-local, src/app/services/mock-data.service.js)

MockDataService
  └─ no dependencies

HttpErrorInterceptor
  ├─ injects: $q (AngularJS built-in)
  └─ injects: ErrorService (project-local, src/app/services/error.service.js)

app-error-banner (component)
  └─ injects: ErrorService (project-local, src/app/services/error.service.js)

consulta-estados-cuentas (page component)
  ├─ injects: CuentasService (project-local, src/app/services/cuentas.service.js)
  └─ injects: i18nService (project-local, src/app/services/i18n.service.js)
```

## HTTP API Calls (External Dependencies)

| Method | URL Template | Service | Operation | Mode |
|---|---|---|---|---|
| GET | `/src/assets/config.json` | ConfigService | Load config | Always |
| GET | `/src/assets/i18n/{lang}.json` | i18nService | Load translations | Always |
| GET/POST | *(configured in config.json)* | ApiService → CuentasService | Account queries | Real mode |
| — | *(mock data)* | MockDataService → CuentasService | Account queries | Demo mode |

**Note**: The actual API endpoints for CuentasService are configurable via `src/assets/config.json`. Static analysis detected the delegation pattern but not the runtime URL values.

## Data Flow Summary

### Bootstrap Flow
1. **index.html** loads, AngularJS bootstraps `appModule`
2. **run block** executes:
   - ConfigService.load() fetches `/src/assets/config.json`
   - i18nService.load(defaultLang) fetches `/src/assets/i18n/{lang}.json`
3. **UI-Router** activates default state (consulta-estados-cuentas)

### User Flow: Consulta Estados Cuentas
1. User navigates to consulta-estados-cuentas page
2. User enters DNI and submits form
3. **consulta-estados-cuentas component**:
   - Validates DNI (via dni-validator directive)
   - Calls CuentasService.consultarEstadosCuentas(dni)
4. **CuentasService** checks mode:
   - **Demo mode**: MockDataService.getEstadosCuentas()
   - **Real mode**: ApiService.get(apiUrl + '/cuentas/' + dni)
5. **ApiService** sends HTTP request via $http
6. **HttpErrorInterceptor** intercepts response:
   - **Success**: pass through
   - **Error**: ErrorService.setError(msg) → app-error-banner displays
7. Component renders results or error

## i18n and Filters

| Element | Type | Purpose | File |
|---|---|---|---|
| `translate` | filter | Translate i18n key to string | src/app/i18n/translate.filter.js |
| `dniValidator` | directive | Validate Spanish DNI/NIE format | src/app/i18n/dni-validator.directive.js |

**i18n Keys**: 240 translation keys detected across es-ES.json and en-EN.json

## Testing Structure

| Test File | Tests | Type |
|---|---|---|
| tests/services/config.service.spec.js | ConfigService | Unit |
| tests/services/i18n.service.spec.js | i18nService | Unit |
| tests/services/error.service.spec.js | ErrorService | Unit |
| tests/services/api.service.spec.js | ApiService | Unit |
| tests/services/cuentas.service.spec.js | CuentasService | Unit |
| tests/services/mock-data.service.spec.js | MockDataService | Unit |
| tests/components/header.component.spec.js | app-header | Unit |
| tests/components/footer.component.spec.js | app-footer | Unit |
| tests/pages/consulta-estados-cuentas.component.spec.js | consulta-estados-cuentas | Unit |
| tests/i18n/translate.filter.spec.js | translate filter | Unit |
| tests/i18n/dni-validator.directive.spec.js | dniValidator directive | Unit |
| tests/integration/consulta-estados-cuentas.e2e.spec.js | End-to-end flow | E2E |

**Test Coverage**: 4 test → source file relationships detected in graph

## 📎 Sources

- `.discovery/code/scans/frontend/scan-manifest.json` — Framework detection and file inventory
- `.discovery/code/symbols/frontend/index.json` — Symbol extraction (48 AngularJS registrations)
- `.discovery/code/graph/frontend/edges.json` — Dependency relationships (452 edges total, 19 REGISTERS, 2 CALLS_API)
- Confidence level: **high** (deterministic regex parsing + graph analysis)
