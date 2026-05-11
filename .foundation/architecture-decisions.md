---
version: "1.0"
generated_at: "2026-05-08T13:17:00Z"
source: discovery-knowledge
---

# Architecture Decisions
Level: 2 (Domain)
Scope: Governance
Category: Architecture Decisions
Purpose: Five ADRs documenting key architectural decisions for the AngularJS-to-Python migration. Extracted from migration requirements and tech stack documents.

> ADR log — decisions, context, and consequences.
> Updated by `@discovery-knowledge` as new documentation is analyzed.

# Architecture Decisions

## ADR-001 — Migrate from AngularJS to Python FastAPI with Server-Side Rendering

**Date**: 2026-05-08

### Context

Legacy application is an AngularJS 1.x single-page application (SPA). SPA architecture introduces complexity in state management, client-side routing, and requires JavaScript expertise. The team needs a simpler, more maintainable solution that preserves functional parity while reducing frontend complexity.

### Decision

Migrate to Python 3.12 with FastAPI framework using server-side rendering (Jinja2 templates). FastAPI will act as a Backend-for-Frontend (BFF) layer, rendering HTML on the server and proxying API calls to the existing Spring Boot middleware.

**Key choices**:
- **Python 3.12** (latest stable Python version)
- **FastAPI** (modern, async-capable web framework)
- **Jinja2** (server-side HTML templating)
- **No client-side JavaScript framework** (eliminate SPA complexity)

### Consequences

**Positive**:
- Eliminates JavaScript build pipeline complexity (webpack, npm scripts, transpilation)
- Simplifies state management — no client-side state, all data flows from server
- Reduces frontend attack surface — no client-side JavaScript code to audit
- Python expertise is more broadly available in the team than JavaScript
- FastAPI provides automatic API documentation (OpenAPI/Swagger)
- Server-side rendering improves initial page load time and SEO (if applicable)

**Negative / Trade-offs**:
- Loses client-side interactivity benefits (smooth transitions, instant feedback)
- Every user action requires a server round-trip (no client-side optimistic updates)
- HTML over the wire increases bandwidth vs JSON APIs (though gzip mitigates this)
- Migration requires rewriting all AngularJS components in Jinja2 templates
- Team must learn FastAPI and Python web patterns

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Angular 20 (modern Angular)** | Still requires JavaScript expertise, complex build pipeline, and client-side state management. Does not reduce complexity. |
| **React / Vue.js** | Same issues as Angular 20 — client-side SPA complexity remains. |
| **Django** | More opinionated, heavier framework. FastAPI is lighter, more flexible for BFF pattern. |
| **Flask** | Older, less modern than FastAPI. FastAPI provides better async support and automatic validation via Pydantic. |

---

## ADR-002 — Use Synchronous httpx (Not Async)

**Date**: 2026-05-08

### Context

FastAPI supports both synchronous and asynchronous HTTP calls. The application needs to call a Spring Boot middleware for all business operations.

### Decision

Use **synchronous httpx** (`httpx.Client()`) for all HTTP calls to the middleware. FastAPI route functions will be synchronous (not `async def`).

**Rationale**:
- Application is I/O-bound on a single external dependency (middleware) — async gains are minimal
- Synchronous code is simpler to understand and debug
- No need for async/await complexity when there are no parallel I/O operations
- Easier to integrate with existing synchronous Python libraries if needed

### Consequences

**Positive**:
- Simpler code — no async/await keywords
- Easier for Python developers unfamiliar with asyncio
- No risk of "blocking the event loop" mistakes
- httpx sync API is straightforward and well-documented

**Negative / Trade-offs**:
- Cannot handle thousands of concurrent requests as efficiently as async (but this is not a requirement)
- If future requirements add multiple parallel I/O operations, refactoring to async may be needed
- FastAPI's async strengths are underutilized

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Async httpx (`httpx.AsyncClient()`)** | Adds complexity without clear benefit. Application has single external dependency; no parallel I/O. |
| **Requests library** | httpx is more modern, supports HTTP/2, and has better async support if needed in future. |

---

## ADR-003 — Support Demo Mode (Local Mocks) and Real Mode (Spring Boot Backend)

**Date**: 2026-05-08

### Context

Application depends on an external Spring Boot middleware for all business operations. Development and testing are blocked if middleware is unavailable. Demos and local development need to work without requiring a running backend.

### Decision

Application will support two runtime modes controlled by configuration:

1. **Demo mode**: Returns mock/fixture data from local Python files. No HTTP calls to middleware.
2. **Real mode**: Calls actual Spring Boot middleware endpoints via httpx.

Mode selection is controlled by `pydantic-settings` configuration (environment variable or `.env` file).

**Implementation**:
- Service layer uses dependency injection to swap between `RealBackendClient` and `MockBackendClient`
- Both clients implement the same interface (Python Protocol or ABC)
- Configuration determines which client is injected

### Consequences

**Positive**:
- Development can proceed without Spring Boot backend availability
- Demos and presentations can run standalone (no infrastructure dependencies)
- Integration tests can run against mocks (fast, deterministic)
- Local development setup is simpler (no Docker Compose or external services required)

**Negative / Trade-offs**:
- Mock data must be maintained alongside real backend contract changes
- Risk of mock drift — mock behavior diverges from real backend
- Additional code complexity (two client implementations)

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Real mode only** | Blocks development when backend is unavailable. Poor DX. |
| **Docker Compose with backend** | Requires Docker, increases local setup complexity, slows down development loop. |
| **Test doubles in tests only** | Doesn't solve demo/presentation use case where a running application is needed without backend. |

---

## ADR-004 — Backend-Managed Internationalization (i18n) via Babel/Gettext

**Date**: 2026-05-08

### Context

Application must support Spanish (es-ES) and English (en-EN). AngularJS original used client-side JSON files for translations. Server-side rendering requires a different i18n approach.

### Decision

Use **Babel** (Python i18n library) with **gettext** format for all user-facing strings. Translations are managed on the backend and rendered into HTML templates at request time based on user's language preference.

**Key choices**:
- Translation keys follow `domain.specific_key` format (e.g., `errors.invalid_input`, `titles.submit_query`)
- Language preference determined by:
  1. User session (if implemented)
  2. Query parameter (`?lang=en-EN`)
  3. `Accept-Language` HTTP header
  4. Default from configuration
- Translation files: `.po` (source) and `.mo` (compiled) in `app/locales/`

### Consequences

**Positive**:
- Single source of truth for translations (backend controls all text)
- No client-side JavaScript required for language switching
- Gettext is mature, well-supported, and has excellent tooling (poedit, weblate)
- Translation extraction can be automated (`pybabel extract`)

**Negative / Trade-offs**:
- Language switching requires page reload (no instant client-side switch)
- Translators must work with `.po` files (less friendly than JSON for non-technical users)
- Compiled `.mo` files must be regenerated on translation updates

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Client-side i18n (JSON files)** | Requires JavaScript, violates SSR-only architecture. |
| **Hardcoded translations in templates** | Not maintainable, breaks when adding new languages. |
| **Database-driven translations** | Overkill for 2 languages, adds complexity and database dependency. |

---

## ADR-005 — Dependency Management via uv (Not pip)

**Date**: 2026-05-08

### Context

Python projects traditionally use `pip` with `requirements.txt` or `setup.py`. Modern Python projects need reproducible builds, faster dependency resolution, and better lockfile support (similar to `npm` → `package-lock.json` or `poetry` → `poetry.lock`).

### Decision

Use **uv** (modern Python package installer and resolver) for all dependency management.

**Key choices**:
- Dependencies declared in `pyproject.toml` (PEP 621 standard)
- Locked versions in `uv.lock` (reproducible builds)
- Virtual environment created and managed by uv: `uv venv`, `uv sync`
- No direct `pip install` commands

**Commands**:
- `uv add <package>` — add new dependency
- `uv remove <package>` — remove dependency
- `uv sync` — install all dependencies from lockfile
- `uv run <command>` — run command in venv context

### Consequences

**Positive**:
- Reproducible builds — `uv.lock` pins exact versions (including transitive dependencies)
- Faster dependency resolution than pip (written in Rust, uses modern solver)
- Standardized `pyproject.toml` (PEP 621) — portable across tools
- Automatic virtual environment management
- Lockfile prevents "works on my machine" issues

**Negative / Trade-offs**:
- Team must learn new tool (uv vs pip)
- uv is relatively new — less mature than pip (though actively developed and stable)
- Some CI/CD pipelines may not have uv pre-installed (requires setup step)

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **pip + requirements.txt** | No lockfile support, slow resolver, no automatic version pinning. |
| **Poetry** | Heavier tool, slower than uv. uv is simpler and faster. |
| **Pipenv** | Slower, less actively maintained than uv. |
| **Conda** | Overkill for this project, introduces environment complexity. |

---

## 📎 Sources

- `.discovery/knowledge/ingested/00-migration-requirements.md` → ADR-001 (Python FastAPI target), ADR-002 (sync httpx), ADR-003 (demo/real modes), ADR-004 (Babel i18n), ADR-005 (uv dependency management)
- `.discovery/knowledge/ingested/01-service-map.md` → ADR-001 (BFF pattern context)
- `.discovery/knowledge/ingested/02-tech-stack.md` → ADR-001 (original Angular tech stack for comparison)
