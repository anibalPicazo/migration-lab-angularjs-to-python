---
name: discovery-code-impact-analysis
description: Analyzes the impact of changing a symbol by walking the relationship graph with configurable depth. Produces a risk-assessed impact report.
license: Apache-2.0
compatibility: Requires .discovery/code/graph/edges.json and .discovery/code/symbols/index.json.
metadata:
  author: discovery-code
  version: "1.0"
---

# Codebase — Impact Analysis

Analyze the **blast radius** of changing a symbol. Walks the relationship graph using BFS with configurable depth to find all directly and transitively affected symbols.

## Prerequisites

- `.discovery/code/graph/edges.json` must exist
- `.discovery/code/symbols/index.json` must exist

## Input

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `symbol` | yes | — | Symbol ID, qualified name, or file path |
| `depth` | no | `3` | Max traversal depth (1 = direct only, 2 = direct + indirect, etc.) |

If the user says just `@discovery-code impact UserService`, use depth 3.
If the user says `@discovery-code impact UserService depth 1`, use depth 1.
If the user says `@discovery-code impact UserService --deep`, use depth 10 (full transitive).

## Steps

### 1. Resolve the target symbol

Read `.discovery/code/symbols/index.json` and find the symbol:

- If input is a file path → find all symbols declared in that file
- If input is a qualified name → exact match
- If input is a simple name → match by `name` field; if ambiguous, list matches and ask user

If the symbol is not found, try partial match (same logic as `find-usages`) and warn.

### 2. Load graph

```bash
cat .discovery/code/graph/edges.json
```

### 3. BFS traversal with depth control

Starting from the target symbol(s), perform **breadth-first search** on incoming edges:

```
depth 0: target symbol
depth 1: all symbols with an edge pointing TO the target (direct dependents)
depth 2: all symbols with an edge pointing TO any depth-1 symbol
...
depth N: stop at configured max depth
```

**Edge types to follow** (incoming direction):

| Edge type | Priority | Description |
|-----------|----------|-------------|
| `CALLS` | critical | Functions that call the target |
| `IMPORTS` | high | Files that import the target |
| `INHERITS` | critical | Classes that extend the target |
| `IMPLEMENTS` | critical | Classes that implement the target |
| `OVERRIDES` | high | Methods that override the target |
| `USES_TYPE` | medium | Code that references the type |

**Cycle detection**: Track visited nodes. If a node is already visited, skip it (don't loop).

### 4. Classify affected symbols

For each affected symbol, classify:

- **Callers**: connected via `CALLS` edges
- **Importers**: connected via `IMPORTS` edges
- **Inheritors**: connected via `INHERITS` / `IMPLEMENTS` edges
- **Type users**: connected via `USES_TYPE` edges
- **Tests**: any affected symbol in a test file (`*.spec.*`, `*.test.*`, `*_test.*`)

### 5. Assess risk

Calculate risk based on:

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Direct callers | 3 per caller | depth-1 CALLS edges |
| Routes / entry points | 5 per route | depth-1+ symbols marked as `entry_point` in scan manifest |
| Inheritors | 4 per class | depth-1 INHERITS/IMPLEMENTS edges |
| Test coverage | -2 per test | negative = reduces risk |
| Depth of impact | 1 per level touched | number of BFS levels with results |

| Score | Risk level |
|-------|------------|
| 0–5 | LOW |
| 6–15 | MEDIUM |
| 16–30 | HIGH |
| 31+ | CRITICAL |

### 6. Generate report

Write `.discovery/code/reports/impact-<symbol_name>.md`:

```markdown
# Impact Analysis: UserService.getUser

**Risk: MEDIUM** (score: 12)
**Depth analyzed**: 3 (of 3 requested)
**Generated**: <ISO timestamp>

## Depth 1 — Direct dependents (5 symbols)

### Callers (3)
| Symbol | File | Line | Confidence |
|--------|------|------|------------|
| ProfileController.loadProfile | src/controllers/profile.ts | 45 | high |
| AdminService.getUserDetails | src/services/admin.ts | 22 | high |
| AuthMiddleware.validateUser | src/middleware/auth.ts | 31 | medium |

### Importers (2)
| File | Line |
|------|------|
| src/controllers/profile.ts | 1 |
| src/services/admin.ts | 3 |

## Depth 2 — Indirect dependents (2 symbols)

### Callers (1)
| Symbol | File | Line | Via |
|--------|------|------|-----|
| ProfileRoute.GET /profile | src/routes/profile.ts | 8 | → ProfileController.loadProfile |

### Importers (1)
| File | Line | Via |
|------|------|-----|
| src/routes/profile.ts | 2 | → ProfileController |

## Depth 3 — (0 new symbols)

No additional impact at this depth.

## Tests affected (3)

| Test file | Test count | Depth |
|-----------|-----------|-------|
| src/services/user.service.spec.ts | 3 | 1 |
| src/controllers/profile.spec.ts | 2 | 2 |

## Risk breakdown

| Factor | Count | Weight | Score |
|--------|-------|--------|-------|
| Direct callers | 3 | ×3 | 9 |
| Routes/entry points | 1 | ×5 | 5 |
| Inheritors | 0 | ×4 | 0 |
| Tests (reduces risk) | 5 | ×(-2) | -10 |
| Depth levels touched | 2 | ×1 | 2 |
| **Total** | | | **6 → MEDIUM** |

## Recommendations

- ✅ Good test coverage (5 tests cover the impact chain)
- ⚠️ 1 route endpoint affected — verify API contract
- ℹ️ Impact contained within 2 depth levels
```

### 7. Print summary

```
📊 Impact Analysis: UserService.getUser

Risk: MEDIUM (score: 12)
├── Depth 1: 5 symbols (3 callers, 2 importers)
├── Depth 2: 2 symbols (1 caller, 1 importer)
├── Depth 3: 0 new symbols
├── Tests: 5 tests across 2 files
└── Entry points: 1 route (GET /profile)

Report saved: .discovery/code/reports/impact-getUser.md

💡 Tip: Use `@discovery-code impact UserService.getUser depth 1` for direct-only analysis
         Use `@discovery-code impact UserService.getUser --deep` for full transitive analysis
```

### 8. Update state

Update `.discovery/code/state.json`:
```json
{
  "reports": {
    "last_impact": {
      "symbol": "UserService.getUser",
      "risk": "MEDIUM",
      "generated_at": "<ISO timestamp>"
    }
  }
}
```

## Guardrails

- **Depth is mandatory** — always respect the configured depth, never go beyond it
- **Default depth is 3** — balanced between detail and noise
- **Cycle protection** — track visited nodes, never traverse the same node twice
- **DO NOT fabricate impact** — only report edges that exist in `edges.json`
- **Always save report** — every impact analysis writes to `.discovery/code/reports/`
- **Cap output** — if a single depth level has >100 affected symbols, summarize (show top 20 + count) and note "use depth 1 for focused analysis"
- **File-level fallback** — if symbol not found but file path given, analyze all symbols in that file as a group
- **Partial match warning** — if symbol resolved via partial match, warn clearly before proceeding
