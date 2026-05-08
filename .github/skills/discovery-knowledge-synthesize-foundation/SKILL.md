---
name: discovery-knowledge-synthesize-foundation
description: Stage 2 of the documentation analysis lifecycle. Reads all ingested documents from .discovery/knowledge/, classifies them by type, and synthesizes foundation documents directly into .foundation/ (up to 9 documents depending on source coverage). Run after discovery-knowledge ingest completes.
license: Apache-2.0
compatibility: Requires .discovery/knowledge/ with at least one converted Markdown file.
metadata:
  author: discovery-knowledge
  version: "1.0"
---

# Documentation Analysis ? Write Foundation Documents

Synthesize ingested documentation into **foundation documents** written directly to `.foundation/`. This skill is the final stage of the documentation analysis lifecycle ? it transforms converted Markdown files into structured knowledge that `@delivery` and the team can consume.

This skill generates between 6 and 9 foundation documents depending on source coverage. The always-generated set is `project-intent.md`, `domain-landscape.md`, `guardrails.md`, `anti-patterns.md`, `architecture-decisions.md`, and `task-spec.md`. Additional docs (`coding-conventions.md`, `testing-strategy.md`, `framework-api-registry.md`) are generated when sufficient source material is present.

## When to Invoke

- After `@discovery-knowledge ingest` (or `ingest --all`) completes successfully
- When re-synthesizing after new documents are ingested
- When a new documentation batch is onboarded and ingested

## Prerequisites

| Artifact | Path | Produced by |
|---|---|---|
| Ingested documents | `.discovery/knowledge/*.md` | `discovery-knowledge-convert-*` skills |
| Ingestion state | `.discovery/knowledge/state.json` | Updated after each conversion |

🚫 **GATE**: If `.discovery/knowledge/` is empty or contains no `.md` files, report:
> "No ingested documents found. Run `@discovery-knowledge ingest <path>` first."

## Inputs

| Parameter | Required | Description |
|---|---|---|
| (none) | n/a | Foundation synthesis uses ingested docs in flat shared structure |
| `--overwrite` | no | Overwrite existing foundation docs (default: ask if file exists) |

## Outputs ? Foundation Documents

| Document | Path | Content source | When generated |
|---|---|---|---|
| Guardrails | `.foundation/guardrails.md` | Non-negotiable principles and constraints | Always |
| Anti-Patterns | `.foundation/anti-patterns.md` | Forbidden patterns with ?/? examples | Always |
| Coding Conventions | `.foundation/coding-conventions.md` | Naming, structure, style conventions | When coding guides are ingested |
| Testing Strategy | `.foundation/testing-strategy.md` | Test strategy, quality levels, conventions | When testing docs are ingested |
| Architecture Decisions | `.foundation/architecture-decisions.md` | ADRs: context, decisions, consequences | Always |
| Task Spec Template | `.foundation/task-spec.md` | Reusable task template for `@delivery` | Always |
| Framework API Registry | `.foundation/framework-api-registry.md` | Correct API signatures and usage notes | When framework docs are ingested |
| Project Intent | `.foundation/project-intent.md` | Vision, goals, scope, constraints from ingested docs | Always |
| Domain Landscape | `.foundation/domain-landscape.md` | Bounded contexts, glossary, relationships | Always |
---

## Foundation Document Classification

Every foundation document written by this skill MUST include a classification header immediately after the `# Title` heading (before the `>` blockquote description). This header encodes the document's governance level, scope, and purpose for use by downstream agents and delivery workflows.

### Level Determination Rules

Apply these rules in order. The first matching rule wins:

| Rule | Condition | Level |
|---|---|---|
| A — Fixed Governance docs | `guardrails.md`, `anti-patterns.md` — always project-wide standards | **1 (Global)** |
| B — Fixed Process templates | `task-spec.md` — always a project-wide template | **1 (Global)** |
| C — Org-wide documentation | Ingested docs are organizational standards, enterprise guidelines, or cross-project policies | **1 (Global)** |
| D — Project/domain-specific intent | Ingested docs describe a single project's goals, domain, or decisions | **2 (Domain)** |
| E — Mixed ADR scope | `architecture-decisions.md` contains ADRs at different levels — use the highest level present | Highest of 1/2/3 |
| F — Application-specific feature docs | `feature-spec.md`, `coding-conventions.md`, `testing-strategy.md`, `framework-api-registry.md` when generated from project-specific material | **3 (Application)** |

### Classification Table

| Document | Default Level | Can become | Scope | Category |
|---|---|---|---|---|
| `project-intent.md` | 1 (Global) | 2 (Domain) if project-specific | Strategic | Business Context |
| `domain-landscape.md` | 2 (Domain) | 1 (Global) if org-wide | Strategic | Domain Model |
| `guardrails.md` | 1 (Global) | — (fixed) | Governance | Engineering Standards |
| `anti-patterns.md` | 1 (Global) | — (fixed) | Governance | Engineering Standards |
| `architecture-decisions.md` | 1 (Global) | 2 or 3 per ADR scope | Governance | Architecture Decisions |
| `task-spec.md` | 1 (Global) | — (fixed) | Governance | Process & Templates |
| `feature-spec.md` | 1 (Global) | 3 (Application) if project-adapted | Governance | Process & Templates |
| `coding-conventions.md` | 1 (Global) | 3 (Application) if from project code | Governance | Engineering Standards |
| `testing-strategy.md` | 1 (Global) | 3 (Application) if from project tests | Governance | Testing & Quality |
| `framework-api-registry.md` | 1 (Global) | 3 (Application) if module-specific | Tactical | Technical Architecture |

> **Purpose field**: Write 1–2 sentences describing the specific content of this document instance. Mention which ingested documents contributed and what team/role will primarily consume this document. Example: *"Vision and success criteria extracted from the Marks Management project specification. Primary input for delivery agents scoping migration tasks."*

---

## Steps

### 1. Load and classify all ingested documents

```bash
ls .discovery/knowledge/*.md
ls .discovery/knowledge/*.json
```

For each `.md` file, read its frontmatter and first 100 lines to classify it:

**Classification categories**:

| Category | Indicators | Feeds into |
|---|---|---|
| `architecture` | "guardrails", "principles", "standards", "constraints", "forbidden", "must not" | `guardrails.md`, `anti-patterns.md` |
| `decisions` | "ADR", "decision", "why", "alternatives considered", "rationale", "trade-off" | `architecture-decisions.md` |
| `functional` | "user story", "business rule", "use case", "workflow", "requirement" | `project-intent.md`, `domain-landscape.md` |
| `domain` | "glossary", "terminology", "entity", "bounded context", "domain model" | `domain-landscape.md` |
| `coding-guide` | "coding guide", "best practice", "pattern", "example", "anti-pattern" | `guardrails.md`, `anti-patterns.md` |
| `target-architecture` | "target", "migration", "objective", "to-be", "target technology", "target framework" | `project-intent.md`, `guardrails.md` |
| `mixed` | None of the above clearly dominant | Used across multiple docs |

Report classification to the user before proceeding:
```
?? Classifying 12 ingested documents:
  architecture (3): coding-guide-<framework>.md, guardrails-<project>.md, security-standards.md
  functional (4): functional-spec-<module>.md, business-rules.md, ...
  domain (2): domain-glossary.md, entity-model.md
  decisions (1): adr-migration-approach.md
  target-architecture (2): target-arch-deck.md, migration-overview.md
```

### 2. Create output directories

```bash
mkdir -p .foundation
```

### 3. Write `project-intent.md`

**Source**: Documents classified as `functional`, `target-architecture`, and any doc with explicit scope/objectives content.

Read each relevant doc and extract:
- **Project vision**: What problem does this project solve? What is the goal of the migration?
- **Target users**: Who are the primary users?
- **Success criteria**: Measurable outcomes (functional parity, performance SLAs, etc.)
- **Scope**: What is explicitly included? What is out of scope?
- **Business constraints**: Deadlines, compliance requirements, non-negotiable business rules
- **Migration context** (if present): From ? To (legacy technology ? target technology, versions)

**Document structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-knowledge
---

# Project Intent
Level: [Apply Level Determination Rules — default 1 (Global), set 2 (Domain) if docs are project-specific]
Scope: Strategic
Category: Business Context
Purpose: [Describe in 1–2 sentences: which project/program, what business problem, and who consumes this document.]

> Vision, objectives, scope, and business constraints for this project.
> Source: `.discovery/knowledge/`

## Vision

<extracted from docs>

## Objectives

- <objective 1>
- <objective 2>

## Target Users

<who uses this project and how>

## Scope

### In scope
- <item>

### Out of scope
- <item>

## Success Criteria

| Criterion | Measure |
|---|---|
| Functional parity | All existing features reproduced in target technology |
| <other criterion> | <measure> |

## Business Constraints

- <constraint 1>
- <constraint 2>

## Migration Context (if applicable)

| Dimension | As-Is (legacy) | To-Be (target) |
|---|---|---|
| Framework | <legacy framework/version> | <target framework/version> |
| Language | <legacy language/version> | <target language/version> |
| <other> | <current> | <target> |

## ?? Sources

- `.discovery/knowledge/<file>.md` → <what this file contributed>
```

### 4. Write `domain-landscape.md`

**Source**: Documents classified as `domain`, `functional`, and any doc containing entity definitions, glossaries, or bounded context descriptions.

Extract:
- **Bounded contexts / functional areas**: Major domains (e.g., Marks Management, Categories, Reports)
- **Domain glossary**: Key business terms with precise definitions (from specs, manuals, or glossary docs)
- **Entity relationships**: How entities relate to each other at a conceptual level
- **Domain interactions**: How bounded contexts communicate or depend on each other

**Document structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-knowledge
---

# Domain Landscape
Level: [Apply Level Determination Rules — default 2 (Domain), set 1 (Global) if org-wide glossary/model]
Scope: Strategic
Category: Domain Model
Purpose: [Describe in 1–2 sentences: which domain or domains are covered, what types of entities/contexts are documented, and for whom.]

> Bounded contexts, domain glossary, and relationships for this project.
> Source: `.discovery/knowledge/`

## Functional Areas / Bounded Contexts

| Area | Responsibility | Key Entities | Owner |
|---|---|---|---|
| <area name> | <what it owns> | Entity1, Entity2 | <team/role> |

## Domain Glossary

| Term | Definition | Context |
|---|---|---|
| <term> | <precise business definition> | <where it is used> |

## Entity Relationships (conceptual)

```
<EntityA> ---- has many ---- <EntityB>
<EntityC> ---- belongs to -- <EntityA>
```

## Domain Interactions

| From | To | Interaction | Notes |
|---|---|---|---|
| <context A> | <context B> | <how> | <constraints> |

## ?? Sources

- `.discovery/knowledge/<file>.md` ? <what this file contributed>
```

### 5. Write `guardrails.md`

**Source**: Documents classified as `architecture`, `coding-guide`, `target-architecture`, and any doc with explicit constraints, forbidden patterns, or quality gates.

?? **Idempotency**: If `.foundation/guardrails.md` already exists, **merge** by appending new rules and examples. Never destructively overwrite existing content.

Extract:
- **Non-negotiable principles**: Rules that must never be broken (security, dependencies, patterns)
- **Tech stack constraints**: Approved languages, frameworks, libraries, and versions
- **Forbidden patterns**: Explicitly prohibited approaches
- **Quality gates**: Minimum test coverage, CI requirements, performance budgets
- **Security rules**: Authentication, authorization, secret handling, input validation
- **Migration rules**: What must/must not be done when migrating from legacy
- **Logging rules**: Log minimalism policy, approved log levels and their semantic meaning, prohibition against logging sensitive data, logging library/annotation in use. Look for signal phrases: "minimize logs", "logging noise", "log levels", "don't log sensitive", "log only errors", or any reference to the project's logging library/annotation.
- **Exception handling preference**: Direct use of the framework's base exception class vs. proliferating subclasses. Look for signal phrases: "direct exception", "no custom exception classes", "error codes in constants file", "avoid exception subclasses", "simplicity over exception hierarchy".

**Document structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-knowledge
---

# Architectural Guardrails
Level: 1 (Global)
Scope: Governance
Category: Engineering Standards
Purpose: [Describe in 1–2 sentences: which standards/principles are documented, which ingested sources contributed them, and that violation blocks delivery.]

> Non-negotiable principles and constraints. Violation is a build blocker.
> Updated by `@discovery-knowledge` as new documentation is analyzed.

## Core Principles

1. **<Principle name>**: <description and rationale>
2. ...

## Approved Tech Stack

| Role | Technology | Version | Notes |
|---|---|---|---|
| <role> | <technology> | <version> | <notes> |
| <role> | <technology> | <version> | <notes> |

## Forbidden Patterns

| Pattern | Why forbidden | Correct alternative |
|---|---|---|
| <forbidden> | <reason> | <correct approach> |

## Quality Gates

| Gate | Requirement |
|---|---|
| Unit test coverage | = 80% |
| <gate> | <requirement> |

## Security Rules

- <rule 1>
- <rule 2>

## Logging Rules

- <log minimalism policy>
- <approved log levels and semantics>
- <logging library / annotation convention>
- <prohibition on sensitive data in logs>

## Exception Handling Preference

- <direct use of base exception class vs. subclasses rule>
- <where error codes / constants live>

## Contribution Entry

New guardrails extracted from the latest documentation batch:
- <specific rule>

## ?? Sources

- `.discovery/knowledge/<file>.md` ? <what this file contributed>
```

### 6. Write `anti-patterns.md`

**Source**: Documents classified as `coding-guide`, `architecture`, any doc with "don't do", "avoid", "never", "anti-pattern", "?" content.

?? **Idempotency**: Merge mode ? add new anti-patterns as new entries, never remove existing shared entries.

Extract each anti-pattern as a named entry with:
- **Name**: Short identifier
- **? Wrong**: Code or description of the bad approach
- **? Correct**: The right way to do it
- **Why**: Why the pattern is harmful
- **Detection**: How to find it in code (grep pattern, linting rule)

**Mandatory anti-patterns to always look for** ? regardless of whether the source doc mentions them explicitly by name. Scan every `architecture` and `coding-guide` document for these patterns and generate the corresponding AP entry if the project uses a layered service architecture:

| Mandatory AP | Signal phrases to scan for | Detection command |
|---|---|---|
| **Business Logic in Controller/Handler** | "controller only extracts", "delegate to service", "no logic in controller", "handler should not contain business logic", "service method receives business parameters" | Search for direct use of domain services, data mappers, or error services inside controller/handler files. Adapt search to the project's source layout and naming conventions. |
| **Missing Error Registration** | "register error", "save error", "double-catch", "catch and rethrow", "error registration service", "error form" | Search for catch blocks in service layer files that do not call the project's error-registration method. Adapt to project's actual method name and source layout. |
| **Exception Class Proliferation** | "use base exception directly", "no custom exception subclasses", "avoid exception hierarchy", "simplicity", validation/review notes criticising custom exception classes | Search for custom exception subclasses extending the project's base exception class. Adapt to the project's actual base exception class name. |

> ?? These three patterns appear in virtually every layered service architecture guide regardless of language or framework. If the ingested docs describe a service layer, a controller/handler, and an error-reporting mechanism, **always** generate all three AP entries. Do not skip them because they are "implicit" in other guardrails ? they must appear as dedicated, searchable entries in `anti-patterns.md` with ?/? code examples adapted to the project's actual language, class names, and method names, plus detection commands adapted to the project's source layout.

**Document structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-knowledge
---

# Anti-Patterns
Level: 1 (Global)
Scope: Governance
Category: Engineering Standards
Purpose: [Describe in 1–2 sentences: what types of forbidden patterns are documented and which ingested sources identified them.]

> Forbidden patterns extracted from documentation. Each entry includes detection and correct alternative.
> Updated by `@discovery-knowledge` as new documentation is analyzed.


## AP-001 ? <Pattern Name>
# Anti-Patterns

**Context**: <when this applies>
**Why forbidden**: <harm caused>

\`\`\`typescript
// Example of the bad pattern
\`\`\`

? **Correct**:
\`\`\`typescript
// Example of the correct pattern
\`\`\`

**Detection**:
\`\`\`bash
grep -rn "<pattern>" src/
\`\`\`

---

## ?? Sources

- `.discovery/knowledge/<file>.md` ? <what this file contributed>
```

### 7. Write `architecture-decisions.md`

**Source**: Documents classified as `decisions`, plus any section in other docs that contains rationale, "we chose X because", "alternatives considered", trade-off discussions.

?? **Idempotency**: Merge mode ? append new ADRs with sequential numbering, never remove existing entries.

Each ADR follows the standard format:
- **Status**: Accepted / Superseded / Deprecated
- **Context**: The situation that led to the decision
- **Decision**: What was decided
- **Consequences**: Positive and negative outcomes
- **Alternatives considered**: What else was evaluated and why it was rejected

**Document structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-knowledge
---

# Architecture Decisions
Level: [Apply Level Determination Rules — default 1 (Global); set 2 (Domain) if all ADRs are domain-scoped; set 3 (Application) only if all ADRs are implementation-level for a single module; if mixed, use the highest level present]
Scope: Governance
Category: Architecture Decisions
Purpose: [Describe in 1–2 sentences: how many ADRs are documented, what decision areas they cover, and which ingested sources contributed them.]

> ADR log — decisions, context, and consequences.
> Updated by `@discovery-knowledge` as new documentation is analyzed.

# Architecture Decisions

## ADR-001 ? <Decision Title>

**Date**: <date if found, otherwise generated_at>

### Context
<situation that led to the decision>

### Decision
<what was decided>

### Consequences

**Positive**:
- <benefit 1>

**Negative / Trade-offs**:
- <risk or cost 1>

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| <option A> | <reason> |

---

## ?? Sources

- `.discovery/knowledge/<file>.md` ? <what this file contributed>
```

### 8. Write `task-spec.md`

**Source**: Any existing task template found in ingested docs. If none found ? generate a project-appropriate template based on extracted project context (tech stack, workflow, acceptance criteria patterns observed in docs).

?? **Idempotency**: If file already exists, only overwrite if `--overwrite` flag is set. Otherwise skip and report.

**Key requirements for ?9 (Test Specification)**:
- ?9.2 Unit Tests MUST include **Error test mandatory verifications** ? at minimum three checks per error branch: (1) assert that an exception is thrown, (2) verify the error-registration call occurred, (3) capture and verify the exact error code. A test that only verifies the error-registration call without asserting the exception is thrown is **incomplete** ? it cannot detect swallowed exceptions.
- ?9.2 mocking: **do NOT mock static utility classes** (classes whose methods are all static and require no injection). Mark them with a comment indicating they are static helpers.
- ?9.6 Application context/bootstrap test is **mandatory** ? verify the application starts correctly with a test profile. Include as the final subsection of ?9.

**Document structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-knowledge
---

# Task Specification Template
Level: 1 (Global)
Scope: Governance
Category: Process & Templates
Purpose: [Describe in 1–2 sentences: that this is the standard delivery task template for this project, pre-filled with project-specific context, and intended for use by @delivery agents.]

> Template for all implementation tasks delivered by `@delivery`.
> Fill in ALL sections before starting implementation.

---

## Task: [TASK-ID] ? <Title>

**Scope**: <feature/area>
**Type**: feature | bug | migration | refactor
**Priority**: high | medium | low

## Description

<1-3 sentences describing what needs to be done and why>

## Acceptance Criteria

- [ ] <criterion 1 ? testable, specific>
- [ ] <criterion 2>
- [ ] All existing tests pass
- [ ] New tests cover the acceptance criteria

## References

- Foundation: `.foundation/`
- Guardrails: `.foundation/guardrails.md`
- Test plan: `.foundation/testing-strategy.md`

## Technical Notes

<optional: implementation hints, known constraints, relevant code paths>

## Out of Scope

<what this task explicitly does NOT cover>

---

## ?9 Test Specification

> Adapt test structure, annotations, and tooling to the project's actual language and test framework.

### 9.1 Fixtures layer

> Create test fixtures before writing tests. One fixture module/class per entity or endpoint.

### 9.2 Unit Tests

**Test setup** (adapt to project's test framework and language):
- Declare mocks for injected dependencies
- Do NOT mock static utility helpers ? call them directly
- Inject the unit under test with its mocked dependencies
- Set any required configuration values for the test context

**Error test mandatory verifications (all three required per error branch):**

1. **Assert the exception is thrown** ? verify it is of the expected type
2. **Assert the error-registration call occurred** ? verify the project's error service received the correct arguments (case/entity identifier, exception, task config)
3. **Assert the exact error code** ? capture the exception argument and verify the error code constant matches the expected value

> ?? A test that only verifies the error-registration call without asserting the exception is thrown is **incomplete** ? it cannot detect if the exception is swallowed. All three checks are always required.

### 9.3 Integration Tests

### 9.4 Controller / Handler Tests

### 9.5 Coverage thresholds

### 9.6 Application Bootstrap Test (mandatory)

Verify the application starts correctly under the test profile. Use the project's test profile configuration (e.g., `application-test.yml`, `.env.test`, test config file) with all component URLs and task properties populated.

```
// Pseudocode ? adapt to project language and framework
bootstrap application with test profile
assert application starts without errors
```
```

---

> 📌 **End of step 8** — The `§9 Test Specification` section and its subsections (`9.1`–`9.6`) above are content *inside the generated `task-spec.md` document*. The steps below (steps 9–12) are separate SKILL instructions for generating the remaining foundation documents.

---

### 9. Write `feature-spec.md`

**Source**: Same sources as `task-spec.md`, plus any doc that describes feature scoping, delivery workflow, or acceptance criteria patterns. Also reads already-generated `.foundation/guardrails.md`, `.foundation/data-model.md`, and `.foundation/service-map.md` when available to inject project-specific examples.

⚠️ **Idempotency**: If file already exists, only overwrite if `--overwrite` flag is set. Otherwise skip and report.

**Purpose**: Produce a project-adapted feature specification template. Pre-fill sections with project-specific context extracted from ingested docs:
- **§3 Guardrails** — top 3–5 enforceable rules from `.foundation/guardrails.md`
- **§4 Acceptance Scenarios** — 2 concrete examples using real domain entity names
- **§5 Domain and Data** — core entities from `.foundation/data-model.md`
- **§6 Service Ownership** — services from `.foundation/service-map.md`
- **§9 Test Expectations** — test types required by the project's stack
- **§12 References** — actual `.foundation/` paths used in this project

Use `<placeholder>` for any section where source material is not available.

Follow the structure defined in `.github/templates/foundational_context/feature-spec.md`.

---

### 10. Write `coding-conventions.md` *(conditional)*

**Condition**: Only generate if at least one ingested document is classified as `coding-guide` (contains "coding guide", "naming convention", "code style", "best practice", "pattern", "example", "anti-pattern", "formatting", "structure").

**Source**: Documents classified as `coding-guide`, and any section in other docs that explicitly describes naming rules, file structure, code style, or formatting standards.

⚠️ **Idempotency**: Merge mode — append new conventions as new sections, never remove existing entries.

Extract:
- **Naming conventions**: Classes, methods, variables, files, packages/modules
- **File and package structure**: How code is organized into directories and modules
- **Code style rules**: Indentation, line length, imports ordering, blank lines
- **Patterns to follow**: Approved design patterns for the project (e.g., Repository, Factory, Strategy)
- **Anti-patterns to avoid**: Bad style practices explicitly called out in docs
- **Language/framework specifics**: Idiomatic rules for the project's language and framework

**Document structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-knowledge
---

# Coding Conventions
Level: [Apply Level Determination Rules — default 1 (Global) for org-wide style guides; set 3 (Application) if conventions are extracted from a specific project's codebase]
Scope: Governance
Category: Engineering Standards
Purpose: [Describe in 1–2 sentences: which language/framework conventions are documented, which ingested sources contributed them, and who must follow them.]

> Naming, structure, and style conventions for this project.
> Updated by `@discovery-knowledge` as new documentation is analyzed.

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Class | <rule> | `OrderService`, `UserMapper` |
| Method / Function | <rule> | `processOrder()`, `findById()` |
| Variable | <rule> | `orderCount`, `userId` |
| Constant | <rule> | `MAX_RETRY_COUNT`, `ERROR_CODE_PREFIX` |
| File | <rule> | `order-service.ts`, `UserMapper.java` |
| Package / Module | <rule> | `com.project.order`, `src/orders/` |

## File and Package Structure

```
<project-root>/
  src/
    <module>/
      <layer>/     ← describe expected layers (e.g., controller, service, repository)
```

<Describe conventions for where each type of class/file lives>

## Code Style

| Rule | Value |
|---|---|
| Indentation | <spaces/tabs and count> |
| Max line length | <N characters> |
| Import ordering | <convention> |
| Blank lines between methods | <convention> |

## Approved Patterns

| Pattern | When to use | Notes |
|---|---|---|
| <pattern name> | <context> | <notes> |

## Style Anti-Patterns

| Anti-pattern | Why avoid | Correct alternative |
|---|---|---|
| <bad practice> | <reason> | <correct approach> |

## Language / Framework Specifics

- <idiomatic rule 1 specific to the project's language/framework>
- <idiomatic rule 2>

## Contribution Entry

New conventions extracted from the latest documentation batch:
- <specific convention>

## 📎 Sources

- `.discovery/knowledge/<file>.md` → <what this file contributed>
```

---

### 11. Write `testing-strategy.md` *(conditional)*

**Condition**: Only generate if at least one ingested document is classified as containing testing content (contains "test", "unit test", "integration test", "coverage", "mock", "fixture", "TDD", "BDD", "quality", "assertion", "test plan").

**Source**: Documents classified as `coding-guide` or `architecture` with testing content, and any section describing test strategy, quality levels, test conventions, or acceptance criteria patterns.

⚠️ **Idempotency**: Merge mode — append new testing rules as new sections, never remove existing entries.

Extract:
- **Test strategy overview**: Philosophy (TDD, BDD, test pyramid, etc.)
- **Test levels**: Unit, integration, E2E — what each covers and when to use each
- **Coverage requirements**: Minimum thresholds per level
- **Mocking conventions**: What to mock, what not to mock (e.g., never mock static helpers)
- **Fixture conventions**: How to create and organize test data
- **Test naming conventions**: How to name test classes, methods, and files
- **Tooling**: Test frameworks, assertion libraries, mocking libraries in use
- **Quality gates**: CI requirements, when tests must pass to unblock delivery

**Document structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-knowledge
---

# Testing Strategy
Level: [Apply Level Determination Rules — default 1 (Global) for project-wide test standards; set 3 (Application) if the strategy is specific to a single module or application]
Scope: Governance
Category: Testing & Quality
Purpose: [Describe in 1–2 sentences: what test levels and quality gates are documented, which ingested sources contributed them, and who enforces them.]

> Test strategy, quality levels, and conventions for this project.
> Updated by `@discovery-knowledge` as new documentation is analyzed.

## Philosophy

<TDD / BDD / test-pyramid / other — extracted from docs>

## Test Levels

| Level | Scope | Tooling | Coverage target |
|---|---|---|---|
| Unit | <what it covers> | <framework> | <N%> |
| Integration | <what it covers> | <framework> | <N%> |
| E2E / Acceptance | <what it covers> | <framework> | <N%> |

## Coverage Requirements

| Level | Minimum threshold | Enforced by |
|---|---|---|
| Unit | ≥ <N>% | <CI gate / tool> |
| Integration | ≥ <N>% | <CI gate / tool> |
| Overall | ≥ <N>% | <CI gate / tool> |

## Mocking Conventions

- **Mock**: Injected dependencies (services, repositories, clients)
- **Do NOT mock**: Static utility helpers — call them directly
- <additional project-specific mocking rules>

## Fixture Conventions

- One fixture module/class per entity or endpoint
- <where fixtures live in the project structure>
- <how to name fixture files and classes>

## Test Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Test class | <rule> | `OrderServiceTest`, `UserControllerTest` |
| Test method | <rule> | `should_throwError_when_orderNotFound()` |
| Test file | <rule> | `order-service.spec.ts`, `OrderServiceTest.java` |

## Error Branch Test Requirements

Every error branch MUST verify all three of the following:

1. **Exception is thrown** — assert it is of the expected type
2. **Error-registration call occurred** — verify the project's error service received the correct arguments
3. **Exact error code** — capture the exception argument and verify the error code constant matches

> ⚠️ A test that only verifies the error-registration call without asserting the exception is thrown is **incomplete** — it cannot detect swallowed exceptions.

## Tooling

| Role | Tool / Library | Notes |
|---|---|---|
| Test runner | <tool> | <version or notes> |
| Assertion library | <tool> | <usage notes> |
| Mocking library | <tool> | <usage notes> |
| Coverage reporter | <tool> | <usage notes> |

## Quality Gates

| Gate | Requirement | Blocks |
|---|---|---|
| All unit tests pass | 100% | PR merge |
| Coverage threshold met | ≥ <N>% | PR merge |
| <gate> | <requirement> | <what it blocks> |

## Contribution Entry

New testing conventions extracted from the latest documentation batch:
- <specific rule>

## 📎 Sources

- `.discovery/knowledge/<file>.md` → <what this file contributed>
```

---

### 12. Write `framework-api-registry.md` *(conditional)*

**Condition**: Only generate if at least one ingested document describes framework APIs, library usage, SDK references, or correct method signatures (contains "API", "method signature", "usage", "parameter", "return type", "endpoint", "library", "SDK", "framework API", "how to use", "example call").

**Source**: Documents that explicitly document how to use the project's framework or libraries — API references, integration guides, SDK docs, or code examples demonstrating correct usage.

⚠️ **Idempotency**: Merge mode — append new API entries, never remove existing ones.

Extract:
- **Correct method/function signatures**: Name, parameters, return types
- **Usage notes**: When to use, when NOT to use, common mistakes
- **Code examples**: Correct call patterns, including error-handling wrappers
- **Deprecated APIs**: Methods or patterns that are no longer valid and their replacements
- **Version constraints**: API differences between versions that affect the project

**Document structure**:

```markdown
---
version: "1.0"
generated_at: <ISO timestamp>
source: discovery-knowledge
---

# Framework / API Registry
Level: [Apply Level Determination Rules — default 1 (Global) for shared platform/framework docs; set 3 (Application) if the registry is specific to a single module's dependencies]
Scope: Tactical
Category: Technical Architecture
Purpose: [Describe in 1–2 sentences: which frameworks/libraries are documented, which ingested sources contributed them, and the primary use case (e.g., preventing incorrect API usage during code generation).]

> Correct API signatures, usage notes, and code examples for the project's frameworks and libraries.
> Updated by `@discovery-knowledge` as new documentation is analyzed.

## <Framework / Library Name> (vX.Y)

### `<ClassName>.<methodName>(<params>): <ReturnType>`

**Purpose**: <what this method does>

**Parameters**:

| Parameter | Type | Required | Description |
|---|---|---|---|
| <name> | <type> | yes/no | <description> |

**Returns**: <return type and meaning>

**✅ Correct usage**:
```<language>
// Correct example
```

**❌ Common mistake**:
```<language>
// Wrong usage and why it fails
```

**Notes**:
- <usage constraint or gotcha>
- <version-specific note if applicable>

---

### `<ClassName>.<anotherMethod>(<params>): <ReturnType>`

<repeat structure for each registered API>

---

## Deprecated APIs

| Deprecated | Replaced by | Since version | Notes |
|---|---|---|---|
| `<old method>` | `<new method>` | <version> | <migration note> |

## 📎 Sources

- `.discovery/knowledge/<file>.md` → <what this file contributed>
```

---

## After Each Document

After writing each document:
1. Confirm the file exists: `ls .foundation/` or `ls .foundation/`
2. Report: "? Written: `.foundation/project-intent.md` (N lines)"

---

## Final Report

```
? Foundation documents written from ingested docs


  ? project-intent.md           (N lines)
  ? domain-landscape.md         (N lines)
  ? guardrails.md               (merged ? N lines total)
  ? anti-patterns.md            (merged ? N lines total)
  ? architecture-decisions.md   (merged ? N lines total)
  ? task-spec.md       (N lines)
  ? feature-spec.md    (N lines)
  ?? coding-conventions.md      (skipped ? no coding guide ingested)
  ? testing-strategy.md         (merged ? N lines total)
  ?? framework-api-registry.md  (skipped ? no framework API docs ingested)

  8 documents written, 2 skipped. Foundation ready for @delivery.
```

---

## Guardrails

- **Every claim must trace to an ingested document** ? if a piece of information cannot be found in `.discovery/knowledge/`, write `?? Not found in ingested docs ? requires manual input`
- **Conflicting information across documents**: flag the conflict explicitly with `?? Conflict: doc-A says X, doc-B says Y ? manual resolution needed`
- **Architecture docs are project-shared** ? always use merge mode for `guardrails.md`, `anti-patterns.md`, `architecture-decisions.md`; never destructively overwrite
- **Confidence annotation**: If a document is a presentation or informal notes (low reliability), annotate the section with `?? Source: informal ? validate with team`
- **Versioned frontmatter** is mandatory on every document
- **`?? Sources` section is mandatory** ? list every `.discovery/knowledge/` file that contributed to each foundation doc

