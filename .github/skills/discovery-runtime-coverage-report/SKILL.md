---
name: discovery-runtime-coverage-report
description: Generates a functional coverage report combining test plan results, cross-reference data, and risk assessment. Provides actionable recommendations.
license: Apache-2.0
compatibility: Requires .requirement/<slug>/crossref/crossref-report.md and .requirement/<slug>/testplans/ data.
metadata:
   author: discovery-runtime
   version: "1.0"
---

# Runtime - Coverage Report

Generate a **functional coverage report** that synthesizes the test plan, cross-reference data, and risk assessment into actionable recommendations. This is the final output of the @discovery-runtime pipeline.

## Prerequisites

- `.requirement/<slug>/crossref/crossref-report.md` (from `crossref`) — **required**
- `.requirement/<slug>/testplans/testplan-*.md` (from `testplan`) — **required**
- `.requirement/<slug>/functional-map/functional-map.md` (from `extract`) — recommended

## Steps

### 1. Load all artifacts

```bash
cat .requirement/<slug>/crossref/crossref-report.json 2>/dev/null || cat .requirement/<slug>/crossref/crossref-report.md
ls -t .requirement/<slug>/testplans/testplan-*.md | head -1 | xargs cat
cat .requirement/<slug>/functional-map/functional-map.json 2>/dev/null
```

### 2. Calculate coverage metrics

| Metric | How to calculate |
|--------|-----------------|
| **Feature coverage** | Features mapped to code / Total features observed |
| **Test coverage** | Features with existing tests / Total features observed |
| **Gap count** | Features without tests |
| **Dead code** | Code symbols with no UI/route reference |
| **Orphan routes** | UI routes with no code handler |
| **Risk score** | Weighted sum of untested critical paths |

### 3. Risk assessment per domain

For each functional domain, calculate risk:

| Factor | Weight |
|--------|--------|
| Untested critical feature | +5 |
| Untested high feature | +3 |
| Untested medium feature | +1 |
| Data mutation without test | +4 |
| Auth flow without test | +4 |
| Orphan route (UI without code) | +3 |
| Dead code candidate | +1 |

| Domain risk | Score range |
|-------------|-------------|
| LOW | 0–5 |
| MEDIUM | 6–15 |
| HIGH | 16–30 |
| CRITICAL | 31+ |

### 4. Generate recommendations

Based on gaps and risk:

**Immediate actions** (risk reducers):
- Write tests for untested critical features
- Investigate orphan routes (missing code or dead UI)
- Review dead code candidates for removal

**Short-term improvements**:
- Add integration tests for high-risk flows
- Improve error handling coverage
- Add tests for edge cases identified in test plan

**Long-term maintenance**:
- Set up test coverage monitoring
- Add E2E tests for critical user flows
- Regular re-observation to detect drift

### 5. Write coverage report

Generate `.requirement/<slug>/coverage/coverage-{date}.md`:

```markdown
---
generated_at: <ISO timestamp>
source: crossref + testplan
---

# Functional Coverage Report

## Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Features observed | 12 | — |
| Code identified | 10 (83%) | 🟡 |
| Tests exist | 7 (58%) | 🔴 |
| Untested features | 5 | ⚠️ |
| Dead code candidates | 2 files | ℹ️ |
| Orphan routes | 1 | ⚠️ |
| Overall risk | **MEDIUM** (score: 18) | 🟡 |

## Coverage by Domain

| Domain | Features | Code mapped | Tested | Gap | Risk |
|--------|----------|------------|--------|-----|------|
| Authentication | 3 | 3 (100%) | 2 (67%) | 1 | MEDIUM |
| User Management | 3 | 2 (67%) | 1 (33%) | 2 | HIGH |
| Dashboard | 1 | 1 (100%) | 1 (100%) | 0 | LOW |
| Content (Orders) | 5 | 4 (80%) | 3 (60%) | 2 | MEDIUM |

## Risk Heat Map

```
              Tested    Untested
             ┌─────────┬─────────┐
   Critical  │ Login   │ ⚠️ -    │
             │ Register│         │
             ├─────────┼─────────┤
   High      │ Orders  │ ⚠️ Del  │
             │ List    │ Profile │
             ├─────────┼─────────┤
   Medium    │ Search  │ Settings│
             │         │ Filter  │
             └─────────┴─────────┘
```

## Top Risks

1. 🔴 **Settings page** — UI exists, no backend handler found
   - Action: Investigate if frontend-only or if code is missing
   
2. 🔴 **Order delete** — data mutation with no test coverage
   - Action: Write unit test for OrderService.delete + integration test

3. 🟡 **User profile** — read-only but user-facing, no tests
   - Action: Write unit test for UserService.getProfile

## Dead Code

| File | Reason | Recommendation |
|------|--------|---------------|
| OldDashboard.tsx | No route references it | Remove or verify if needed |
| legacy.service.ts | Imported but never called | Remove or refactor |

## Recommendations

### 🔴 Immediate (this sprint)
1. Write tests for `OrderService.delete` — critical data mutation
2. Investigate `/settings` orphan route — potential missing functionality
3. Add test for `AuthService.forgotPassword` — security-sensitive flow

### 🟡 Short-term (next sprint)
4. Add tests for `UserService.getProfile` — user-facing feature
5. Add integration tests for login → dashboard flow
6. Review dead code candidates for cleanup

### 🟢 Long-term
7. Set up automated coverage monitoring
8. Schedule quarterly re-observation of the running app
9. Add E2E tests for complete user journeys

## Appendix: Full Feature Matrix

| # | Feature | Route | Code | Test | Priority | Risk |
|---|---------|-------|------|------|----------|------|
| 1 | Login | /login | ✅ auth.ctrl:45 | ✅ auth.spec:15 | Critical | LOW |
| 2 | Register | /register | ✅ auth.ctrl:78 | ✅ auth.spec:40 | Critical | LOW |
| 3 | Forgot Password | /forgot | ✅ auth.ctrl:95 | ❌ | Critical | HIGH |
| 4 | Profile | /profile | ✅ user.ctrl:22 | ❌ | High | MEDIUM |
| 5 | Settings | /settings | ❌ | ❌ | Medium | HIGH |
| ... | | | | | | |
```

### 6. Report

```
📊 Coverage report generated
├── Overall risk: MEDIUM (score: 18)
├── Feature coverage: 83% (10/12 mapped to code)
├── Test coverage: 58% (7/12 have tests)
├── Top risk: Settings (orphan route) + Order delete (untested mutation)
├── Recommendations: 3 immediate, 3 short-term, 3 long-term
└── Report: .requirement/<slug>/coverage/coverage-2026-03-20.md

This report can be shared with:
• @discovery-knowledge — to update foundation docs with coverage findings
• @delivery — to prioritize test writing and dead code cleanup
```

## Guardrails

- **DO NOT inflate coverage** — only count features with verified tests
- **Risk scoring must be transparent** — show the calculation, not just the result
- **Recommendations must be actionable** — specific file/function, not vague "improve testing"
- **Markdown report is primary** — it's the deliverable shared with stakeholders
- **Date stamp everything** — coverage is a point-in-time metric, always include date
- **Conservative dead code** — never say "delete this"; always say "candidate for review"
