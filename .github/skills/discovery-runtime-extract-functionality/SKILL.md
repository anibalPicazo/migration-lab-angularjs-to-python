---
name: discovery-runtime-extract-functionality
description: Synthesizes observed application behavior into a structured functional map. Groups features by domain, lists capabilities, inputs, outputs, and business rules.
license: Apache-2.0
compatibility: Requires .discovery/runtime/observations/ and .requirement/<slug>/flows/ data from previous observation steps.
metadata:
  author: discovery-runtime
  version: "1.0"
---

# Runtime - Extract Functionality

Synthesize all observed app behavior into a **structured functional map**. Groups features by domain area, lists capabilities, inputs, outputs, and observed business rules.

## Prerequisites

- `.discovery/runtime/observations/sitemap.json` should exist (from `observe`)
- `.requirement/<slug>/flows/flow-*.json` should exist (from `explore`)
- At least one of the above is required

## Steps

### 1. Load observation data

Read all available observation artifacts:

```bash
cat .discovery/runtime/observations/sitemap.json 2>/dev/null
ls .requirement/<slug>/flows/flow-*.json 2>/dev/null
```

If no data exists:
```
⚠️ No observation data found. Run these first:
   • @discovery-runtime observe <url> — capture the app
   • @discovery-runtime explore <url> — explore interactive flows
```

### 2. Inventory all pages and flows

Build a complete inventory from sitemap + flows:

- Every route from `sitemap.json` → a **page**
- Every flow from `flow-*.json` → a **capability**
- Cross-reference: which pages have flows, which don't

### 3. Group by functional domain

Classify pages and flows into domains using heuristics:

| Domain | Route patterns | Keywords |
|--------|---------------|----------|
| **Authentication** | `/login`, `/register`, `/forgot-password`, `/auth/*` | sign in, log in, register, password |
| **User Management** | `/users`, `/profile`, `/account`, `/settings` | user, profile, account, settings |
| **Dashboard** | `/dashboard`, `/home`, `/overview` | dashboard, overview, summary |
| **Content / CRUD** | `/items`, `/products`, `/posts`, `/articles` | create, edit, delete, list |
| **Admin** | `/admin/*`, `/manage/*` | admin, manage, configuration |
| **Search** | `/search`, `/results` | search, filter, find |
| **API / Docs** | `/api/*`, `/docs`, `/swagger` | API, documentation, endpoint |

If a page/flow doesn't match any heuristic, classify as "Other" and note for manual review.

### 4. For each domain, extract details

For each functional domain, synthesize:

**Capabilities** — what can the user do:
- Derived from flow outcomes (login → "authenticate", form submit → "create entity")
- Derived from page elements (table with edit buttons → "list + edit entities")

**Inputs** — what data does the user provide:
- Form fields from sitemap + flow steps
- Include: field name, type, required status, validations observed

**Outputs** — what does the user see:
- Data tables → entity lists
- Detail pages → entity views
- Messages → success/error feedback
- Redirects → navigation outcomes

**Business rules observed** — what constraints exist:
- Client-side validations (required fields, format checks)
- Server-side errors (messages returned on invalid input)
- Permissions (routes requiring auth, role-based UI differences)
- Conditional flows (different outcomes based on input)

### 5. Generate functional map

Write `.requirement/<slug>/functional-map/functional-map.md`:

```markdown
---
generated_at: <ISO timestamp>
source: app observation
pages_observed: 8
flows_recorded: 5
---

# Functional Map

Generated from app observation of http://localhost:3000

## Summary

| Domain | Pages | Flows | Capabilities |
|--------|-------|-------|-------------|
| Authentication | 2 | 2 | Login, Register |
| User Management | 3 | 1 | View profile, Edit settings |
| Dashboard | 1 | 0 | View summary |
| Content (Orders) | 2 | 2 | List orders, Create order |

## Authentication

### Login (/login)
- **Capability**: User authentication
- **Inputs**:
  - email (type: email, required: yes, validation: email format)
  - password (type: password, required: yes, validation: min 8 chars)
- **Happy path**: Submit → redirect to /dashboard, session cookie set
- **Error states**:
  - Invalid credentials → "Invalid email or password" message
  - Empty fields → client-side "Required" indicators
- **Business rules**:
  - Email format validated client-side
  - Rate limiting observed (after 5 failed attempts)
- **Flow reference**: flow-login.json

### Registration (/register)
- **Capability**: New user creation
- **Inputs**:
  - name (type: text, required: yes)
  - email (type: email, required: yes, validation: email format + uniqueness)
  - password (type: password, required: yes, validation: min 8 chars)
  - confirmPassword (type: password, required: yes, validation: must match password)
- **Happy path**: Submit → redirect to /login with success message
- **Error states**:
  - Email already exists → "Email already registered"
  - Password mismatch → "Passwords don't match"
- **Flow reference**: flow-register.json

## User Management
...

## Content (Orders)
...
```

### 6. Also write JSON for structured consumption

Write `.requirement/<slug>/functional-map/functional-map.json`:

```json
{
  "generated_at": "<ISO timestamp>",
  "base_url": "http://localhost:3000",
  "domains": [
    {
      "name": "Authentication",
      "pages": ["/login", "/register"],
      "capabilities": [
        {
          "name": "Login",
          "route": "/login",
          "inputs": [...],
          "outputs": [...],
          "business_rules": [...],
          "flow_ref": "flow-login.json"
        }
      ]
    }
  ]
}
```

### 7. Report

```
📋 Functional map extracted
├── Domains: 4 (Authentication, User Management, Dashboard, Content)
├── Total capabilities: 8
├── Total inputs cataloged: 23 fields
├── Business rules observed: 12
├── Pages covered: 8/8 (100%)
├── Flows used: 5
├── Output MD: .requirement/<slug>/functional-map/functional-map.md
└── Output JSON: .requirement/<slug>/functional-map/functional-map.json

Next steps:
• @discovery-runtime testplan — generate test plan from functional map
• @discovery-runtime crossref — cross-reference functionality with code
```

## Guardrails

- **DO NOT invent functionality** — only report what was actually observed
- **Mark gaps explicitly** — if a page was observed but not explored (no flow), mark as "not explored"
- **Be specific about business rules** — only include rules actually observed (validation messages, error responses), not assumed rules
- **JSON + Markdown** — always produce both formats
- **Unknown domains** — if pages don't fit standard categories, create an "Other" domain and flag for review
- **Auth-gated features** — if features were behind authentication, note which ones were observed and which were not accessible


## Multi-Module Convention

All per-module artifacts are namespaced under a **module slug** subdirectory. See `.github/MULTI-MODULE.md` for full layout.

**Path resolution**: When this skill references a path like `.discovery/code/scan-manifest.json` or `.requirement/<slug>/flows/`, the actual path is `.discovery/code/scans/<module-slug>/scan-manifest.json` or `.requirement/<module-slug>/flows/`.

**Registry**: Read `.discovery/code/registry.json` or `.discovery/runtime/registry.json` to discover available modules. Update the registry when producing new artifacts.

**Module slug**: Derived from the app URL path (e.g., `tran-adequacyTRAN` from `http://localhost:3000/tran-adequacyTRAN`). If only one module exists, use it implicitly. If multiple exist, ask the user.
