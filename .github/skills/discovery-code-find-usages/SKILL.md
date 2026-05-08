---
name: discovery-code-find-usages
description: Finds all usages of a symbol or pattern across the indexed codebase. Searches the graph first, falls back to grep, and supports exact + partial name matching.
license: Apache-2.0
compatibility: Requires .discovery/code/graph/edges.json (run build-graph first).
metadata:
  author: discovery-code
  version: "1.0"
---

# Codebase — Find Usages

Find **all usages** of a symbol or pattern across the codebase. Uses the graph as primary source and grep as complement.

## Prerequisites

- `.discovery/code/graph/edges.json` must exist (run `@discovery-code index` first)
- `.discovery/code/symbols/index.json` must exist

## Input

The user provides a **query** — one of:

| Format | Example | Match type |
|--------|---------|------------|
| Fully qualified ID | `UserService.getUser` | Exact |
| Class name | `UserService` | Exact |
| Simple name | `getUser` | Exact on symbol name |
| Glob pattern | `*.controller.*` | Glob match on qualified ID |
| Partial / substring | `user` | Fallback — partial match |

## Steps

### 1. Parse the query

Determine the match strategy:

- Contains `*` or `?` → **glob** mode
- Contains `::` or `.` with uppercase segments → **exact qualified** mode
- Single word, starts uppercase → **exact class** mode
- Single word, starts lowercase → **exact name** mode, with **partial fallback**

### 2. Search symbols index

Read `.discovery/code/symbols/index.json` and find matching symbols:

```bash
cat .discovery/code/symbols/index.json
```

**Exact match**: `symbol.qualified_name === query` or `symbol.name === query`

**Partial fallback** (if exact returns 0 results):
- Case-insensitive substring match: `symbol.name.toLowerCase().includes(query.toLowerCase())`
- If still no results, try regex: the query as a partial pattern against all qualified names

If partial fallback activates, **warn the user**:
```
⚠️ No exact match for "user". Showing partial matches (12 results).
   Use a more specific query to narrow down.
```

If multiple exact matches exist (e.g., `getUser` in multiple classes), list all — do not auto-select.

### 3. Search graph edges

For each matched symbol, search `.discovery/code/graph/edges.json`:

```bash
cat .discovery/code/graph/edges.json
```

Find all edges where:
- `target` matches the symbol (incoming edges = "who uses this symbol")
- `source` matches the symbol (outgoing edges = "what does this symbol use")

Group incoming edges by type:
- **Direct calls**: edges with `type: "CALLS"`
- **Imports**: edges with `type: "IMPORTS"`
- **Type usages**: edges with `type: "USES_TYPE"`
- **Inheritance**: edges with `type: "INHERITS"` or `type: "IMPLEMENTS"`
- **Overrides**: edges with `type: "OVERRIDES"`
- **Test references**: edges where source file matches `*.spec.*`, `*.test.*`, `*_test.*`

### 4. Complement with grep

Search the codebase for references NOT captured in the graph:

```bash
grep -rn "<symbol_name>" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.cs" --include="*.kt" --include="*.go" \
  --exclude-dir=node_modules --exclude-dir=.discovery --exclude-dir=dist --exclude-dir=build .
```

For each grep hit:
- Check if it's already covered by a graph edge (same file + line)
- If NOT in graph → add as `source: "grep"` with `confidence: "low"`

### 5. Build context for each usage

For every usage found, extract context:

```bash
sed -n '<line-2>,<line+2>p' <file>
```

This gives 5 lines of context (2 before, target line, 2 after).

### 6. Output report

Print a structured report:

```
🔍 Usages of UserService.getUser

Found 8 usages (6 from graph, 2 from grep)

📥 Direct calls (3)
  1. ProfileController.loadProfile     src/controllers/profile.ts:45    confidence: high
     │ 43: async loadProfile(req, res) {
     │ 44:   const userId = req.params.id;
     │ 45:   const user = await this.userService.getUser(userId);
     │ 46:   res.json(user);
     │ 47: }

  2. AdminService.getUserDetails        src/services/admin.ts:22         confidence: high
  3. AuthMiddleware.validateUser         src/middleware/auth.ts:31        confidence: medium

📦 Imports (2)
  4. src/controllers/profile.ts:1       import { UserService } from "../services/user.service"
  5. src/services/admin.ts:3            import { UserService } from "./user.service"

🧬 Type usages (1)
  6. src/types/index.ts:15              userService: UserService

🧪 Test references (1)
  7. src/services/user.service.spec.ts:8   describe("getUser", ...)

🔎 Grep-only (not in graph) (1)
  8. src/legacy/old-handler.ts:44       // TODO: migrate to userService.getUser    confidence: low

Summary: 3 direct calls, 2 imports, 1 type usage, 1 test, 1 unresolved grep hit
```

### 7. Save report (optional)

If the user requests it, save to `.discovery/code/reports/`:

```bash
mkdir -p .discovery/code/reports
```

Write `.discovery/code/reports/usages-<symbol>.md` with the report content.

## Guardrails

- **Exact first, partial second** — always try exact match before falling back to partial. Clearly label partial results.
- **DO NOT auto-select** — if the query matches multiple symbols, list all and ask the user to clarify
- **Context is mandatory** — every usage must include file, line, and at least 3 lines of surrounding code
- **Grep is complement, not primary** — graph edges have priority; grep fills gaps
- **Cap partial results** — if partial match returns >50 results, show top 20 and ask the user to refine
- **Respect .gitignore** — skip `node_modules/`, `dist/`, `build/`, `.discovery/code/`, `.discovery/runtime/` in grep
