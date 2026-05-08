---
version: "1.2"
created: 2026-03-30
last-updated: 2026-04-23
---

# Multi-Module Convention

All `.discovery/code/` and `.discovery/runtime/` artifacts are namespaced by module slug to prevent collisions across modules.

## Module Slug

Use a stable slug derived from URL path or source root (example: `cgt-marcas`).

## Directory Layout

```text
.discovery/code/
  registry.json
  tools/
  scans/<module-slug>/
  symbols/<module-slug>/
  graph/<module-slug>/
  modules/<module-slug>/

.discovery/runtime/
  registry.json
  state.json
  ingested/
  tools/
  observations/<module-slug>/
  flows/<module-slug>/
  testplans/<module-slug>/
  crossref/<module-slug>/
```

## Registry Files

Both `.discovery/code/registry.json` and `.discovery/runtime/registry.json` index available modules and paths.

Always read registry first before consuming per-module artifacts.

## Rules for Skills and Agents

### Producing data

1. Resolve module slug from user input, URL, or source path.
2. Create and write under `{type}/{slug}/`.
3. Update the corresponding `registry.json` entry.

### Consuming data

1. Read `registry.json` first.
2. Resolve paths using `{type}/{slug}/`.
3. If one module exists, use it implicitly.
4. If multiple modules exist, ask user to choose slug.

### Global artifacts (not namespaced)

- `.discovery/knowledge/`
- `.discovery/knowledge/state.json`
- `.discovery/code/tools/`, `.discovery/knowledge/tools/`
- `.foundation/`

## Foundation Output Layout

Foundation docs use a flat shared contract. Canonical names match `.github/templates/foundational_context/`.

```text
.foundation/
  project-intent.md          ← vision, goals, business context, scope
  domain-landscape.md        ← bounded contexts, glossary, relationships
  guardrails.md              ← principles, endpoint conventions, safety patterns
  anti-patterns.md           ← forbidden patterns with ❌/✅ examples
  coding-conventions.md      ← naming, code style, and structural conventions
  testing-strategy.md        ← test strategy, quality levels, and validation approach
  architecture-decisions.md  ← ADR-like decisions and trade-offs
  task-spec.md               ← spec template with authoring rules R-1..R-16
  framework-api-registry.md  ← correct API signatures and usage notes
  data-model.md              ← entities, relationships, schemas from code
  service-map.md             ← services, capabilities, dependencies from code
  api-contracts.md           ← endpoints, contracts, integrations from code
  user-journey-ui.md         ← observed flows, screens, user interactions
  feature-spec.md            ← feature specification template for delivery
```

Update behavior:

- Synthesize skills update shared docs in merge mode.
- Architecture and development guidance docs have higher priority for delivery decisions.
- Functional context docs provide product and navigation understanding.
- Traceability and synthesis docs remain optional and merge-friendly.
