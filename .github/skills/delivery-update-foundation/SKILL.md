---
name: update-foundation
description: Shared skill for updating foundation documents when stable knowledge is discovered. Used by @delivery (during implementation) and any discovery agent (for targeted refinements). Proposes changes to user before applying.
license: Apache-2.0
compatibility: Requires foundation documents in .foundation/
metadata:
  author: shared
  version: "1.2"
---

# Update Foundation Documents

This skill updates foundation documents inline when stable knowledge emerges during delivery or discovery refinement.

## When to Use

Use this skill when you discover a stable, reusable rule or decision that should be reflected in `.foundation/`.

Do not use this for large rewrites. Large structural updates should be handled by the relevant discovery agent and its synthesize workflow.

## Foundation Directory Contract

Foundation documents live in a flat shared layout:

```text
.foundation/
├── guardrails.md
├── anti-patterns.md
├── coding-conventions.md
├── testing-strategy.md
├── architecture-decisions.md
├── task-spec.md
├── framework-api-registry.md
├── project-intent.md
├── domain-landscape.md
├── data-model.md
├── service-map.md
├── api-contracts.md
├── user-journey-ui.md
└── crossref-summary.md
```

Priority guidance:
- `guardrails.md` to `framework-api-registry.md`: architecture and development guidance (higher importance)
- `project-intent.md` to `user-journey-ui.md`: application and functional context
- `crossref-summary.md`: optional, stable traceability summary

If `.foundation/` does not exist or is empty, ask the user to run discovery synthesize first.

## Steps

### 1. Identify the Stable Finding

From current implementation, tests, and validation, identify stable knowledge and classify it:

| Finding type | Target document | Section to update |
|---|---|---|
| New architectural pattern or constraint | `guardrails.md` | Add guardrail rule |
| Forbidden pattern discovered | `anti-patterns.md` | Add entry with wrong/correct examples |
| Framework API correction | `framework-api-registry.md` | Fix signature/usage |
| New coding convention | `coding-conventions.md` | Add convention |
| New test strategy pattern | `testing-strategy.md` | Add strategy/tool guidance |
| Architecture decision | `architecture-decisions.md` | Add ADR entry |
| New or revised task specification | `task-spec.md` | Add/update task definition or acceptance criteria |
| New project goal, scope, or intent | `project-intent.md` | Add/refine intent, goals, or non-goals |
| New domain concept, bounded context, or glossary term | `domain-landscape.md` | Add/update domain entry or context boundary |
| New entity or invariant | `data-model.md` | Add/update model rule |
| New service capability | `service-map.md` | Add/update responsibility |
| New API endpoint or contract rule | `api-contracts.md` | Add/update contract |
| New business flow insight | `user-journey-ui.md` | Add/refine journey summary |
| Durable traceability insight | `crossref-summary.md` | Add stable crossref summary |

### 2. Read Current Document

Read the target document first. Integrate changes in context instead of blind append.

### 3. Propose the Change to the User

Always ask for confirmation before editing:

```text
Foundation Update Proposed

Document: guardrails.md
Section: Error Handling

Current:
> Existing rule text...

Proposed:
> New stable rule...

Reason: discovered during <feature/change>

Apply this change? (yes/no/edit)
```

### 4. Apply the Approved Edit

- Add or refine content in the target section
- Preserve existing content
- If frontmatter exists:
  - bump patch version
  - update `last-updated`
  - append a short changelog note

### 5. Update Sources

Ensure `Sources` (or `📎 Sources`) includes the delivery/discovery evidence used.

### 6. Confirm to User

Report what changed:

```text
Foundation updated: guardrails.md (v1.0 -> v1.1)
Added: circuit-breaker guardrail
Source: delivery change <id>
```

## Guardrails

- Never delete stable content unless user explicitly requests removal
- Never edit without user confirmation
- Keep edits focused: one finding, one targeted update
- Respect existing style and structure in each document
- Only modify files inside `.foundation/`
