---
version: "1.0"
status: active
owner: TBD
created: YYYY-MM-DD
last-updated: YYYY-MM-DD
adopted-from:
  - <path to QA strategy document or test plan>
changelog:
  - version: "1.0"
    date: YYYY-MM-DD
    change: Generated during discovery phase from documentation and test codebase
---

# 04 — Testing Strategy

> This document defines the normative testing approach for the project.  
> Coding agents MUST read this document fully before writing any test code.

---

## Guidance

- The **Normative Strategy** section is the authoritative layer — derived from documentation and architecture decisions.
- The **Observed Conventions** section is populated by `@discovery-code` from actual test files.
- When the two layers conflict, raise it as an open question — do NOT silently pick one.
- Remove Guidance blocks when sections contain real project data.

---

## Test Pyramid

Guidance: Describe the intended distribution across test levels for this project.

| Level | Scope | Tool / Framework | Target Coverage |
|---|---|---|---|
| Unit | Single class / function in isolation | [e.g., Jest, JUnit] | [e.g., 80%+] |
| Integration | Service + dependencies (mocked infra) | [e.g., TestContainers, Angular TestBed] | [e.g., key flows] |
| E2E / Contract | Full feature path or API contract | [e.g., Playwright, Pact] | [e.g., critical paths only] |

---

## Normative Strategy

### Test Scope

Guidance: Define what must always be tested, what is optional, and what is explicitly out of scope.

**Always test:**
- [ ] All acceptance scenarios from Feature Specs (Given/When/Then → test case)
- [ ] Error paths and exception handling
- [ ] [Add project-specific mandatory coverage rules]

**Optional:**
- [ ] Internal helper functions covered by higher-level tests
- [ ] [Add project-specific optional rules]

**Out of scope:**
- [ ] Framework internals (no testing Angular change detection directly)
- [ ] [Add project-specific exclusions]

### Test Data Management

Guidance: Describe how test fixtures, mocks, and stubs are managed.

- **Fixtures**: located at `[e.g., src/testing/fixtures/]`
- **Mock strategy**: [e.g., manual mocks via `jest.fn()`, auto-mocking disabled]
- **External services**: always stub/mock — no real HTTP calls in unit or integration tests
- [Add project-specific rules]

### Assertion Style

Guidance: Describe the preferred assertion approach.

- Use `expect().toEqual()` for deep equality — never `toBe()` for objects
- Test behaviour, not implementation — avoid assertions on private state
- [Add project-specific rules]

---

## Observed Conventions (from codebase)

> **@discovery-code** populates this section from discovered test files.  
> Look for patterns in `*.spec.ts`, `*Test.java`, or equivalent test files.

*No conventions extracted yet — run `@discovery-code full` first.*

### Discovered Test Patterns

Guidance: This sub-section is auto-populated. Example structure:

```
Pattern: Arrange-Act-Assert blocks clearly separated by blank lines
Confidence: HIGH (found in 94% of test files)
Source: .discovery/code/symbols/<slug>/index.json

Pattern: beforeEach used for service instantiation
Confidence: HIGH
Source: .discovery/code/graph/<slug>/edges.json
```

---

## Quality Gates

Guidance: Document the CI quality gates that block merge.

| Gate | Threshold | Enforcement |
|---|---|---|
| Unit test pass rate | 100% | CI pipeline |
| Coverage (lines) | [e.g., 80%] | [e.g., jest --coverage] |
| E2E smoke pass rate | 100% | [e.g., Playwright CI job] |
| [Add rows per project] | | |

---

## 📎 Sources

*Populated by discovery agents. List ingested test strategy documents and codebase artifacts used to derive this strategy.*

