---
name: discovery-runtime-explore-flows
description: Explores interactive user flows in a running web application using Playwright MCP. Fills forms, clicks buttons, and records step-by-step flow sequences.
license: Apache-2.0
compatibility: Requires Playwright MCP server. Depends on discovery-runtime-observe-app (sitemap).
metadata:
  author: discovery-runtime
  version: "1.0"
---

# Runtime - Explore Flows

Explore **interactive user flows** in a running web application. Fills forms with test data, clicks buttons, and records the step-by-step sequence. Produces flow recordings in `.requirement/<slug>/flows/`.

## Prerequisites

- Application running and accessible
- **Playwright MCP** configured in VS Code with **video recording enabled** (see `discovery-runtime-observe-app/SKILL.md` → "Playwright MCP Setup" for full installation steps: `playwright`, `@playwright/mcp`, Playwright browsers, `ffmpeg`)
- Recommended: `.discovery/runtime/observations/sitemap.json` exists (run `observe` first)
- Video recording: Configured via `.playwright-mcp.json` → `saveVideo` (videos saved automatically to `outputDir`)

## Input

The user provides a starting point:
- A URL: `@discovery-runtime explore http://localhost:3000/login`
- A flow name: `@discovery-runtime explore login flow`
- Or just: `@discovery-runtime explore` (auto-discover flows from sitemap + knowledge sources)
- Or part of `full` mode: explore ALL discoverable flows automatically

## Execution Methods

There are **two ways** to execute flow exploration. Choose based on context:

### Method A — Playwright MCP (interactive, agent-driven)
The agent uses `browser_navigate`, `browser_click`, `browser_fill`, `browser_screenshot` MCP tools step-by-step. Best for adaptive exploration — the agent decides what to fill, what to click, and handles unexpected states.

### Method B — Programmatic script (batch, deterministic)
Run the generic tool directly:
```bash
node .github/tools/observation/explore-flows.js <baseUrl> [slug]
```
- `baseUrl`: e.g. `http://localhost:3004/tran-adequacyTRAN/`
- `slug`: obs-slug (auto-derived from URL path if omitted)

This script runs predefined flow interactions (search-filter, CRUD forms, navigation) and writes `flow-*.json` to `.requirement/<slug>/flows/`, screenshots to `.discovery/runtime/observations/<slug>/screenshots/`, and DOM snapshots to `.discovery/runtime/observations/<slug>/doms/`.

> **IMPORTANT**: Do NOT create ad-hoc scripts in the project root. Always use `.github/tools/observation/explore-flows.js`.

## Steps

### 0. Knowledge-driven flow discovery

Before exploring, **gather flow candidates from all available knowledge sources** to maximize coverage:

#### 0a. Flows from the sitemap

If `.discovery/runtime/observations/sitemap.json` exists, identify pages with interactive potential:
- Pages with forms (login, registration, search, CRUD)
- Pages with data tables (have filter/sort/pagination actions)
- Pages with action buttons (create, edit, delete)
- Pages with modals or dialogs

#### 0b. Flows from ingested documentation (opportunistic)

Check if `.discovery/runtime/ingested/` has files. **This is optional** — if ingest hasn't run yet (e.g., running in parallel), skip this step. Within the `full` flow of @discovery-runtime, ingest runs before explore, so these files SHOULD be available.

If files exist, **scan them for business flows and user stories**:
- Look for: "caso de uso", "flujo", "proceso", "workflow", "user story", "scenario"
- Look for: action verbs like "crear", "editar", "eliminar", "buscar", "filtrar", "exportar", "importar", "validar", "aprobar"
- Look for: screen/page references that describe what users DO on them
- Build a list of expected flows:
  ```json
  [
    {"name": "login", "source": "docs", "description": "User authentication"},
    {"name": "create-user", "source": "docs", "description": "Admin creates a new user"},
    {"name": "search-records", "source": "docs", "description": "Search and filter records table"}
  ]
  ```

#### 0c. Flows from source code (direct grep — no dependency on @codebase)

**Grep the source code directly** for flow hints. This does NOT require `@codebase` to have run — in fleet/parallel mode, `@codebase` runs simultaneously and its artifacts won't exist yet.

Search for:
- **Form handlers**: `ng-submit`, `@submit`, `(submit)`, `onSubmit`, `handleSubmit`
- **API endpoints**: `$http`, `fetch`, `axios`, `HttpClient` calls to identify data operations (CRUD)
- **State transitions**: `$state.go`, `router.navigate`, `$location.path` for navigation flows
- **Event handlers**: `ng-click`, `@click`, `(click)` on action buttons
- **Modal triggers**: `$uibModal.open`, `dialog.open`, `showModal`

Commands:
```bash
# Form handlers
grep -rn "ng-submit\|onSubmit\|handleSubmit" src/ app/ --include="*.html" --include="*.js" 2>/dev/null | head -50
# API calls
grep -rn "\$http\|\$resource\|\.get(\|\.post(\|\.put(\|\.delete(" src/ app/ --include="*.js" 2>/dev/null | head -50
# Modal triggers
grep -rn "\$uibModal\|\$modal\|\.open(" src/ app/ --include="*.js" 2>/dev/null | head -30
```

> **Why direct grep instead of .discovery/code/?** In fleet/parallel mode, `@codebase` runs simultaneously with `@discovery-runtime`. Direct grep is instant and has zero dependencies.

Optionally, if `.discovery/code/` artifacts DO exist (e.g., from a previous run), use them as an **additional** enrichment source.

#### 0d. Merge flow candidates

Combine all sources into a prioritized flow list:
1. **Doc-mentioned flows** first (represent actual business requirements)
2. **Codebase-discovered flows** (may reveal hidden or admin functionality)
3. **Sitemap-discovered flows** (what's visible through navigation)

Deduplicate by matching on routes and flow types.

#### 0e. Auto-explore mode (for `full` command)

In auto-explore mode, automatically explore ALL discovered flow candidates without asking the user. Process them in priority order, skip flows that fail (auth walls, missing data), and record results for each.

### 1. Identify starting page

Use the merged flow list from step 0.

If URL provided → navigate directly.
If flow name → find matching route in `sitemap.json` or in the knowledge-discovered routes.
If no input → present the merged flow list to the user, grouping by source (docs, codebase, sitemap).
If `full` mode → iterate through ALL flow candidates automatically.

### 2. Capture initial state

```
browser_navigate → <start_url>
browser_snapshot → capture DOM
browser_screenshot → save step screenshot
```

Record as Step 0 (initial state).

### 3. Identify interactive elements

From the DOM snapshot AND from knowledge sources, find:

| Element | Selector pattern | Action |
|---------|-----------------|--------|
| Text inputs | `input[type="text"], input[type="email"], input[type="search"]` | Fill with test data |
| Password inputs | `input[type="password"]` | Fill with test password |
| Dropdowns | `<select>` | Select first non-empty option |
| Checkboxes | `input[type="checkbox"]` | Toggle |
| Radio buttons | `input[type="radio"]` | Select first option |
| Submit buttons | `button[type="submit"], input[type="submit"]` | Click (triggers form) |
| Action buttons | `button:not([type="submit"])` | Click if labeled with action words |
| Links in context | `a` within the form or main content | Click for navigation flows |
| Tabs | `[role="tab"]`, `.tab`, `.nav-tab` | Click each tab to explore sub-views |
| Accordions | `.accordion`, `[role="button"]` near collapsible content | Expand to discover hidden elements |
| Pagination | `.pagination`, `[aria-label*="page"]` | Navigate pages in data tables |
| Sort headers | `th[sortable]`, `th` with click handlers | Click to trigger sort |
| Filter controls | `input[type="search"]`, `.filter` | Type to trigger filter |

**Knowledge-enhanced discovery**: If docs describe fields/actions not visible in the DOM (e.g., fields that appear after selecting a certain dropdown value, or buttons that appear after a condition), note them and try to trigger them.

### 4. Execute flow steps

For each interactive element, execute and record:

```
Step 1: browser_click → email input
        browser_type → "test@example.com"
        Record: {action: "fill", target: "email", value: "test@example.com"}

Step 2: browser_click → password input
        browser_type → "TestPassword123"
        Record: {action: "fill", target: "password", value: "***"}

Step 3: browser_click → "Sign In" button
        Record: {action: "click", target: "Sign In button"}
        browser_screenshot → capture result
        browser_snapshot → capture new DOM

Step 4: Observe result
        - URL changed? → record navigation
        - Error message appeared? → record error state
        - New page loaded? → record success state
```

### 5. Detect flow patterns

After executing, classify the flow:

| Pattern | Detection |
|---------|-----------|
| **Login** | Form with email/password → redirect to dashboard/home |
| **Registration** | Form with name/email/password/confirm → success message or redirect |
| **CRUD Create** | Form with multiple fields → redirect to list or detail page |
| **CRUD Edit** | Pre-filled form → submit → redirect back |
| **Search** | Input field → table/list updates without page navigation |
| **Filter** | Select/checkbox → table/list updates |
| **Delete** | Button with "delete"/"remove" → confirmation dialog → redirect to list |
| **Navigation** | Link click → new page without state change |

### 6. Record flow

## ⚠️ Artifact Structure Contract (MANDATORY)

All flow artifacts MUST follow this exact layout. **Do not rename or restructure.**

```
.requirement/<slug>/flows/
├── flow-<name>.json                   ← flow recording (camelCase name matching source code)
└── flows-index.json                   ← index of all flows

.discovery/runtime/observations/<slug>/
├── doms/                              ← ALL DOM snapshots go here (including flow step DOMs)
│   └── flow-<name>-step<N>-<desc>.json
├── screenshots/                       ← ALL screenshots go here (including flow steps)
│   └── flow-<name>-step<N>-<desc>.png
└── videos/
    └── flow-<name>.webm               ← video per flow
```

**Critical rules:**
- Flow names use **camelCase** matching the source code (e.g., `consultMarks`, `manageMarkCategories`), NOT kebab-case
- ALL screenshots (flow steps included) are saved in `observations/<slug>/screenshots/`, NOT in `flows/<slug>/screenshots/`
- Screenshot paths in flow JSONs MUST be **relative to the observations slug dir**: `screenshots/flow-consultMarks-filter-step0-consult-marks-loaded.png`
- DOM snapshots for flow steps go in `observations/<slug>/doms/`, NOT in `.requirement/<slug>/flows/doms/`
- Always generate a `flows-index.json` listing all recorded flows

Write `.requirement/<slug>/flows/flow-{name}.json`:

```json
{
  "name": "login",
  "start_url": "http://localhost:3000/login",
  "pattern": "authentication",
  "recorded_at": "<ISO timestamp>",
  "steps": [
    {
      "step": 0,
      "action": "navigate",
      "url": "/login",
      "screenshot": "screenshots/flow-login-step0.png",
      "page_title": "Sign In"
    },
    {
      "step": 1,
      "action": "fill",
      "target": "input[name='email']",
      "target_label": "Email",
      "value": "test@example.com"
    },
    {
      "step": 2,
      "action": "fill",
      "target": "input[name='password']",
      "target_label": "Password",
      "value": "***"
    },
    {
      "step": 3,
      "action": "click",
      "target": "button[type='submit']",
      "target_label": "Sign In",
      "screenshot": "screenshots/flow-login-step3.png"
    },
    {
      "step": 4,
      "action": "observe",
      "result": "redirect",
      "new_url": "/dashboard",
      "page_title": "Dashboard",
      "screenshot": "screenshots/flow-login-step4.png"
    }
  ],
  "outcome": "success",
  "video": "videos/flow-login.webm",
  "observations": [
    "Login form validates email format client-side",
    "Password field has min-length indicator",
    "Redirect to /dashboard on successful login",
    "Session cookie 'auth_token' set after login"
  ]
}
```

### 7. Report

```
🔄 Flow explored: login
├── Steps: 5
├── Pattern: authentication
├── Outcome: success (redirect to /dashboard)
├── Screenshots: 3 captured
├── Video: .discovery/runtime/observations/<obs-slug>/videos/flow-login.webm
├── Observations: 4 noted
└── Saved: .requirement/<slug>/flows/flow-login.json

Next steps:
• @discovery-runtime explore /register — explore another flow
• @discovery-runtime extract — synthesize functionality from all flows
```

## Guardrails

- **DO NOT click delete/remove buttons** without user confirmation — ask first
- **DO NOT enter real credentials** — use test data only (`test@example.com`, `TestPassword123`)
- **DO NOT submit payment forms** — stop and ask user
- **Max 30 steps per flow** — if the flow is longer, stop and ask user to continue
- **Sensitive data** — do not record actual user data visible on screen; describe its presence instead
- **Error recovery** — if an action breaks the flow (unexpected error), take screenshot, record the error, and move to the next flow
- **Rate limit** — wait 500ms between actions to let the app respond
- **Confirmation before destructive flows** — if the flow looks like it creates/modifies data, warn user first (skip this in `full` auto mode — just don't execute destructive actions)
- **Auth walls** — if a flow requires authentication and you can't get past it, record the auth wall and skip to next flow


## Multi-Module Convention

All per-module artifacts are namespaced under a **module slug** subdirectory. See `.github/MULTI-MODULE.md` for full layout.

**Path resolution**: When this skill references a path like `.discovery/code/scan-manifest.json` or `.requirement/<slug>/flows/`, the actual path is `.discovery/code/scans/<module-slug>/scan-manifest.json` or `.requirement/<module-slug>/flows/`.

**Registry**: Read `.discovery/code/registry.json` or `.discovery/runtime/registry.json` to discover available modules. Update the registry when producing new artifacts.

**Observation slug (`<obs-slug>`)**: The directory name under `observations/` is ALWAYS derived from the **app URL path** (e.g., `tran-adequacyTRAN` from `http://localhost:3000/tran-adequacyTRAN`). This is NOT the same as the module `slug` from `modules.json` (e.g., `adequacYTRANS`). **Never use the modules.json slug as the observation directory name.** The dashboard remaps obs-slug → module-slug automatically.

**Resolution rule**: Given `APP_URL=http://host/tran-adequacyTRAN/` → `obs-slug = tran-adequacyTRAN`. Use this for ALL paths under `.discovery/runtime/observations/<obs-slug>/` and `.requirement/<obs-slug>/`.
