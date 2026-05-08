---
name: discovery-runtime-observe-app
description: Observes a running web application using Playwright MCP. Captures screenshots, DOM snapshots, and discovers navigation structure. Produces a sitemap.
license: Apache-2.0
compatibility: Requires Playwright MCP server configured in VS Code.
metadata:
  author: discovery-runtime
  version: "1.0"
---

# Runtime - Observe App

Observe a **running web application** using the Playwright MCP browser tools. Captures screenshots, DOM snapshots, and discovers the navigation structure. Produces a sitemap in `.discovery/runtime/observations/`.

## Prerequisites

- The application must be running and accessible (e.g., `http://localhost:3000`)
- **Playwright MCP** must be configured in VS Code (provides `browser_navigate`, `browser_screenshot`, `browser_snapshot`, `browser_click`)

### Playwright MCP Setup

**1. Install dependencies** (one-time):

```bash
# 1a. Install Playwright + MCP package
npm install --registry https://registry.npmjs.org/ --legacy-peer-deps playwright @playwright/mcp

# 1b. Install Playwright browsers (Chromium, Firefox, WebKit)
npx playwright install
# If npx fails with E401/ETIMEDOUT (private registry in .npmrc):
npx --registry https://registry.npmjs.org/ playwright install

# 1c. Install ffmpeg (required for video recording)
# macOS:
brew install ffmpeg
# Linux (Debian/Ubuntu):
# sudo apt-get install -y ffmpeg
# Linux (RHEL/Fedora):
# sudo dnf install ffmpeg

# 1d. Verify installations
node ./node_modules/@playwright/mcp/cli.js --help  # Should show CLI options
ffmpeg -version                                    # Should show ffmpeg version
```

> **Summary of what gets installed**:
> | Package | What it does | Install command |
> |---------|-------------|----------------|
> | `playwright` | Browser automation engine | `npm install playwright` |
> | `@playwright/mcp` | MCP server bridge for Playwright | `npm install @playwright/mcp` |
> | Playwright browsers | Chromium/Firefox/WebKit binaries | `npx playwright install` |
> | `ffmpeg` | Video encoding (required for `recordVideo`) | `brew install ffmpeg` |

**2. Add to VS Code MCP config** (`.vscode/mcp.json` or global settings):

**Option A — npx (default)**:
```json
{
  "servers": {
    "microsoft/playwright-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--config", ".playwright-mcp.json"
      ]
    }
  }
}
```

**Option B — node (local install, avoids registry lookups)**:

Use this when `npx` can't reach the public npm registry (corporate proxy, private `.npmrc` overriding the registry, expired auth tokens, etc.). Requires `@playwright/mcp` installed locally first:
```bash
npm install --registry https://registry.npmjs.org/ --legacy-peer-deps @playwright/mcp
```
Then configure:
```json
{
  "servers": {
    "microsoft/playwright-mcp": {
      "type": "stdio",
      "command": "node",
      "args": [
        "./node_modules/@playwright/mcp/cli.js",
        "--config", ".playwright-mcp.json"
      ]
    }
  }
}
```
> Option B is more reliable in restricted network environments since it runs the already-installed package directly — no npm registry call at startup.

**Playwright MCP config file** (`.playwright-mcp.json` in project root):

Create this file to enable **video recording** and configure browser options:
```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": {
      "headless": true
    },
    "contextOptions": {
      "bypassCSP": true,
      "recordVideo": {
        "dir": ".discovery/runtime/observations/_mcp-videos",
        "size": { "width": 1280, "height": 720 }
      }
    }
  }
}
```
> `recordVideo.dir` uses `_mcp-videos` (prefixed with `_`) so it is NOT mistaken for a module slug directory. Videos are saved here when the browser context closes. **Requires `ffmpeg` installed** (`brew install ffmpeg` on macOS). Note: `recordVideo` is a standard Playwright `BrowserContext` option — do NOT use the legacy `saveVideo` top-level key.

**3. Verify**: After adding the config, restart VS Code. The Playwright MCP tools (`browser_navigate`, `browser_screenshot`, `browser_snapshot`, `browser_click`, `browser_type`) should appear in the tool list.

If Playwright MCP is not available after setup:
```
⚠️ Playwright MCP is not configured.
   1. Run: npx playwright install (or see Step 1 for registry workaround)
   2. Add the MCP server config to .vscode/mcp.json — Option A or B above
   3. Restart VS Code
   Without it, app observation is not possible.
```

## Execution Methods

There are **two ways** to execute observation. Choose based on context:

### Method A — Playwright MCP (interactive, agent-driven)
The agent uses `browser_navigate`, `browser_screenshot`, `browser_snapshot` MCP tools step-by-step. Best when you need adaptive exploration (following discovered links, handling auth walls, capturing modals).

### Method B — Programmatic script (batch, deterministic)
Run the generic tool directly:
```bash
node .github/tools/observation/observe-app.js <baseUrl> [slug] [routes.json]
```
- `baseUrl`: e.g. `http://localhost:3004/tran-adequacyTRAN/`
- `slug`: obs-slug (auto-derived from URL path if omitted)
- `routes.json`: optional file with `[{route, label, source}]` array — if omitted, loads from existing sitemap or uses root only

This script captures screenshots + DOM snapshots (HTML + JSON) for all routes and writes `sitemap.json`. Use when Playwright MCP is unavailable, or for deterministic re-runs.

> **IMPORTANT**: Do NOT create ad-hoc scripts in the project root. Always use `.github/tools/observation/observe-app.js`.

## Steps

### 0. Auto-setup Playwright MCP (if needed)

Before doing anything, check that Playwright MCP is available:

1. **Check `.vscode/mcp.json`** — if it doesn't exist, **create it** automatically.
   - If `@playwright/mcp` is installed locally (`node_modules/@playwright/mcp/cli.js` exists), prefer **Option B** (node):
     ```json
     {
       "servers": {
         "microsoft/playwright-mcp": {
           "type": "stdio",
           "command": "node",
           "args": ["./node_modules/@playwright/mcp/cli.js", "--config", ".playwright-mcp.json"]
         }
       }
     }
     ```
   - Otherwise, use **Option A** (npx):
     ```json
     {
       "servers": {
         "microsoft/playwright-mcp": {
           "type": "stdio",
           "command": "npx",
           "args": ["@playwright/mcp@latest", "--config", ".playwright-mcp.json"]
         }
       }
     }
     ```
   If it already exists but doesn't include the `microsoft/playwright-mcp` server, **add it** to the existing `servers` object.

2. **Check `.playwright-mcp.json`** — if it doesn't exist, **create it** with video recording enabled:
   ```json
   {
     "browser": {
       "browserName": "chromium",
       "launchOptions": { "headless": true },
       "contextOptions": {
         "bypassCSP": true,
         "recordVideo": {
           "dir": ".discovery/runtime/observations/_mcp-videos",
           "size": { "width": 1280, "height": 720 }
         }
       }
     }
   }
   ```
   > **Important**: The `recordVideo.dir` uses `_mcp-videos` (prefixed with `_`) so it is NOT mistaken for a module slug directory.
   If it already exists, verify that `recordVideo` is configured inside `browser.contextOptions`. If not, add it.

3. **Check ffmpeg** — video recording requires `ffmpeg`. If not installed:
   - macOS: `brew install ffmpeg`
   - Linux: `apt-get install ffmpeg`
   - If ffmpeg is not available, **warn the user** but continue without video (screenshots still work).

4. **Check Playwright browsers** — run `npx playwright install` if not already installed. If registry issues occur, use `npx --registry https://registry.npmjs.org/ playwright install`.

4. **Ensure video output directory exists**:
   ```bash
   mkdir -p .discovery/runtime/observations/_mcp-videos
   ```

5. **Verify tools** — confirm that `browser_navigate`, `browser_screenshot`, `browser_snapshot` are available as MCP tools. If not after creating the config, inform the user they need to restart VS Code.

> This step ensures the agent can self-provision its prerequisites (including video recording) instead of requiring manual user setup.

## ⚠️ Artifact Structure Contract (MANDATORY)

All observation artifacts MUST follow this exact directory layout. **Do not rename or restructure.**

```
.discovery/runtime/observations/<slug>/
├── sitemap.json                       ← route index (screenshot paths are RELATIVE to this dir)
├── doms/                              ← DOM snapshots (plural "doms/")
│   ├── <screen>.html                  ← raw HTML snapshot
│   └── <screen>.json                  ← structured DOM extraction
├── screenshots/                       ← all screenshots (observation + flow steps)
│   ├── <screen>.png                   ← per-route screenshots
│   └── flow-<name>-step<N>-<desc>.png ← flow step screenshots (saved here, NOT under flows/)
└── videos/                            ← session recordings
    ├── sitemap-walkthrough.webm
    └── flow-<name>.webm
```

**Critical rules:**
- Directory is `doms/` (plural) — the dashboard API serves from `doms/`
- ALL screenshots (including flow step screenshots) go into `observations/<slug>/screenshots/`
- Screenshot paths in JSON files (sitemap.json, flow-*.json) MUST be **relative to the slug dir**: `screenshots/home.png`, NOT `.discovery/runtime/observations/<slug>/screenshots/home.png`
- Flow step screenshots use naming: `flow-<flowName>-step<N>-<description>.png`

### 1. Navigate to base URL

```
browser_navigate → <base_url>
browser_screenshot → save to .discovery/runtime/observations/<slug>/screenshots/home.png
browser_snapshot → save HTML to .discovery/runtime/observations/<slug>/doms/home.html
                   save JSON to .discovery/runtime/observations/<slug>/doms/home.json
```

Record:
- Page title
- Current URL (may redirect)
- Viewport size

### 2. Knowledge-driven route discovery

Before relying only on DOM links, **gather routes from all available knowledge sources** to ensure maximum coverage:

#### 2a. Routes from the DOM (current page)

Extract all navigable elements:
- `<a href="...">` — anchor links
- `<nav>` contents — navigation menus
- `<aside>` — sidebars with links
- Elements with `role="link"` or `role="navigation"`
- `<button>` elements that likely navigate (text contains "Go to", "Open", etc.)

#### 2b. Routes from ingested documentation (opportunistic)

Check if `.discovery/runtime/ingested/` has files. **This is optional** — if ingest hasn't run yet (e.g., running in parallel), skip this step and rely on the other sources.

If files exist, **scan them for URLs, routes, page references**:
- Look for patterns like `/path/to/page`, `#/hash-route`, route names, screen names
- Extract mentions of "pantalla", "screen", "page", "view", "formulario", "form"
- Build a list of expected routes/pages from the documentation

#### 2c. Routes from source code (direct grep — no dependency on @codebase)

**Grep the source code directly** for route definitions. This does NOT require `@codebase` to have run — it reads source files directly. This works even when `@codebase` is running in parallel or hasn't been invoked yet.

Search for route patterns based on the framework detected:
- **AngularJS**: `$routeProvider.when(...)`, `$stateProvider.state(...)`, `ui-sref="..."`, `ng-href="..."`
- **Angular**: `RouterModule`, `{ path: '...' }` in routing modules
- **React**: `<Route path="..." />`, `react-router` configs
- **Vue**: `vue-router` route definitions
- **Generic**: URL-like patterns in config files, templates

Commands to discover routes (run ALL that could match, ignore errors):
```bash
# AngularJS routes
grep -rn "\$routeProvider\|\$stateProvider\|when(\|state(" src/ app/ --include="*.js" 2>/dev/null | head -100
grep -rn "ui-sref\|ng-href\|templateUrl" src/ app/ --include="*.html" --include="*.js" 2>/dev/null | head -100

# Angular routes  
grep -rn "path:\s*['\"]" src/ app/ --include="*.ts" 2>/dev/null | head -50

# React routes
grep -rn "<Route\|path=" src/ app/ --include="*.tsx" --include="*.jsx" 2>/dev/null | head -50
```

Parse the grep output to extract route paths. For example:
- `$routeProvider.when('/users', ...)` → route: `/#/users`
- `$stateProvider.state('dashboard', { url: '/dashboard' })` → route: `/#/dashboard`
- `{ path: 'settings', component: SettingsComponent }` → route: `/settings`

> **Why direct grep instead of .discovery/code/?** In fleet/parallel mode, `@codebase` runs simultaneously with `@discovery-runtime`. The `.discovery/code/` artifacts won't exist yet when `observe` runs. Direct grep is instant and has zero dependencies.

Optionally, if `.discovery/code/scan-manifest.json` or `.discovery/code/graph/` DO exist (e.g., from a previous run), use them as an **additional** source — but never depend on them.

#### 2d. Routes from SPA hash navigation

For single-page apps (AngularJS, Angular, React, Vue):
- Check if the app uses hash-based routing (`#/route`) or HTML5 history (`/route`)
- Extract ALL route configs from JS, not just what's visible in the current DOM
- Try both `<base_url>/#/route` and `<base_url>/route` variants

#### 2e. Merge and deduplicate

Merge all discovered routes into a single list with source tracking:
```json
[
  {"route": "/", "label": "Home", "source": "dom"},
  {"route": "/login", "label": "Sign In", "source": "dom"},
  {"route": "/#/dashboard", "label": "Dashboard", "source": "codebase_routes"},
  {"route": "/#/users", "label": "User Management", "source": "ingested_docs"},
  {"route": "/#/reports", "label": "Reports", "source": "codebase_routes"},
  {"route": "/settings", "label": "Settings", "source": "dom"}
]
```

Prioritize visiting:
1. Routes from **docs** (user-facing, likely important business flows)
2. Routes from **codebase** (may include hidden/admin pages not linked in nav)
3. Routes from **DOM** (what's actually navigable)

Filter out:
- External links (different domain)
- Anchor-only links (`#section` without route)
- Asset links (`.css`, `.js`, `.png`, etc.)

### 3. Visit each discovered route (recursive crawl)

Visit ALL routes from the merged list. For **each page visited**, discover NEW routes and add them to the queue (breadth-first crawl). Continue until all reachable routes are visited or the max page limit is reached.

For each route in the list:

```
browser_navigate → <base_url><route>
browser_screenshot → save to .discovery/runtime/observations/<slug>/screenshots/<route_name>.png
browser_snapshot → save to .discovery/runtime/observations/<slug>/doms/<route_name>.html + .json
```

**Screenshot strategy — capture MORE, not less:**
- Take a **full-page screenshot** for every route visited
- If the page has **tabs** or **accordions**, click each one and take a screenshot of each state
- If the page has a **modal trigger** (button labeled "Ver", "Detalle", "Nuevo", etc.), click it, screenshot the modal, then close it
- If the page has a **data table**, screenshot the table area specifically
- If the page has **different states** (empty state, loaded state, error state), try to capture each
- Name screenshots descriptively: `screenshots/<route>--<state>.png` (e.g., `users--table.png`, `users--modal-detail.png`)

From each page's DOM, extract:

| Element | How to detect | Output |
|---------|--------------|--------|
| **Page title** | `<title>` or `<h1>` | string |
| **Forms** | `<form>`, `<input>`, `<select>`, `<textarea>` | field names, types, labels, required |
| **Buttons** | `<button>`, `[role="button"]`, `input[type="submit"]` | label, action type |
| **Data tables** | `<table>`, `[role="grid"]` | column headers, row count |
| **Navigation** | Links not yet visited | **add to route queue** |
| **Modals/dialogs** | `[role="dialog"]`, `.modal` | trigger element, content |
| **Error states** | `.error`, `.alert`, HTTP status | message text |
| **Tabs/accordions** | `[role="tab"]`, `.tab`, `.accordion` | labels, count |
| **Sub-navigation** | Secondary menus, breadcrumbs | additional routes |
| **CSS resources** | `<link rel="stylesheet">`, `<style>` blocks | href, inline size |
| **Design system classes** | Body/main container class names | design system identification |

**Recursive discovery**: After visiting a page, extract any NEW links/routes not in the queue and add them. This ensures deep navigation into sub-pages, detail views, and nested routes that aren't visible from the main navigation.

### 4. Detect authentication walls

If navigating to a route results in a redirect to `/login` or similar:
- Mark the route as **authenticated**
- If credentials are available (user provides them), attempt login
- If not, note the route as "requires auth — not observed"

### 5. Generate sitemap

Write `.discovery/runtime/observations/sitemap.json`:

```json
{
  "base_url": "http://localhost:3000",
  "observed_at": "<ISO timestamp>",
  "total_pages": 8,
  "css_resources": [
    {"type": "link", "href": "/static-aei/index-css.css", "source": "head"},
    {"type": "link", "href": "/static-at/styles/transversal.css", "source": "head"},
    {"type": "inline", "size_bytes": 1240, "source": "head"}
  ],
  "design_system": {
    "detected": true,
    "name": "<design-system-name>",
    "evidence": ["class prefixes detected in DOM", "CSS file paths found in page head"],
    "css_packages": ["@<client>/design-system-main", "@<client>/design-system-styles"]
  },
  "pages": [
    {
      "route": "/",
      "title": "Home",
      "screenshot": "screenshots/home.png",
      "elements": {
        "forms": [],
        "buttons": [{"label": "Get Started", "type": "link"}],
        "tables": [],
        "links": 12
      },
      "requires_auth": false
    },
    {
      "route": "/login",
      "title": "Sign In",
      "screenshot": "screenshots/login.png",
      "elements": {
        "forms": [
          {
            "action": "/api/auth/login",
            "method": "POST",
            "fields": [
              {"name": "email", "type": "email", "required": true, "label": "Email"},
              {"name": "password", "type": "password", "required": true, "label": "Password"}
            ]
          }
        ],
        "buttons": [{"label": "Sign In", "type": "submit"}],
        "tables": [],
        "links": 2
      },
      "requires_auth": false
    }
  ],
  "routes_not_visited": [
    {"route": "/admin", "reason": "requires_auth"}
  ]
}
```

### 6. Report

```
🌐 App observed: http://localhost:3000
├── Pages visited: 8
├── Pages requiring auth: 3 (not visited)
├── Forms found: 4
├── Data tables: 2
├── CSS resources: 3 (2 external, 1 inline)
├── Design system: DIMA (detected from class prefixes + CSS paths)
├── Screenshots: .discovery/runtime/observations/<slug>/screenshots/ (8 files)
├── Videos: .discovery/runtime/observations/<slug>/videos/ (session recordings)
├── DOM snapshots: .discovery/runtime/observations/<slug>/doms/ (8 html + 8 json)
├── Sitemap: .discovery/runtime/observations/<slug>/sitemap.json
└── Routes discovered: 11 total

Next steps:
• @discovery-runtime explore <route> — deep-dive into a specific flow
• @discovery-runtime extract — synthesize functionality from observations
```

## Guardrails

- **DO NOT submit forms or click destructive buttons** during observation — only navigate and read
- **Rate limit** — wait at least 1 second between page navigations to avoid overwhelming the app
- **Max pages** — stop after 100 pages to avoid infinite crawling; ask user to continue if needed. In `full` mode, push to visit as many pages as possible before hitting the limit
- **External links** — never navigate outside the base domain
- **Sensitive data** — if the app displays PII (emails, names), do not include it in the sitemap; note the presence of "user data table" without copying content
- **SPA handling** — for single-page apps, the URL may not change; track DOM changes instead
- **Timeout** — if a page doesn't load within 10 seconds, skip and note it


## Multi-Module Convention

All per-module artifacts are namespaced under a **module slug** subdirectory. See `.github/MULTI-MODULE.md` for full layout.

**Path resolution**: When this skill references a path like `.discovery/code/scan-manifest.json` or `.requirement/<slug>/flows/`, the actual path is `.discovery/code/scans/<module-slug>/scan-manifest.json` or `.requirement/<module-slug>/flows/`.

**Registry**: Read `.discovery/code/registry.json` or `.discovery/runtime/registry.json` to discover available modules. Update the registry when producing new artifacts.

**Observation slug (`<obs-slug>`)**: The directory name under `observations/` is ALWAYS derived from the **app URL path** (e.g., `tran-adequacyTRAN` from `http://localhost:3000/tran-adequacyTRAN`). This is NOT the same as the module `slug` from `modules.json` (e.g., `adequacYTRANS`). **Never use the modules.json slug as the observation directory name.** The dashboard remaps obs-slug → module-slug automatically.

**Resolution rule**: Given `APP_URL=http://host/tran-adequacyTRAN/` → `obs-slug = tran-adequacyTRAN`. Use this for ALL paths under `.discovery/runtime/observations/<obs-slug>/` and `.requirement/<obs-slug>/`.
