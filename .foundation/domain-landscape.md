---
version: "1.0"
generated_at: "2026-05-08T13:17:00Z"
source: discovery-knowledge
---

# Domain Landscape
Level: 2 (Domain)
Scope: Strategic
Category: Domain Model
Purpose: Bounded contexts, domain glossary, and entity relationships for the query/operation management domain. Extracted from ingested data model and service map documents.

> Bounded contexts, domain glossary, and relationships for this project.
> Source: `.discovery/knowledge/`

## Functional Areas / Bounded Contexts

| Area | Responsibility | Key Entities | Owner |
|---|---|---|---|
| **Query Management** | Capture user input, submit operations to backend, track operation lifecycle | QueryRequest, QueryResponse, QueryLog | Frontend Team |
| **Configuration** | Runtime application configuration (API URLs, language, timeouts) | AppConfig | Frontend Team |
| **Internationalization** | Multi-language support for UI text | (i18n keys, translations) | Frontend Team |
| **Error Handling** | Centralized error capture, display, and reporting | ErrorDetail | Frontend Team |

## Domain Glossary

| Term | Definition | Context |
|---|---|---|
| **Query** | A user-initiated operation submitted to the middleware backend (e.g., check status, retrieve data, execute transaction) | Used throughout application lifecycle |
| **Operation Type** | Classification of query (e.g., "check_status", "retrieve_data") that determines which parameters are required | Query request |
| **Middleware** | External backend service (Spring Boot) that processes operations, calls legacy systems, and returns responses | API integration |
| **Demo Mode** | Application runtime mode using local mocks/fixtures instead of calling real middleware | Configuration |
| **Real Mode** | Application runtime mode calling actual Spring Boot middleware endpoints | Configuration |
| **Query Log** | Timeline entry tracking the status/progress of a submitted operation (submitted → processing → completed/failed) | Operation monitoring |
| **Error Detail** | Structured error information with code, message, affected field, and context | Error reporting |
| **BFF (Backend-for-Frontend)** | Architectural pattern where FastAPI acts as an intermediary between browser and Spring Boot, handling CORS and data transformation | Architecture |

## Entity Relationships (conceptual)

```
User
  ↓ submits
QueryRequest (id, operationType, parameters, timestamp)
  ↓ produces
QueryResponse (id, status, data?, errors?, metadata)
  ↓ generates
QueryLog (id, queryId, status, phase, message, timestamp)

AppConfig (loaded at startup)
  → defines apiBaseUrl
  → defines defaultLang, supportedLangs
  → defines requestTimeoutMs

ErrorDetail (within QueryResponse.errors[])
  → code (e.g., "VAL_001")
  → message (human-readable)
  → field? (optional)
  → details? (optional context)
```

## Domain Interactions

| From | To | Interaction | Notes |
|---|---|---|---|
| **Frontend (FastAPI)** | **Middleware (Spring Boot)** | HTTP POST `/api/query` with QueryRequest body | FastAPI sends user input; middleware processes and returns QueryResponse |
| **Frontend** | **User Browser** | Renders HTML via Jinja2 templates | Server-side rendering; no client-side JavaScript framework |
| **Frontend** | **Local Fixtures (demo mode)** | Returns mock QueryResponse data | No HTTP call to middleware; data served from local JSON/Python fixtures |

## 📎 Sources

- `.discovery/knowledge/ingested/03-data-model.md` → QueryRequest, QueryResponse, QueryLog, AppConfig, ErrorDetail entity definitions
- `.discovery/knowledge/ingested/01-service-map.md` → Bounded contexts (Frontend SPA vs Middleware), responsibilities, data flow diagram
