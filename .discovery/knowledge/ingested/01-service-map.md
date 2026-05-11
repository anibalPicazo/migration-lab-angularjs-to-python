# Service Map — Mapa de Servicios

## Overview
Aplicación frontend moderna (SPA / Single Page Application) construida en **Angular 20** con arquitectura basada en **standalone components**. La aplicación orquesta operaciones contra un Middleware backend.

## Servicios

### Frontend SPA (Primary Service)
**Ownership**: Frontend Team  
**Tech Stack**: Angular 20, TypeScript, Signals, Standalone Components  
**Runtime**: Browser / Node.js (SSR optional future)

#### Responsibilities:
- UI minimalista basada en CSS propio (sin frameworks de UI)
- Formularios interactivos para lanzar operaciones contra el Middleware
- Tablas para mostrar resultados, estado, y logs
- Localización (i18n) obligatoria: es-ES, en-EN
- Gestión de configuración runtime sin recompilación

#### Key Capabilities:
- **Forms**: Capturar parámetros de entrada del usuario
- **Queries**: Consultas dinámicas a través de HTTP
- **Results Display**: Tablas reactivas para mostrar respuestas
- **Status/Logs**: Visualización de estado de operaciones en progreso
- **Error Handling**: Manejo centralizado de errores HTTP y timeout

#### Interfaces (Cliente):
- HTTP REST hacia **Middleware** (configuración dinámica de `apiBaseUrl`)
- CORS habilitado (configurado en Middleware, no en Frontend)
- Configuration endpoint (assets/config.json)
- i18n files (assets/i18n/{es-ES,en-EN}.json)

### Middleware (External Service)
**Ownership**: Backend/Middleware Team  
**Tech Stack**: Technology-agnostic (defined externally)

#### Responsibilities:
- Orquestar operaciones de negocio
- Validar parámetros de entrada
- Llamadas a sistemas legacy/externos
- Garantizar CORS headers v esta aplicación

#### Interfaces (Servidor):
- REST API endpoints (especificación externa)
- Configuration/healthcheck endpoint (opcional)
- i18n compatible (puede devolver mensajes en múltiples idiomas)

---

## Data Flow

```
User Input (Form)
    ↓
Frontend Validation (Reactive Forms)
    ↓
HTTP Request → Middleware
    ↓
Middleware Processing
    ↓
HTTP Response ← Middleware
    ↓
Frontend: Parse, Display in Table/Results
    ↓
Store in Signals/State (sesión en memory)
```

## Deployment Model

- **Frontend**: Despliegue independiente (assets estáticos + SPA)
- **Middleware**: Despliegue independiente (backend service)
- **CORS**: Configurado en Middleware → permite origen Frontend
- **Config**: Frontend carga `config.json` sin recompilar

### Supported Environments
- Local/Dev (single server or separate)
- Staging (separate frontend + middleware)
- Production (separate frontend + middleware, CDN optional)

---

## Service Ownership & Boundaries

| Service | Owner | Scope | Borders |
|---------|-------|-------|---------|
| Frontend (SPA) | Frontend Team | UI, forms, i18n, state, client-side validation | HTTP → Middleware |
| Middleware | Backend Team | Routing, business logic, external calls, CORS | HTTP ← Frontend |

---

## References
- [02-tech-stack.md](02-tech-stack.md) — Stack técnico detallado
- [03-data-model.md](03-data-model.md) — Entidades y modelo de datos
- [04-patterns.md](04-patterns.md) — Arquitectura interna y patrones
- [05-guardrails.md](05-guardrails.md) — Restricciones y estándares de código
- [06-ui-design-system.md](06-ui-design-system.md) — Sistema de diseño UI
