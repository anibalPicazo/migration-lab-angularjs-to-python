---
name: discovery-code-parse-file
description: Parses a single source file using the hybrid strategy — Tree-sitter (core), pluggable resolvers (enrichment), LLM (fallback/enrichment), and heuristics (last resort). Produces a symbol JSON per file.
license: Apache-2.0
compatibility: Tree-sitter requires Node.js. Resolvers install their tools on demand.
metadata:
  author: discovery-code
  version: "1.0"
---

# Codebase — Parse File

Extract symbols from **one source file** using a layered parsing strategy. Tree-sitter is the core; resolvers enrich; LLM fills gaps.

## Input

- **file_path**: Path to the source file to parse
- **language** (optional): Override language detection
- **scan_manifest** (optional): Reference to `.discovery/code/scan-manifest.json` for context

## Parsing Layers (in order of preference)

### Layer 1 — Tree-sitter (core, deterministic)

Check if a Tree-sitter grammar exists for the file's language:

**Supported grammars** (install with `npm i tree-sitter-<grammar>`):

| Language | Grammar package | Extracts |
|----------|----------------|----------|
| TypeScript/JS | `tree-sitter-typescript` | imports, classes, functions, methods, calls, exports, inheritance |
| HTML | `tree-sitter-html` | elements, attributes, forms, inputs, ng-directives, bindings, ui-sref links |
| CSS | `tree-sitter-css` | selectors, properties, class names, media queries |
| Python | `tree-sitter-python` | imports, classes, functions, methods, calls, decorators |
| Java | `tree-sitter-java` | imports, classes, interfaces, methods, calls, inheritance |
| Go | `tree-sitter-go` | imports, structs, functions, methods, calls, interfaces |
| C# | `tree-sitter-c-sharp` | using, classes, interfaces, methods, calls, inheritance |
| PHP | `tree-sitter-php` | use/namespace, classes, functions, methods, calls |
| Rust | `tree-sitter-rust` | use, structs, traits, impls, functions, methods, calls |
| Kotlin | `tree-sitter-kotlin` | imports, classes, functions, methods, calls |
| Ruby | `tree-sitter-ruby` | require, classes, modules, methods, calls |
| C/C++ | `tree-sitter-c` / `tree-sitter-cpp` | includes, classes, functions, calls |
| SQL | `tree-sitter-sql` | tables, columns, joins, CTEs |
| Bash | `tree-sitter-bash` | functions, commands, variables |

**Structured data files** (deterministic, no Tree-sitter needed):

| Format | Parser | Extracts |
|--------|--------|----------|
| JSON (`.json`) | `JSON.parse` | keys, structure, data shapes, API schemas, translation keys, config values |
| XML/XSD (`.xml`, `.xsd`) | XML parser | elements, attributes, types, constraints, schemas |

**Check grammar availability**:
```bash
ls node_modules/tree-sitter-*/package.json 2>/dev/null
```

If grammar not installed, check if it exists and suggest installation:
```bash
npm info tree-sitter-<lang> version 2>/dev/null
```

**Run Tree-sitter parser**:
```bash
node .discovery/code/tools/ts-parse.js <filepath>
```

The parser (`ts-parse.js`) is created by `discovery-code-extract-symbols` if it doesn't exist. It outputs JSON with extracted symbols.

**Tree-sitter node types to extract**:
- `import_statement`, `import_declaration` → IMPORTS
- `class_declaration`, `class_definition` → CLASS
- `interface_declaration` → INTERFACE
- `function_declaration`, `function_definition` → FUNCTION
- `method_definition`, `method_declaration` → METHOD
- `call_expression` → CALLS
- `export_statement` → EXPORTS
- `extends`, `implements` → INHERITS/IMPLEMENTS

**HTML-specific node types to extract** (with `tree-sitter-html`):
- `element` with tag `form`, `input`, `select`, `textarea`, `button`, `table` → UI_ELEMENT
- `attribute` with name `ng-model`, `ng-bind`, `ng-click`, `ng-change`, `ng-submit` → BINDING
- `attribute` with name `ng-if`, `ng-show`, `ng-hide`, `ng-disabled` → CONDITIONAL
- `attribute` with name `ng-repeat`, `ng-options` → ITERATOR
- `attribute` with name `ui-sref`, `ng-href` → NAVIGATION
- `attribute` with name `ng-required`, `ng-pattern`, `maxlength`, `minlength` → VALIDATION
- `attribute` with name `translate`, `translate-values` → I18N_KEY

**Structured data extraction** (no Tree-sitter, deterministic parse):
- **JSON mock files**: `JSON.parse` → extract top-level keys, nested object shapes, array item schemas. Kind: `api_response_schema`.
- **JSON i18n files**: `JSON.parse` → extract all translation keys. Kind: `i18n_key`.
- **JSON config files**: `JSON.parse` → extract endpoint URLs, service names, settings. Kind: `config_entry`.
- **XSD files**: XML parse → extract `xs:element`, `xs:complexType`, `xs:simpleType`, constraints. Kind: `schema_type`.

Mark all Tree-sitter symbols: `confidence: "high"`, `source: "tree-sitter"`
Mark all structured data symbols: `confidence: "high"`, `source: "deterministic-parse"`

### Layer 1.5 — Pluggable Resolver (semantic enrichment)

Check if a resolver exists for this language:
```bash
ls .github/skills/discovery-code-resolve-*/SKILL.md 2>/dev/null
```

Match by language — e.g., for a TypeScript file, look for `discovery-code-resolve-typescript`.

If resolver exists:
1. Read the resolver skill
2. Pass it the Tree-sitter symbols as input
3. The resolver enriches with: resolved types, complete inheritance chains, overloads, framework wiring
4. The resolver installs its tool on demand if first run (e.g., `npm i ts-morph`)
5. Merged results: `confidence: "high"`, `source: "resolver"`, `resolver_tool: "<tool>"`

**Common resolver interface** (all resolvers follow this):
- **Input**: `file_path` + `tree_sitter_symbols` + `scan_manifest`
- **Output**: `enriched_symbols` + `additional_edges` + `metadata`

**No resolver for this framework?** → Read `.github/skills/discovery-code-create-resolver/SKILL.md` to create one from scratch. It provides the full scaffold, AST analysis techniques, and integration guide.

### Layer 2 — LLM Extraction (enrichment or fallback)

⛔ **GATE**: Before using LLM as primary extractor, verify:
- The file's language has **NO** Tree-sitter grammar (not in GRAMMAR_MAP in ts-parse.js)
- OR Tree-sitter was attempted and returned `error: 'no-grammar'`

If a Tree-sitter grammar EXISTS for this language but wasn't used → **STOP**.
Do NOT use LLM as primary extractor. Fix the Tree-sitter setup first (install grammar, verify ts-parse.js).

LLM may ONLY be used for:
1. **Fallback**: Languages without a Tree-sitter grammar (e.g., config files, templates, proprietary DSLs)
2. **Enrichment**: AFTER Tree-sitter has already extracted the structural symbols — LLM adds framework patterns, aliases, or semantic annotations on top

The LLM reads the source code and extracts/enriches symbols following the same schema.

Mark: `confidence: "medium"`, `source: "llm"`

### Layer 3 — Heuristics (last resort)

If neither Tree-sitter nor LLM can identify the language:
- Detect blocks by delimiters (`{`, `}`, indentation)
- Find includes/imports by regex patterns
- Extract function-like patterns

Mark: `confidence: "low"`, `source: "heuristic"`

### Layer 0+ — jQAssistant (optional bonus)

⚠️ **Only if jQA has been run** — check `.discovery/code/jqa-export/symbols.json`:
- If the file is covered by jQA data and hash matches → use/enrich with jQA symbols
- jQA data has highest confidence: `confidence: "high+"`, `source: "jqa"`
- jQA takes precedence over resolver when both available

## Output

Generate a symbol JSON file at `.discovery/code/symbols/<path-hash>.json`:

```json
{
  "file": "src/services/user.service.ts",
  "file_hash": "sha256:abc123",
  "language": "typescript",
  "parsed_at": "<ISO timestamp>",
  "parser": {
    "primary": "tree-sitter",
    "resolver": "ts-morph",
    "enriched_by": ["resolver", "llm"]
  },
  "symbols": [
    {
      "id": "src/services/user.service.ts::UserService",
      "name": "UserService",
      "kind": "class",
      "file": "src/services/user.service.ts",
      "line": 15,
      "end_line": 89,
      "confidence": "high",
      "source": "tree-sitter",
      "modifiers": ["export"],
      "extends": "BaseService",
      "implements": ["IUserService"],
      "members": ["getUser", "createUser", "deleteUser"]
    },
    {
      "id": "src/services/user.service.ts::UserService.getUser",
      "name": "getUser",
      "kind": "method",
      "file": "src/services/user.service.ts",
      "line": 22,
      "end_line": 35,
      "confidence": "high",
      "source": "resolver",
      "resolver_tool": "ts-morph",
      "params": [{"name": "id", "type": "string"}],
      "return_type": "Promise<User>",
      "decorators": [],
      "calls": ["this.repository.findById", "this.cache.get"]
    }
  ]
}
```

## Guardrails

- **DO NOT** invent symbols that don't exist in the source code
- **Tree-sitter first** — always prefer Tree-sitter over LLM for structural extraction
- **LLM enriches, doesn't replace** — when Tree-sitter and LLM disagree on structure, Tree-sitter wins
- **Large files** (>500 lines): process in sections to avoid context limits
- **Binary files**: skip immediately (detect by extension or `file` command)
- **Confidence is mandatory** — every symbol must have `confidence` and `source`
