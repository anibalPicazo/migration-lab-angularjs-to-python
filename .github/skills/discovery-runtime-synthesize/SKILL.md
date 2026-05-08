---
name: discovery-runtime-synthesize
description: Stage 2 of the navigation analysis lifecycle. Reads behavioral artifacts (flows, functional-map, testplan, crossref) and writes consolidated foundation documents into .foundation/. Run after the full behavioral pipeline completes successfully.
license: Apache-2.0
compatibility: Requires .requirement/<slug>/functional-map/functional-map.md and at least one flow-*.json file.
metadata:
  author: discovery-runtime
  version: "1.0"
---

# Navigation - Write Foundation Documents

Synthesize behavioral pipeline artifacts into consolidated foundation documents written directly to .foundation/. This skill is the final stage of the navigation lifecycle.

## When to Invoke

- After @discovery-runtime full <url> (or individual stage commands) completes successfully
- When re-generating foundation docs after new flows are explored
- When a module slug is being onboarded and a running app is available

## Prerequisites

| Artifact | Path | Produced by | Required? |
|---|---|---|---|
| Functional map | .requirement/<slug>/functional-map/functional-map.md | discovery-runtime-extract-functionality | Required |
| Flow recordings | .requirement/<slug>/flows/flow-*.json | discovery-runtime-explore-flows | Required |
| Test plan | .requirement/<slug>/testplans/testplan-*.md | discovery-runtime-generate-testplan | Recommended |
| Cross-ref report | .requirement/<slug>/crossref/crossref-report.md | discovery-runtime-crossref-code | Recommended |
| Sitemap | .discovery/runtime/observations/<slug>/sitemap.json | discovery-runtime-observe-app | Optional |

Gate: if neither .requirement/<slug>/functional-map/functional-map.md nor any flow-*.json exist, report:
"Behavioral analysis artifacts missing. Run @discovery-runtime full <url> or at minimum @discovery-runtime observe + @discovery-runtime explore + @discovery-runtime extract first."

## Inputs

| Parameter | Required | Description |
|---|---|---|
| --slug <slug> | yes | Module identifier (example: cgt-marcas) |
| --overwrite | no | Overwrite existing foundation docs (default: ask if file exists) |

## Outputs

| Document | Path | Data source |
|---|---|---|
| User Journeys | .foundation/user-journey-ui.md | functional-map + flow recordings |
| Testing Strategy | .foundation/testing-strategy.md | latest testplan + crossref patterns |

## Foundation Document Classification

Every foundation document written by this skill MUST include a classification header immediately after the `# Title` heading (before the first section or blockquote). This header encodes the document's governance level, scope, and purpose for use by downstream agents and delivery workflows.

### Level Determination Rules

Documents produced by this skill are always generated from a running application identified by `--slug`. Both documents are therefore always **Level 3 (Application)**.

| Document | Level | Scope | Category |
|---|---|---|---|
| `user-journey-ui.md` | 3 (Application) | Tactical | UX & Flows |
| `testing-strategy.md` | 3 (Application) | Tactical | Testing & Quality |

> **Purpose field**: Write 1–2 sentences describing the specific content of this document instance. Include the module slug, what flows/screens were observed, and for whom the document is primarily useful. Example: *"User journeys observed in module `cgt-marcas` covering the full mark creation and category assignment flow. Primary behavioral baseline for feature parity validation."*

### Header Format

Insert this block immediately after the `# Title` heading:

```markdown
Level: 3 (Application)
Scope: <Tactical>
Category: <UX & Flows | Testing & Quality>
Purpose: [1–2 sentences describing what this document covers, which module, and who consumes it.]
```

## Steps

### 1. Load behavioral artifacts

```bash
cat .requirement/<slug>/functional-map/functional-map.md
cat .requirement/<slug>/functional-map/functional-map.json 2>/dev/null
ls .requirement/<slug>/flows/flow-*.json
ls -t .requirement/<slug>/testplans/testplan-*.md | head -1
cat .requirement/<slug>/crossref/crossref-report.md 2>/dev/null
cat .discovery/runtime/observations/<slug>/sitemap.json 2>/dev/null
```

### 2. Ensure output directory exists

```bash
mkdir -p .foundation
```

### 3. Write .foundation/user-journey-ui.md

Source files:
- .requirement/<slug>/functional-map/functional-map.md
- .requirement/<slug>/functional-map/functional-map.json (optional)
- .requirement/<slug>/flows/flow-*.json

Required sections (in order):
- Classification header (Level / Scope / Category / Purpose) — immediately after `# User Journeys — <slug>`
- Functional domains and capabilities
- Inputs and outputs per capability
- Business rules catalog
- Navigation structure
- Confidence notes (observed vs synthetic)
- Sources

### 4. Write .foundation/testing-strategy.md

Source files:
- Latest .requirement/<slug>/testplans/testplan-*.md
- .requirement/<slug>/crossref/crossref-report.md (if present)

Required sections (in order):
- Classification header (Level / Scope / Category / Purpose) — immediately after `# Testing Strategy — <slug>`
- Risk-prioritized summary (P1/P2/P3)
- Test case structure and traceability
- Coverage gaps and priorities
- Sources

### 5. Merge behavior for shared docs

If shared docs already exist, merge instead of replacing:
- .foundation/testing-strategy.md

### 6. Validate output

After writing each file:
- Confirm file exists
- Provide a short status line with filename and line count

Final report must include:
- slug processed
- files written/updated
- any synthetic evidence warnings

## Required quality rules

- Do not invent test cases. Every case must trace to observed behavior or documented scenario.
- If data is missing, keep the document and mark missing parts explicitly.
- Include a Sources section in every generated document.
- Preserve existing stable content in shared foundation docs (merge mode).
- Keep frontmatter versioned.

## Multi-module convention

Artifacts are namespaced by module slug:

- .discovery/runtime/observations/<slug>/
- .requirement/<slug>/flows/
- .requirement/<slug>/testplans/
- .requirement/<slug>/crossref/

Use registry files when multiple slugs exist:
- .discovery/runtime/registry.json
- .discovery/code/registry.json

If more than one slug exists and user did not provide one, ask for it.
