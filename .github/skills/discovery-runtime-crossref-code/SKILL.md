---
name: discovery-runtime-crossref-code
description: Cross-references observed application behavior with actual source code. Maps UI routes to components, handlers, services, and tests. The key skill that connects observation to code.
license: Apache-2.0
compatibility: Requires .requirement/<slug>/flows/ data AND .discovery/code/ index (run both @discovery-runtime and @discovery-code first).
metadata:
  author: discovery-runtime
  version: "1.0"
---

# Runtime - Cross-Reference Code

**The key skill.** Cross-references observed application behavior with the actual source code. Maps every UI route to its component, handler, service, and tests. Identifies gaps: untested features, dead code, and orphan routes.

## Prerequisites

- `.requirement/<slug>/functional-map/functional-map.md` — observed functionality
- `.requirement/<slug>/testplans/testplan-*.md` — test plan (optional but recommended)
- `.discovery/code/symbols/index.json` — code symbol index (**required**)
- `.discovery/code/graph/edges.json` — code relationship graph (**required**)

If codebase index is missing:
```
⚠️ Codebase not indexed. Run: @discovery-code index
   Cross-referencing requires the symbol graph to map behavior to code.
```

## Steps

### 1. Load all inputs

```bash
cat .requirement/<slug>/functional-map/functional-map.json
cat .discovery/code/symbols/index.json
cat .discovery/code/graph/edges.json
cat .discovery/code/scan-manifest.json
```

Also load the latest test plan if available:
```bash
ls -t .requirement/<slug>/testplans/testplan-*.md | head -1
```

### 2. For each observed route → find route definition in code

Search the symbol index and codebase for route definitions:

**React Router**:
```bash
grep -rn 'path=.*"/login"\|path:.*"/login"' --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" .
```

**Express/NestJS**:
```bash
grep -rn 'app\.get.*"/login"\|@Get.*"/login"\|router\.get.*"/login"' --include="*.ts" --include="*.js" .
```

**Spring Boot**:
```bash
grep -rn '@RequestMapping.*"/login"\|@GetMapping.*"/login"\|@PostMapping.*"/login"' --include="*.java" --include="*.kt" .
```

**Django**:
```bash
grep -rn 'path.*login\|url.*login' --include="*.py" .
```

**ASP.NET**:
```bash
grep -rn '\[Route.*login\]\|\[HttpGet.*login\]' --include="*.cs" .
```

For each route, record the file and line where it's defined.

### 3. For each route → find component/view

From the route definition, trace to the component:

- **Frontend routes**: Route → Component reference → find component file in symbols
- **Backend routes**: Route → Controller method → follow CALLS edges to service layer

Use the graph edges to trace the full chain:
```
Route definition
    → Component/Controller (CONTAINS or CALLS)
        → Service methods (CALLS)
            → Repository/Data access (CALLS)
                → External services (CALLS)
```

### 4. For each form action → find handler

From observed form actions (POST endpoints):
1. Search for the endpoint URL in code
2. Trace the handler: controller → service → data layer
3. Record the full call chain

### 5. For each capability → find tests

For each mapped code path, check for tests:

1. Search graph edges for `TESTS` type
2. Search for test files importing the relevant modules:
   ```bash
   grep -rn "import.*UserService\|require.*UserService" \
     --include="*.spec.*" --include="*.test.*" --include="*Test.*" .
   ```
3. Match test descriptions to capabilities:
   ```bash
   grep -rn "describe.*login\|it.*should.*login\|test.*login" \
     --include="*.spec.*" --include="*.test.*" .
   ```

### 6. Detect gaps

**Untested features**: Observed capabilities with code identified but no tests found.

**Dead code**: Code symbols (components, services) that have no incoming edges from any observed route.
- Find all component/service symbols
- Check which ones are NOT referenced by any observed route's call chain
- These are potential dead code candidates

**Orphan routes**: Routes visible in the UI that have no corresponding code found.
- Routes in the sitemap that didn't match any code definition
- Could indicate: dynamically generated routes, external redirects, or missing code

### 7. Generate cross-reference report

Write `.requirement/<slug>/crossref/crossref-report.md`:

```markdown
---
generated_at: <ISO timestamp>
features_observed: 12
features_mapped: 10
features_tested: 7
dead_code_candidates: 2
orphan_routes: 1
---

# Cross-Reference: Observed Behavior ↔ Code

## Summary

| Metric | Value |
|--------|-------|
| Features observed | 12 |
| Features mapped to code | 10 (83%) |
| Features with tests | 7 (58%) |
| Untested features | 5 |
| Dead code candidates | 2 files |
| Orphan routes | 1 |

## Feature → Code Mapping

| Feature | Route | Component | Handler | Service | Test? |
|---------|-------|-----------|---------|---------|-------|
| Login | /login | LoginForm.tsx:14 | auth.ctrl.ts:45 | AuthService:login | ✅ auth.spec.ts |
| Register | /register | Register.tsx:8 | auth.ctrl.ts:78 | AuthService:register | ✅ auth.spec.ts |
| Profile | /profile | Profile.tsx:8 | user.ctrl.ts:22 | UserService:getProfile | ❌ MISSING |
| Settings | /settings | Settings.tsx:5 | ❓ not found | ❓ not found | ❌ |
| Orders List | /orders | OrderList.tsx:12 | order.ctrl.ts:15 | OrderService:list | ✅ order.spec.ts |

## Untested Paths

| Feature | Code path | Risk |
|---------|-----------|------|
| Profile view | UserService.getProfile → UserRepo.findById | MEDIUM — read-only but user-facing |
| Settings | No backend found | HIGH — UI exists but no handler |
| Order delete | OrderService.delete → OrderRepo.remove | HIGH — data mutation, no tests |

## Dead Code Candidates

| File | Symbol | Last edge | Reason |
|------|--------|-----------|--------|
| src/components/OldDashboard.tsx | OldDashboard | none | No route references this component |
| src/services/legacy.service.ts | LegacyService | 1 import (unused) | Only imported but never called |

## Orphan Routes

| Route | Observed in UI | Code found |
|-------|---------------|------------|
| /settings | Yes (nav menu) | No handler/controller found |

## Call Chain Details

### Login Flow
```
/login (route) → LoginForm.tsx (component)
    → authApi.login() (API call) → POST /api/auth/login
        → AuthController.login (handler)
            → AuthService.login (service)
                → UserRepository.findByEmail (data)
                → bcrypt.compare (auth check)
                → jwt.sign (token generation)
```

### Profile Flow
```
/profile (route) → Profile.tsx (component)
    → userApi.getProfile() (API call) → GET /api/users/me
        → UserController.getProfile (handler)
            → UserService.getProfile (service)
                → UserRepository.findById (data) ← ❌ NO TEST
```
```

Also write `.requirement/<slug>/crossref/crossref-report.json` with the structured data.

### 8. Report

```
🔗 Cross-reference complete
├── Features mapped: 10/12 (83%)
├── Features tested: 7/12 (58%)
├── Untested paths: 5 — ⚠️ action required
├── Dead code: 2 candidates
├── Orphan routes: 1
├── Report MD: .requirement/<slug>/crossref/crossref-report.md
└── Report JSON: .requirement/<slug>/crossref/crossref-report.json

🔴 Top risks:
1. /settings — UI exists, no backend handler found
2. OrderService.delete — data mutation without tests
3. UserService.getProfile — user-facing, no tests
```

## Guardrails

- **DO NOT guess code mappings** — only report confirmed matches (file + line)
- **Mark unknowns explicitly** — use ❓ for features where no code was found
- **Both formats** — always produce Markdown + JSON
- **Trace full chains** — don't stop at the first match; follow the call chain through the graph
- **Dead code is a suggestion** — label as "candidate", not "confirmed dead code"
- **Respect confidence** — if a mapping relies on name matching (not graph edges), mark as `confidence: "medium"`


## Multi-Module Convention

All per-module artifacts are namespaced under a **module slug** subdirectory. See `.github/MULTI-MODULE.md` for full layout.

**Path resolution**: When this skill references a path like `.discovery/code/scan-manifest.json` or `.requirement/<slug>/flows/`, the actual path is `.discovery/code/scans/<module-slug>/scan-manifest.json` or `.requirement/<module-slug>/flows/`.

**Registry**: Read `.discovery/code/registry.json` or `.discovery/runtime/registry.json` to discover available modules. Update the registry when producing new artifacts.

**Module slug**: Derived from the app URL path (e.g., `tran-adequacyTRAN` from `http://localhost:3000/tran-adequacyTRAN`). If only one module exists, use it implicitly. If multiple exist, ask the user.
