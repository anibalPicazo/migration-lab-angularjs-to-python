---
version: "1.0"
generated_at: "2026-05-08T13:17:00Z"
source: discovery-knowledge
---

# Project Intent
Level: 2 (Domain)
Scope: Strategic
Category: Business Context
Purpose: Migration intent and success criteria for the AngularJS-to-Python web application project. Primary input for delivery agents scoping migration implementation tasks.

> Vision, objectives, scope, and business constraints for this migration project.
> Source: `.discovery/knowledge/`

## Vision

Migrate a legacy AngularJS 1.x single-page application (SPA) to a modern Python 3.12 web application using server-side rendering (SSR) with FastAPI and Jinja2. The new application will:

- Render HTML on the backend (no client-side JavaScript framework)
- Act as a Backend-for-Frontend (BFF) layer consuming REST endpoints from a Spring Boot middleware (or mocks in demo mode)
- Support internationalization (i18n) with es-ES and en-EN
- Maintain functional parity with the AngularJS source application

## Objectives

- **Functional parity**: Reproduce all existing features from the AngularJS application in the Python implementation
- **Server-side architecture**: Eliminate client-side SPA complexity — render HTML on the server using Jinja2 templates
- **BFF pattern**: FastAPI acts as an intermediary between browser and Spring Boot backend, avoiding CORS issues
- **Demo mode support**: Application can run with local mocks/fixtures without requiring the Spring Boot backend
- **Internationalization**: Multi-language support (Spanish and English) managed on the backend via Babel/gettext
- **Modern tooling**: Use contemporary Python tooling (uv for dependency management, pytest for testing, ruff for linting)

## Target Users

- **End users**: Web application users interacting with forms, viewing results in tables, and monitoring operation status/logs
- **Developers**: Team maintaining and extending the Python application after migration
- **Testers**: QA team validating functional parity between legacy AngularJS and new Python implementation

## Scope

### In scope

- Migration of all AngularJS components, services, and pages to Python FastAPI + Jinja2
- Server-side HTML rendering with Jinja2 templates
- HTTP client implementation using httpx (synchronous) to call Spring Boot endpoints
- Data modeling and validation using Pydantic
- Configuration management using pydantic-settings (runtime config for demo vs real mode, API URLs, language selection)
- Internationalization using Babel/gettext (backend-managed i18n)
- Testing infrastructure with pytest and respx (HTTP mocking)
- Code quality tooling: ruff for linting and formatting

### Out of scope

- Client-side JavaScript frameworks (React, Vue, Angular) — SSR HTML only
- Asynchronous HTTP calls — httpx will be used in synchronous mode
- Spring Boot backend modifications — backend is treated as external dependency
- Database persistence — application is stateless; all state comes from backend API responses
- User authentication/authorization — handled by Spring Boot backend

## Success Criteria

| Criterion | Measure |
|---|---|
| **Functional parity** | All AngularJS features reproduced in Python; side-by-side comparison passes |
| **Demo mode** | Application runs without Spring Boot backend using local fixtures |
| **Real mode** | Application successfully calls Spring Boot endpoints and renders responses |
| **Internationalization** | Spanish (es-ES) and English (en-EN) languages supported; translations rendered correctly |
| **Test coverage** | ≥ 80% test coverage with pytest |
| **Code quality** | All code passes ruff linting with zero errors |
| **Performance** | Page load time ≤ legacy AngularJS baseline |

## Business Constraints

- **No recompilation for config changes**: Application configuration (API base URL, language, timeout) must be loaded at runtime without rebuilding the application
- **Dependency management**: All dependencies managed via `pyproject.toml` (direct dependencies) and `uv.lock` (locked versions)
- **Python version**: Python 3.12 is mandatory — no fallback to older versions
- **Virtual environment**: All development and runtime must use a venv managed by uv
- **No external fonts/CDNs**: UI uses system fonts only; no external resources loaded from CDNs

## Migration Context

| Dimension | As-Is (legacy) | To-Be (target) |
|---|---|---|
| **Framework** | AngularJS 1.x | FastAPI (Python 3.12) |
| **Rendering** | Client-side SPA | Server-side (Jinja2) |
| **Language** | JavaScript | Python 3.12 |
| **Dependency management** | npm | uv (pyproject.toml + uv.lock) |
| **Testing** | Karma + Jasmine | pytest + respx |
| **Linting** | (none documented) | ruff |
| **HTTP client** | AngularJS $http | httpx (synchronous) |
| **Validation** | AngularJS reactive forms | Pydantic |
| **i18n** | Client-side JSON files | Backend Babel/gettext |
| **Backend** | Spring Boot (external) | Spring Boot (external, unchanged) |

⚠️ **Documentation inconsistency**: Ingested documents 01-06 describe Angular 20 (modern Angular) as the target, but document 00-migration-requirements.md (authoritative) specifies Python 3.12 + FastAPI as the correct target. This synthesis prioritizes document 00 as the source of truth for the migration target.

## 📎 Sources

- `.discovery/knowledge/ingested/00-migration-requirements.md` → Migration target, tech stack, architecture notes, dependencies, mode configuration
- `.discovery/knowledge/ingested/01-service-map.md` → Application overview, responsibilities (adapted to Python context)
- `.discovery/knowledge/ingested/03-data-model.md` → Entity definitions, API contracts (adapted to Pydantic models)
