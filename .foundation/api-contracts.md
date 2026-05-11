---
version: "1.0"
slug: frontend
generated_at: 2026-05-11T00:00:00.000Z
source: discovery-code
---

# API Contracts — frontend

Level: 3 (Application)  
Scope: Tactical  
Category: API & Contracts  
Purpose: HTTP endpoints and contracts extracted from the AngularJS frontend module via static analysis. Documents internal asset endpoints and external API delegation patterns for Python/FastAPI migration planning.

> Endpoints and contracts extracted from source code via static analysis.
> Source: `.discovery/code/graph/frontend/edges.json` + `.discovery/code/symbols/frontend/index.json`

## Overview

**Total Endpoints Detected**: 2 internal asset endpoints + 1 configurable external API pattern

**Confidence Level**: High for internal endpoints (deterministic extraction), Medium for external API (pattern-based, not URL-resolved)

---

## Internal Asset Endpoints (Always Present)

These endpoints serve static assets from the frontend application and are called during bootstrap.

### 📄 `GET /src/assets/config.json`

| Property | Value |
|---|---|
| **Method** | GET |
| **URL** | `/src/assets/config.json` |
| **Path params** | None |
| **Query params** | None |
| **Headers** | None (standard HTTP GET) |
| **Called from** | `ConfigService.load()` (src/app/services/config.service.js:13) |
| **Operation** | Load application configuration at bootstrap |
| **Response handling** | Success: parse JSON and set config state; Error: bootstrap fails |
| **Confidence** | high (deterministic) |

**Response Schema**:
```json
{
  "mode": "demo | real",
  "apiUrl": "http://localhost:8080/api",
  "defaultLang": "es-ES | en-EN"
}
```

**Migration note**: In Python/FastAPI, this should be replaced with Pydantic Settings (environment variables) rather than a JSON file fetched at runtime.

---

### 📄 `GET /src/assets/i18n/{lang}.json`

| Property | Value |
|---|---|
| **Method** | GET |
| **URL** | `/src/assets/i18n/{lang}.json` |
| **Path params** | `lang` — Language code (e.g., "es-ES", "en-EN") |
| **Query params** | None |
| **Headers** | None (standard HTTP GET) |
| **Called from** | `i18nService.load(lang)` (src/app/services/i18n.service.js:34) |
| **Operation** | Load translation strings for specified language |
| **Response handling** | Success: parse JSON and set i18n dictionary; Error: fallback to default language or show error |
| **Confidence** | high (deterministic) |

**Response Schema**:
```json
{
  "common.loading": "Cargando...",
  "common.error": "Error",
  "consulta.title": "Consulta Estados de Cuentas",
  "consulta.dni.label": "DNI/NIE",
  "...": "... (240 total keys)"
}
```

**Migration note**: In Python/FastAPI, use Babel/gettext with `.po` files instead of JSON. The key structure should remain the same for template compatibility.

---

## External API Endpoints (Configurable)

These endpoints are delegated to an external backend API (e.g., Spring Boot). The actual URLs are configured via `config.json` at runtime.

### 🔗 `{HTTP_METHOD} {apiUrl}/cuentas/{dni}`

| Property | Value |
|---|---|
| **Method** | GET (inferred, not explicitly detected) |
| **URL** | `{apiUrl}/cuentas/{dni}` (constructed at runtime) |
| **Path params** | `dni` — Spanish DNI or NIE identifier |
| **Query params** | None detected (may exist in actual backend) |
| **Headers** | Content-Type: application/json (inferred from $http usage) |
| **Called from** | `CuentasService.consultarEstadosCuentas(dni)` → `ApiService.get(url)` |
| **Operation** | Retrieve account statements for given DNI |
| **Response handling** | Success: return data to component; Error: HttpErrorInterceptor → ErrorService.setError() |
| **Confidence** | medium (pattern detected, URL not resolved statically) |

**Request Example**:
```
GET {apiUrl}/cuentas/12345678Z
```

**Response Schema** (inferred from MockDataService):
```json
{
  "estadosCuentas": [
    {
      "id": "uuid-string",
      "numeroCuenta": "ES1234567890123456789012",
      "saldo": 1500.50,
      "moneda": "EUR",
      "fechaActualizacion": "2026-05-11T12:00:00Z"
    }
  ]
}
```

⚠️ **Static analysis limitation**: The exact endpoint structure, HTTP method, query parameters, and response schema cannot be determined from the frontend code alone. This information is controlled by:
1. Runtime configuration (`config.json` → `apiUrl`)
2. Backend API implementation (not analyzed here)
3. Mock data structure (may differ from actual API)

**Migration action required**: Validate this endpoint against the actual Spring Boot API specification or OpenAPI/Swagger documentation.

---

## Mock Data Pattern (Demo Mode)

When `config.mode === "demo"`, the application bypasses external API calls and uses local mock data.

### 📦 `MockDataService.getEstadosCuentas()`

| Property | Value |
|---|---|
| **Method** | N/A (in-memory function) |
| **URL** | N/A |
| **Called from** | `CuentasService.consultarEstadosCuentas(dni)` (when mode=demo) |
| **Operation** | Return hardcoded mock data |
| **Response** | Same schema as external API |
| **Confidence** | high (deterministic) |

**Migration note**: Python/FastAPI should implement similar demo mode logic using Pydantic Settings and fixture data.

---

## HTTP Interceptor Pattern

### Global Error Interception

**Source**: `src/app/config/http.interceptor.js`

**Pattern**: AngularJS `$httpProvider.interceptors` registered with `HttpErrorInterceptor`

**Behavior**:
- **Success responses**: Pass through unchanged
- **Error responses (4xx, 5xx)**: Intercept → extract error message → call `ErrorService.setError(msg)` → UI displays error banner

**Migration equivalent**: Python/FastAPI middleware or exception handlers
```python
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    # Log error, format response, trigger error state
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
```

---

## Endpoint Dependency Graph

```
Bootstrap
  └─ ConfigService.load()
      └─ GET /src/assets/config.json

Bootstrap (after config load)
  └─ i18nService.load(defaultLang)
      └─ GET /src/assets/i18n/{lang}.json

User Action (consulta-estados-cuentas page)
  └─ CuentasService.consultarEstadosCuentas(dni)
      ├─ if mode=demo: MockDataService.getEstadosCuentas()
      └─ if mode=real: ApiService.get({apiUrl}/cuentas/{dni})
          └─ HttpErrorInterceptor (on error)
              └─ ErrorService.setError(msg)
```

---

## Summary Table

| Method | URL | Service | Confidence | Type |
|---|---|---|---|---|
| GET | `/src/assets/config.json` | ConfigService | high | Internal asset |
| GET | `/src/assets/i18n/{lang}.json` | i18nService | high | Internal asset |
| GET* | `{apiUrl}/cuentas/{dni}` | CuentasService → ApiService | medium | External API (configurable) |
| — | In-memory mock | MockDataService | high | Local data (demo mode) |

*HTTP method inferred, not explicitly detected in code

---

## Notes

### Static Analysis Limitations

1. **Runtime configuration**: The `apiUrl` base path is loaded from `config.json` at runtime, so the complete URL cannot be resolved statically.

2. **HTTP method ambiguity**: The code uses `ApiService.get()` wrapper, which likely maps to HTTP GET, but this is inferred from naming convention, not explicit code.

3. **Response schema**: Inferred from mock data structure, which may differ from actual backend API responses.

4. **Query parameters**: Not detected. The actual backend API may support additional query params (e.g., `?dateFrom=`, `?limit=`) that are not visible in the frontend code.

5. **Authentication**: No authentication headers detected. If the backend requires auth (e.g., JWT, session cookies), this is handled outside the analyzed code scope.

### Recommended Validation Steps

Before Python/FastAPI migration:

1. ✅ Review Spring Boot API documentation or OpenAPI spec
2. ✅ Verify actual HTTP methods for `/cuentas/{dni}` endpoint
3. ✅ Confirm request/response schemas match backend implementation
4. ✅ Check for authentication requirements
5. ✅ Validate query parameters and headers
6. ✅ Test demo mode vs real mode behavior

---

## 📎 Sources

- `.discovery/code/symbols/frontend/index.json` — HTTP call symbols (2 detected: ConfigService, i18nService)
- `.discovery/code/graph/frontend/edges.json` — CALLS_API relationships (2 edges)
- `.discovery/code/scans/frontend/scan-manifest.json` — Framework and file structure
- Confidence level: **high** (internal), **medium** (external API pattern)

---

## Migration Implementation Notes

### Python/FastAPI Equivalents

**AngularJS Pattern** → **FastAPI Pattern**

1. **ConfigService.load() → Pydantic Settings**
   ```python
   from pydantic_settings import BaseSettings
   
   class Settings(BaseSettings):
       mode: str = "demo"  # or "real"
       api_url: str = "http://localhost:8080/api"
       default_lang: str = "es-ES"
       
       class Config:
           env_file = ".env"
   ```

2. **i18nService.load() → Babel/gettext**
   ```python
   from babel.support import Translations
   
   translations = Translations.load('locales', [lang])
   _ = translations.gettext
   ```

3. **ApiService → HTTPX Client**
   ```python
   import httpx
   
   async def get_cuentas(dni: str) -> dict:
       async with httpx.AsyncClient() as client:
           response = await client.get(f"{settings.api_url}/cuentas/{dni}")
           response.raise_for_status()
           return response.json()
   ```

4. **MockDataService → Fixture Loader**
   ```python
   import json
   from pathlib import Path
   
   def get_mock_cuentas() -> dict:
       return json.loads(Path("fixtures/cuentas.json").read_text())
   ```

5. **HttpErrorInterceptor → FastAPI Middleware**
   ```python
   from fastapi import Request
   from fastapi.responses import JSONResponse
   
   @app.middleware("http")
   async def error_handling_middleware(request: Request, call_next):
       try:
           return await call_next(request)
       except Exception as exc:
           # Log error, format response
           return JSONResponse(status_code=500, content={"error": str(exc)})
   ```
