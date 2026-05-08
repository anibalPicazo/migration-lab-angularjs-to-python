
---
version: "1.0"
status: active
owner: TBD
created: YYYY-MM-DD
last-updated: YYYY-MM-DD
adopted-from:
  - <path to framework guide or team coding standards doc>
changelog:
  - version: "1.0"
    date: YYYY-MM-DD
    change: Generated during discovery phase from codebase and documentation
---

# 03 — Coding Conventions

> This document defines the canonical naming, structural, and style conventions for the project.  
> Coding agents MUST read this before generating or modifying any source code.

---

## Guidance

- Conventions here are **normative** — they override any default framework conventions that conflict.
- Add entries under `## Observed Conventions` when stable patterns are discovered in the codebase.
- Mark entries as `⚠️ Under review` when the pattern is inconsistent in the existing code.
- Remove the Guidance blocks when the document is populated with real project conventions.

---

## Naming Conventions

### Files & Directories

Guidance: Describe the file naming pattern for each artifact type (components, services, models, tests, etc.).

| Artifact type | Pattern | Example |
|---|---|---|
| Component | `<kebab-case>.component.ts` | `user-profile.component.ts` |
| Service | `<kebab-case>.service.ts` | `auth.service.ts` |
| Model / DTO | `<kebab-case>.model.ts` | `user-profile.model.ts` |
| Test file | `<artifact-name>.spec.ts` | `user-profile.component.spec.ts` |
| [Add rows per project] | | |

### Classes & Interfaces

Guidance: Document casing and suffix rules for all declaration kinds.

| Kind | Convention | Example |
|---|---|---|
| Class | `PascalCase` | `UserProfileService` |
| Interface | `PascalCase` (no `I` prefix) | `UserProfile` |
| Enum | `PascalCase` | `LoadingState` |
| Type alias | `PascalCase` | `ApiResponse` |
| [Add rows per project] | | |

### Variables & Methods

Guidance: Document casing and any mandatory prefix/suffix conventions.

| Kind | Convention | Example |
|---|---|---|
| Method | `camelCase` | `getUserProfile()` |
| Private field | `camelCase` (no underscore) | `userService` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Observable | `camelCase$` suffix | `currentUser$` |
| [Add rows per project] | | |

---

## Structural Conventions

### Module / Feature Organization

Guidance: Document the expected folder structure for a feature module.

```
feature-name/
  feature-name.component.ts
  feature-name.component.html
  feature-name.component.spec.ts
  feature-name.service.ts
  feature-name.model.ts
  feature-name.module.ts    ← only when lazy-loaded
  index.ts                  ← barrel export
```

### Import Order

Guidance: List the canonical import ordering groups (e.g., external, internal, relative).

1. Framework / platform imports (e.g., `@angular/*`)
2. Third-party libraries
3. Internal workspace libraries
4. Feature-relative imports

---

## Style Rules

### Template / HTML

Guidance: Document binding syntax preferences, attribute ordering, and whitespace rules.

- Use `[property]` binding for expressions, not string interpolation inside attributes.
- Use `(event)` binding — never inline `on*` handlers.
- [Add project-specific rules]

### CSS / SCSS

Guidance: Document class naming approach (BEM, utility-first, etc.) and nesting limits.

- Class naming: [e.g., BEM — `.block__element--modifier`]
- Max SCSS nesting depth: [e.g., 3 levels]
- [Add project-specific rules]

---

## Observed Conventions (from codebase)

> **@discovery-code** populates this section from the analysed codebase.  
> **@discovery-knowledge** may add entries from framework guides and style documentation.

*No conventions extracted yet — run discovery pipeline first.*

---

## 📎 Sources

*Populated by discovery agents. List ingested documents and codebase scan artifacts used to derive these conventions.*

