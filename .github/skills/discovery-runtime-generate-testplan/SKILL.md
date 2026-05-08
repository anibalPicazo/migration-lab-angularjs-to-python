---
name: discovery-runtime-generate-testplan
description: Generates a structured test plan from observed application functionality. Prioritizes test cases by risk and cross-references with existing tests in the codebase.
license: Apache-2.0
compatibility: Requires .requirement/<slug>/functional-map/functional-map.md (run extract-functionality first).
metadata:
  author: discovery-runtime
  version: "1.0"
---

# Runtime - Generate Test Plan

Generate a **structured test plan** from the functional map. Produces prioritized test cases with happy paths, edge cases, and error scenarios. Cross-references with existing tests if available.

## Prerequisites

- `.requirement/<slug>/functional-map/functional-map.md` must exist (run `extract` first)
- Optional: `.discovery/code/symbols/index.json` (for existing test discovery)

## Steps

### 1. Load functional map

```bash
cat .requirement/<slug>/functional-map/functional-map.md
cat .requirement/<slug>/functional-map/functional-map.json 2>/dev/null
```

### 2. Discover existing tests (optional)

If `.discovery/code/symbols/index.json` exists, find test files:

```bash
grep -rn "describe\|it(\|test(\|@Test\|def test_\|func Test" \
  --include="*.spec.*" --include="*.test.*" --include="*Test.*" --include="*_test.*" \
  --exclude-dir=node_modules --exclude-dir=.discovery . | head -100
```

Build a map of existing test coverage by feature area.

### 3. Generate test cases

For each capability in the functional map, generate test cases at 3 levels:

**Happy path** — normal flow with valid data:
- Follow the observed flow exactly
- Use the inputs documented in the functional map
- Expect the documented successful outcome

**Edge cases** — boundary conditions:
- Empty fields (when required)
- Maximum length inputs
- Special characters in text fields
- Boundary values for numeric fields
- Concurrent operations

**Error cases** — things that should fail gracefully:
- Invalid credentials (authentication flows)
- Duplicate entries (registration, creation)
- Missing required fields
- Invalid format (email, phone, date)
- Unauthorized access (without login)
- Not found (invalid IDs, deleted items)

### 4. Prioritize test cases

| Priority | Criteria | Examples |
|----------|----------|---------|
| **Critical** | Data mutation + high usage | Login, payment, data creation |
| **High** | Core CRUD operations | List, edit, delete entities |
| **Medium** | Supporting features | Search, filter, settings |
| **Low** | Cosmetic / preference | Theme toggle, language switch |

Scoring:
- Involves authentication or authorization → +2
- Involves data creation/mutation → +2
- User-facing error handling → +1
- Has existing test coverage → -1
- Pure navigation (no state change) → -1

### 5. Write test plan

Generate `.requirement/<slug>/testplans/testplan-{date}.md`:

```markdown
---
generated_at: <ISO timestamp>
source: functional-map
total_test_cases: 45
critical: 8
high: 15
medium: 14
low: 8
existing_tests_found: 23
---

# Test Plan

Generated from app observation — <date>

## Summary

| Metric | Value |
|--------|-------|
| Total test cases | 45 |
| Critical | 8 |
| High | 15 |
| Medium | 14 |
| Low | 8 |
| Existing tests found | 23 (51%) |
| **New tests needed** | **22** |

## Critical Test Cases

### TC-001: User Login — Happy Path
- **Priority**: Critical
- **Domain**: Authentication
- **Preconditions**: Valid user exists in system
- **Steps**:
  1. Navigate to /login
  2. Enter valid email
  3. Enter valid password
  4. Click "Sign In"
- **Expected result**: Redirect to /dashboard, session established
- **Observed**: Confirmed via flow-login.json
- **Existing test**: auth.spec.ts (line 15) — ✅ covered

### TC-002: User Login — Invalid Credentials
- **Priority**: Critical
- **Domain**: Authentication
- **Preconditions**: None
- **Steps**:
  1. Navigate to /login
  2. Enter invalid email
  3. Enter any password
  4. Click "Sign In"
- **Expected result**: Error message "Invalid email or password"
- **Existing test**: ❌ NOT FOUND

### TC-003: User Login — Empty Fields
- **Priority**: High
- **Domain**: Authentication
- **Steps**:
  1. Navigate to /login
  2. Click "Sign In" without filling fields
- **Expected result**: Client-side validation errors shown
- **Existing test**: ❌ NOT FOUND

...

## Coverage Gap Summary

| Domain | Total TCs | Covered | Gap |
|--------|-----------|---------|-----|
| Authentication | 8 | 3 | 5 |
| User Management | 10 | 7 | 3 |
| Dashboard | 5 | 5 | 0 |
| Content (Orders) | 22 | 8 | 14 |
```

### 6. Report

```
📝 Test plan generated
├── Total test cases: 45
├── Priority: Critical 8 | High 15 | Medium 14 | Low 8
├── Existing tests found: 23 (51%)
├── New tests needed: 22
├── Coverage gaps: Authentication (5), Content (14)
└── Saved: .requirement/<slug>/testplans/testplan-2026-03-20.md

Next steps:
• @discovery-runtime crossref — map test cases to actual code
• @discovery-runtime coverage — generate coverage report
```

## Guardrails

- **DO NOT invent test scenarios** — only derive from observed functionality
- **Always check existing tests** — don't duplicate what's already tested
- **Prioritization is mandatory** — every test case must have a priority level
- **Unique IDs** — every test case gets a TC-NNN identifier
- **Traceability** — link each test case to the observed flow/capability
- **Practical steps** — test steps must be concrete and actionable, not abstract


## Multi-Module Convention

All per-module artifacts are namespaced under a **module slug** subdirectory. See `.github/MULTI-MODULE.md` for full layout.

**Path resolution**: When this skill references a path like `.discovery/code/scan-manifest.json` or `.requirement/<slug>/flows/`, the actual path is `.discovery/code/scans/<module-slug>/scan-manifest.json` or `.requirement/<module-slug>/flows/`.

**Registry**: Read `.discovery/code/registry.json` or `.discovery/runtime/registry.json` to discover available modules. Update the registry when producing new artifacts.

**Module slug**: Derived from the app URL path (e.g., `tran-adequacyTRAN` from `http://localhost:3000/tran-adequacyTRAN`). If only one module exists, use it implicitly. If multiple exist, ask the user.
