---
name: discovery-code-extract-symbols
description: Orchestrates bulk symbol extraction across all files in the scan manifest. Manages the Tree-sitter parser tool, delegates to discovery-code-parse-file per file, coordinates resolvers, and produces a consolidated symbol index.
license: Apache-2.0
compatibility: Requires Node.js for Tree-sitter. Grammars installed on demand.
metadata:
  author: discovery-code
  version: "1.0"
---

# Codebase — Extract Symbols

Orchestrate symbol extraction across **all files** in the scanned repository. This skill manages the pipeline: creates the parser tool, discovers resolvers, delegates parsing per file, and consolidates the index.

## Prerequisites

- `.discovery/code/scan-manifest.json` must exist (run `@discovery-code scan` first)

## Steps

### 1. Read scan manifest

```bash
cat .discovery/code/scan-manifest.json
```

Extract: total count, exclusions, and the **complete file list from ALL arrays**:
- `files.source_files` — application code (JS, TS, HTML, CSS, etc.)
- `files.test_files` — test/spec files
- `files.config_files` — configuration files (JSON, YAML, etc.)
- `files.mock_files` — API mock data (JSON responses/requests)
- `files.i18n_files` — internationalization strings (JSON)
- `files.enum_files` — enum/constant definitions (JSON)
- `files.annotated_files` — annotated file lists (TXT)

⛔ **MANDATORY**: Process files from ALL arrays, not just `source_files`. Every parseable file in the manifest must be processed. Build a unified file list by merging all arrays and deduplicating.

### 2. Ensure Tree-sitter parser tool exists

Check if `.discovery/code/tools/ts-parse.js` exists. If not, create it:

```javascript
#!/usr/bin/env node
// Tree-sitter parser — extracts symbols from a single file
// Usage: node ts-parse.js <filepath>

const fs = require('fs');
const path = require('path');
const Parser = require('tree-sitter');

const GRAMMAR_MAP = {
  '.ts': 'tree-sitter-typescript/typescript',
  '.tsx': 'tree-sitter-typescript/tsx',
  '.js': 'tree-sitter-javascript',
  '.jsx': 'tree-sitter-javascript',
  '.py': 'tree-sitter-python',
  '.java': 'tree-sitter-java',
  '.go': 'tree-sitter-go',
  '.cs': 'tree-sitter-c-sharp',
  '.php': 'tree-sitter-php/php',
  '.rs': 'tree-sitter-rust',
  '.kt': 'tree-sitter-kotlin',
  '.rb': 'tree-sitter-ruby',
  '.c': 'tree-sitter-c',
  '.cpp': 'tree-sitter-cpp',
  '.sql': 'tree-sitter-sql',
  '.sh': 'tree-sitter-bash',
  '.bash': 'tree-sitter-bash'
};

const filepath = process.argv[2];
if (!filepath) { console.error('Usage: ts-parse.js <filepath>'); process.exit(1); }

const ext = path.extname(filepath);
const grammarName = GRAMMAR_MAP[ext];
if (!grammarName) {
  console.log(JSON.stringify({ error: 'no-grammar', ext }));
  process.exit(0);
}

let Language;
try {
  Language = require(grammarName);
} catch (e) {
  console.log(JSON.stringify({ error: 'grammar-not-installed', grammar: grammarName }));
  process.exit(0);
}

const parser = new Parser();
parser.setLanguage(Language);

const source = fs.readFileSync(filepath, 'utf8');
const tree = parser.parse(source);

const symbols = [];
const SYMBOL_TYPES = new Set([
  'import_statement', 'import_declaration',
  'class_declaration', 'class_definition',
  'interface_declaration',
  'function_declaration', 'function_definition',
  'method_definition', 'method_declaration',
  'call_expression',
  'export_statement',
  'struct_type_declaration', 'type_declaration'
]);

function walk(node) {
  if (SYMBOL_TYPES.has(node.type)) {
    const nameNode = node.childForFieldName('name') || node.firstNamedChild;
    symbols.push({
      type: node.type,
      name: nameNode ? nameNode.text : null,
      start: node.startPosition.row + 1,
      end: node.endPosition.row + 1,
      text_preview: source.substring(node.startIndex, Math.min(node.startIndex + 200, node.endIndex))
    });
  }
  for (let i = 0; i < node.childCount; i++) {
    walk(node.child(i));
  }
}

walk(tree.rootNode);
console.log(JSON.stringify({ file: filepath, language: ext, symbols }, null, 2));
```

Ensure `tree-sitter` core is installed:
```bash
ls node_modules/tree-sitter/package.json 2>/dev/null || npm i tree-sitter
```

### 2b. ⛔ MANDATORY GATE — Verify Tree-sitter is operational

**DO NOT proceed past this step until ALL of the following are true:**

1. `.discovery/code/tools/ts-parse.js` exists and is executable
2. `tree-sitter` core is installed: `node -e "require('tree-sitter')" 2>/dev/null && echo OK`
3. At least ONE grammar is installed for a language present in scan-manifest.json:
   ```bash
   # For JS repos:
   node -e "require('tree-sitter-javascript')" 2>/dev/null && echo OK
   ```
4. A test run succeeds on any source file:
   ```bash
   node .discovery/code/tools/ts-parse.js <any-source-file>
   # Must return valid JSON with symbols array
   ```

If ANY check fails → **STOP**. Install missing packages, fix the tool, and re-verify.
Do NOT proceed to Step 3. Do NOT fall back to LLM for languages that have a grammar.

**LLM extraction (Step 7) is ONLY permitted for files whose language has NO Tree-sitter grammar in GRAMMAR_MAP.**

### 3. Discover available resolvers

```bash
ls .github/skills/discovery-code-resolve-*/SKILL.md 2>/dev/null
```

Parse resolver names to build a language → resolver map:
- `discovery-code-resolve-typescript` → TypeScript/JavaScript
- `discovery-code-resolve-python` → Python
- etc.

Update `.discovery/code/resolver-registry.json` with discovery results.

**No resolver for the project's framework?** → Read `.github/skills/discovery-code-create-resolver/SKILL.md` to create one. It provides a full scaffold with the universal contract, 9-step methodology, AST analysis techniques (symbol filtering, source range reading, cross-file lookup, Tree-sitter re-parse), and integration with the pipeline. The resolver MUST be deterministic (no LLM) and follow the naming convention `.discovery/code/tools/<framework>-resolve.js`.

### 4. Install grammars for ALL detected file extensions

Collect all unique file extensions from the unified file list (Step 1). For each extension:

1. Check if it's already in `GRAMMAR_MAP` in `ts-parse.js`
2. If NOT in GRAMMAR_MAP, check if a Tree-sitter grammar exists for it:
   ```bash
   npm info tree-sitter-html version 2>/dev/null   # for .html
   npm info tree-sitter-css version 2>/dev/null     # for .css
   npm info tree-sitter-json version 2>/dev/null    # for .json
   ```
3. If a grammar exists, install it AND update GRAMMAR_MAP dynamically:
   ```bash
   npm i tree-sitter-<grammar>
   ```
   Then add the mapping to `ts-parse.js` GRAMMAR_MAP (e.g., `'.html': 'tree-sitter-html'`).

**Common extension → grammar mappings** (install on demand):

| Extension | Grammar | What to extract |
|-----------|---------|----------------|
| `.html` | `tree-sitter-html` | elements, attributes, forms, inputs, ng-directives, bindings |
| `.css` | `tree-sitter-css` | selectors, properties, classes |
| `.json` | `tree-sitter-json` | keys, structure, values (or use `JSON.parse` directly) |
| `.xml`/`.xsd` | `tree-sitter-xml` | elements, attributes, schemas |

⛔ **MANDATORY**: Do NOT skip file extensions just because they're not in the initial GRAMMAR_MAP. Detect them, find grammars, install, and extend the map.

### 4b. ⛔ MANDATORY — Create batch extraction tool

Check if `.discovery/code/tools/batch-extract-all.js` exists. If not, create it following this **generic template**. The script orchestrates extraction of all file types from the scan manifest, routing each to the appropriate parser.

⛔ **FRAMEWORK-AGNOSTIC**: The `normalizeTreeSitter()` function below handles ANY output from `ts-parse.js` regardless of framework (AngularJS, React, Angular, Vue, Spring, etc.). It reads ALL arrays in the ts-parse.js output and passes through ALL extra properties. Do NOT add framework-specific normalizer logic here — `ts-parse.js` is responsible for framework-specific extraction.

```javascript
#!/usr/bin/env node
/**
 * Batch symbol extraction — processes ALL file types from scan-manifest.json
 * Routes: Grammared languages → Tree-sitter, JSON → JSON.parse, TXT → text, YAML → text
 * Framework-agnostic: normalizes ANY ts-parse.js output regardless of framework
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CODEBASE = path.join(ROOT, '.discovery/code');
const MANIFEST_PATH = path.join(CODEBASE, 'scan-manifest.json');
const SYMBOLS_DIR = path.join(CODEBASE, 'symbols');
const TS_PARSE = path.join(CODEBASE, 'tools', 'ts-parse.js');

// Read manifest
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const moduleRoot = path.join(ROOT, manifest.root);

// --- Build unified file list from ALL arrays ---
const allArrays = [
  ...(manifest.files.source_files || []),
  ...(manifest.files.test_files || []),
  ...(manifest.files.config_files || []),
  ...(manifest.files.mock_files || []),
  ...(manifest.files.i18n_files || []),
  ...(manifest.files.enum_files || []),
  ...(manifest.files.annotated_files || []),
];
const uniqueFiles = [...new Set(allArrays)];

// Ensure symbols dir
if (!fs.existsSync(SYMBOLS_DIR)) fs.mkdirSync(SYMBOLS_DIR, { recursive: true });

// Stats
const stats = {
  total: uniqueFiles.length,
  processed: 0,
  skipped: 0,
  failed: 0,
  failures: [],
  by_type: {},  // populated dynamically by file extension
  by_source: { 'tree-sitter': 0, 'deterministic-parse': 0, 'text-extract': 0 },
  symbols_total: 0,
};

// --- Classify file category from manifest arrays ---
function getFileCategory(relPath) {
  if ((manifest.files.mock_files || []).includes(relPath)) return 'mock';
  if ((manifest.files.i18n_files || []).includes(relPath)) return 'i18n';
  if ((manifest.files.enum_files || []).includes(relPath)) return 'enum';
  if ((manifest.files.config_files || []).includes(relPath)) return 'config';
  if ((manifest.files.test_files || []).includes(relPath)) return 'test';
  if ((manifest.files.annotated_files || []).includes(relPath)) return 'annotated';
  return 'source';
}

// --- JSON parser ---
function parseJSON(absPath, relPath, category) {
  try {
    const raw = fs.readFileSync(absPath, 'utf8');
    const data = JSON.parse(raw);
    const symbols = [];

    if (category === 'mock') {
      symbols.push({
        type: 'api_response_schema',
        name: path.basename(relPath, '.json'),
        kind: 'api_response_schema',
        file: relPath,
        line: 1,
        confidence: 'high',
        source: 'deterministic-parse',
        schema: extractSchema(data, 3),
      });
    } else if (category === 'i18n') {
      const keys = flattenKeys(data);
      for (const key of keys) {
        symbols.push({
          type: 'i18n_key', name: key, kind: 'i18n_key',
          file: relPath, line: 1, confidence: 'high', source: 'deterministic-parse',
        });
      }
    } else if (category === 'enum') {
      const entries = flattenEntries(data);
      for (const [key, value] of entries) {
        symbols.push({
          type: 'enum_value', name: key, kind: 'enum_value',
          value: typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : String(value),
          file: relPath, line: 1, confidence: 'high', source: 'deterministic-parse',
        });
      }
    } else if (category === 'config') {
      const entries = flattenEntries(data);
      for (const [key, value] of entries) {
        let kind = 'config_entry';
        const strVal = typeof value === 'string' ? value : '';
        if (strVal.startsWith('http') || strVal.startsWith('/') || key.toLowerCase().includes('url') || key.toLowerCase().includes('endpoint')) {
          kind = 'endpoint_url';
        }
        symbols.push({
          type: kind, name: key, kind: kind,
          value: typeof value === 'object' ? JSON.stringify(value).substring(0, 150) : String(value).substring(0, 150),
          file: relPath, line: 1, confidence: 'high', source: 'deterministic-parse',
        });
      }
    }
    return { symbols, source: 'deterministic-parse' };
  } catch (err) {
    return { error: err.message, symbols: [], source: 'deterministic-parse' };
  }
}

// --- Schema extractor for JSON (recursive, max depth) ---
function extractSchema(obj, maxDepth, depth) {
  depth = depth || 0;
  if (depth >= maxDepth) return typeof obj;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return [extractSchema(obj[0], maxDepth, depth + 1)];
  }
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = extractSchema(v, maxDepth, depth + 1);
    }
    return result;
  }
  return typeof obj;
}

function flattenKeys(obj, prefix) {
  prefix = prefix || '';
  const keys = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? prefix + '.' + k : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        keys.push(...flattenKeys(v, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }
  return keys;
}

function flattenEntries(obj, prefix, depth) {
  prefix = prefix || '';
  depth = depth || 0;
  const entries = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && depth < 2) {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? prefix + '.' + k : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v) && depth < 1) {
        entries.push(...flattenEntries(v, fullKey, depth + 1));
      } else {
        entries.push([fullKey, v]);
      }
    }
  }
  return entries;
}

// --- TXT parser (annotated copies) ---
function parseTXT(absPath, relPath) {
  try {
    const content = fs.readFileSync(absPath, 'utf8');
    const lines = content.split('\n');
    const symbols = [];
    const isJSTxt = relPath.endsWith('.js.txt');
    const isHTMLTxt = relPath.endsWith('.html.txt');

    symbols.push({
      type: 'annotated_file', name: path.basename(relPath), kind: 'annotated_file',
      original_type: isJSTxt ? 'javascript' : isHTMLTxt ? 'html' : 'text',
      file: relPath, line: 1, end_line: lines.length, total_lines: lines.length,
      confidence: 'medium', source: 'text-extract',
    });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const annotationMatch = line.match(/\/\/\s*(NOTA|NOTE|TODO|FIXME|ANNOTATION|IMPORTANT|REVIEW):\s*(.+)/i);
      if (annotationMatch) {
        symbols.push({
          type: 'annotation',
          name: annotationMatch[1] + ': ' + annotationMatch[2].substring(0, 100),
          kind: 'annotation', file: relPath, line: i + 1,
          confidence: 'medium', source: 'text-extract',
        });
      }
    }
    return { symbols, source: 'text-extract' };
  } catch (err) {
    return { error: err.message, symbols: [], source: 'text-extract' };
  }
}

// --- Tree-sitter parser (any language with a grammar) ---
function parseTreeSitter(absPath, relPath) {
  try {
    const result = execSync(`node "${TS_PARSE}" "${absPath}"`, {
      encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 30000,
    });
    const parsed = JSON.parse(result);
    if (parsed.error) return { error: parsed.error, symbols: [], source: 'tree-sitter' };
    return { parsed, source: 'tree-sitter' };
  } catch (err) {
    return { error: err.message.substring(0, 200), symbols: [], source: 'tree-sitter' };
  }
}

// --- Generic normalizer for ANY Tree-sitter output ---
// Handles all languages/frameworks. ts-parse.js outputs:
//   parsed.symbols — standard AST symbols (always present)
//   parsed.<anything_else> — framework-specific arrays from ts-parse.js
//     (e.g., angular_registrations, react_components, vue_directives, spring_beans)
// This normalizer reads ALL arrays and passes through ALL extra properties.
function normalizeTreeSitter(parsed, relPath, category) {
  const symbols = [];
  const SKIP_KEYS = new Set(['file', 'language', 'error']);
  for (const [key, value] of Object.entries(parsed)) {
    if (SKIP_KEYS.has(key) || !Array.isArray(value)) continue;
    for (const item of value) {
      if (typeof item !== 'object' || item === null) continue;
      if (item.start === undefined && item.line === undefined) continue;
      const startLine = item.start || item.line || 0;
      const name = item.name || '(anonymous)';
      const kind = key === 'symbols'
        ? (item.type || 'unknown').replace(/_/g, '-')
        : (item.kind || item.type || key.replace(/_/g, '-'));
      const def = {
        id: relPath + '::' + name + ':' + startLine,
        name, kind, type: item.type || key,
        file: relPath, line: startLine, end_line: item.end || startLine,
        confidence: 'high', source: 'tree-sitter', category,
      };
      if (item.text_preview) def.text_preview = item.text_preview.substring(0, 150);
      // Pass through ALL extra properties from ts-parse.js (framework-specific data)
      for (const [k, v] of Object.entries(item)) {
        if (!def.hasOwnProperty(k) && !['start', 'end', 'text_preview'].includes(k)) {
          def[k] = v;
        }
      }
      symbols.push(def);
    }
  }
  return symbols;
}

// ============ MAIN ============
console.error(`\n📦 Batch extraction: ${uniqueFiles.length} files from ${Object.keys(manifest.files).length} manifest arrays`);
const allSymbols = [];

for (const relPath of uniqueFiles) {
  const absPath = path.join(moduleRoot, relPath);
  const ext = path.extname(relPath).toLowerCase();
  const category = getFileCategory(relPath);

  if (!fs.existsSync(absPath)) {
    stats.failed++;
    stats.failures.push({ file: relPath, error: 'File not found' });
    continue;
  }

  const contentHash = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex').substring(0, 12);
  const pathHash = crypto.createHash('sha256').update(relPath).digest('hex').substring(0, 16);
  const symbolFile = path.join(SYMBOLS_DIR, pathHash + '.json');

  let result;
  let symbols = [];

  try {
    const extKey = ext.replace('.', '') || 'other';
    stats.by_type[extKey] = (stats.by_type[extKey] || 0) + 1;

    if (ext === '.json') {
      result = parseJSON(absPath, relPath, category);
      symbols = result.symbols;
      stats.by_source['deterministic-parse'] += symbols.length;
    } else if (ext === '.txt') {
      result = parseTXT(absPath, relPath);
      symbols = result.symbols;
      stats.by_source['text-extract'] += symbols.length;
    } else if (ext === '.yml' || ext === '.yaml') {
      const content = fs.readFileSync(absPath, 'utf8');
      symbols = [{
        id: relPath + '::config', name: path.basename(relPath), kind: 'yaml_config',
        file: relPath, line: 1, end_line: content.split('\n').length,
        confidence: 'medium', source: 'text-extract', category,
      }];
      stats.by_source['text-extract'] += symbols.length;
    } else {
      // ALL other extensions → Tree-sitter (JS, TS, HTML, CSS, Python, Java, Go, etc.)
      result = parseTreeSitter(absPath, relPath);
      if (result.parsed) {
        symbols = normalizeTreeSitter(result.parsed, relPath, category);
        stats.by_source['tree-sitter'] += symbols.length;
      }
    }

    if (result && result.error) {
      stats.failed++;
      stats.failures.push({ file: relPath, error: result.error });
    } else {
      stats.processed++;
    }
  } catch (err) {
    stats.failed++;
    stats.failures.push({ file: relPath, error: err.message.substring(0, 200) });
    continue;
  }

  // Save per-file symbol JSON (path-based hash for unique filenames)
  const fileOutput = {
    file: relPath, file_hash: 'sha256:' + contentHash,
    language: ext.replace('.', ''), category,
    parsed_at: new Date().toISOString(),
    parser: { primary: result ? result.source || 'unknown' : 'unknown' },
    symbols,
  };
  fs.writeFileSync(symbolFile, JSON.stringify(fileOutput, null, 2));
  allSymbols.push(...symbols);
  stats.symbols_total += symbols.length;
}

// --- Build consolidated index.json ---
const byLanguage = {};
for (const relPath of uniqueFiles) {
  const ext = path.extname(relPath).toLowerCase().replace('.', '') || 'unknown';
  if (!byLanguage[ext]) byLanguage[ext] = { files: 0, symbols: 0 };
  byLanguage[ext].files++;
}
for (const sym of allSymbols) {
  const ext = path.extname(sym.file).toLowerCase().replace('.', '') || 'unknown';
  if (byLanguage[ext]) byLanguage[ext].symbols++;
}

const index = {
  version: 2, generated_at: new Date().toISOString(),
  total_files: stats.processed, total_symbols: allSymbols.length,
  by_source: stats.by_source, by_language: byLanguage, by_category: stats.by_type,
  symbols: allSymbols.map(s => ({
    id: s.id, name: s.name, kind: s.kind, file: s.file,
    line: s.line, category: s.category, source: s.source, confidence: s.confidence,
  })),
};
fs.writeFileSync(path.join(SYMBOLS_DIR, 'index.json'), JSON.stringify(index, null, 2));

// --- Update state.json ---
const state = {
  pipeline: {
    scan_repo: { status: 'completed', completed_at: manifest.scanned_at },
    extract_symbols: {
      status: 'completed', completed_at: new Date().toISOString(),
      total_files: stats.processed, total_symbols: allSymbols.length,
    },
  },
  file_hashes: {},
};
for (const relPath of uniqueFiles) {
  const absPath = path.join(moduleRoot, relPath);
  if (fs.existsSync(absPath)) {
    state.file_hashes[relPath] = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex').substring(0, 12);
  }
}
fs.writeFileSync(path.join(CODEBASE, 'state.json'), JSON.stringify(state, null, 2));

// --- Report ---
console.error(`\n📊 Extraction complete`);
console.error(`├── Files: ${stats.processed} processed, ${stats.failed} failed, ${stats.skipped} skipped`);
console.error(`├── Symbols: ${stats.symbols_total}`);
console.error(`├── By source: Tree-sitter ${stats.by_source['tree-sitter']} | Deterministic ${stats.by_source['deterministic-parse']} | Text ${stats.by_source['text-extract']}`);
console.error(`├── By type: ${Object.entries(stats.by_type).map(([k,v]) => k.toUpperCase() + ' ' + v).join(' | ')}`);
if (stats.failures.length > 0) {
  console.error(`└── Failures:`);
  for (const f of stats.failures) console.error(`    ⚠️  ${f.file}: ${f.error}`);
}
console.log(JSON.stringify({ stats, by_language: byLanguage }, null, 2));
```

After creating the tool, run it:
```bash
node .discovery/code/tools/batch-extract-all.js 2>&1
```

This replaces the manual per-file loop in Steps 5–9b. The script handles routing, normalization, completeness, index consolidation, and state update in one deterministic pass.

### 5. Process files — Tree-sitter phase

For each file in the **unified file list** (ALL manifest arrays, not just source_files):

1. Compute file hash: `sha256sum <filepath>`
2. Check `.discovery/code/state.json` → `file_hashes` — if hash matches, **skip** (incremental)
3. **Route by file type**:
   - **Code files** (`.js`, `.ts`, `.py`, `.java`, etc.): Run Tree-sitter → `node .discovery/code/tools/ts-parse.js <filepath>`
   - **HTML views** (`.html`): Run Tree-sitter with HTML grammar → extract elements, forms, inputs, attributes. Then post-process in `ts-parse.js` to extract framework-specific bindings detected for the project (e.g., AngularJS `ng-*` directives, React JSX props, Vue `v-*` directives).
   - **JSON files** (`.json`): Parse with `JSON.parse` (deterministic). Extract: keys, structure, data shapes. For mock files, extract API response schemas. For i18n files, extract translation keys. For config files, extract endpoint URLs and settings.
   - **CSS files** (`.css`): Run Tree-sitter with CSS grammar → extract selectors, classes.
   - **XML/XSD files** (`.xml`, `.xsd`): Parse XML deterministically → extract elements, attributes, types, constraints.
   - **Text files** (`.txt`): Read content, extract structured data if any pattern detected.
4. If result has `error: 'no-grammar'` → mark for LLM fallback
5. If result has `error: 'grammar-not-installed'` → install grammar, retry
6. Normalize output to Symbol schema (§5.1)
7. Invoke `discovery-code-parse-file` skill for the full layered pipeline
8. Save result to `.discovery/code/symbols/<path-hash>.json`
9. Update `file_hashes` in state

⛔ **JSON and XML files do NOT need Tree-sitter** — use native `JSON.parse` or XML parser directly. These are structured data, not source code. Parse them deterministically without Tree-sitter or LLM.

### 6. Process files — Resolver phase

For each file that has Tree-sitter symbols AND a resolver exists for its language:
1. Read the resolver skill
2. Pass Tree-sitter symbols + scan manifest
3. Merge enriched symbols back into the symbol file
4. Update `source` to `"resolver"` for enriched entries

### 7. Process files — LLM fallback

For files without Tree-sitter grammar and without resolver:
1. Read the file content
2. Use LLM to extract symbols following the Symbol schema
3. Mark `confidence: "medium"`, `source: "llm"`
4. Save to `.discovery/code/symbols/<path-hash>.json`

### 8. Process files — jQA enrichment (optional)

If `.discovery/code/jqa-export/symbols.json` exists:
1. For each file covered by jQA data
2. Merge/override with jQA symbols where hashes match
3. Mark `confidence: "high+"`, `source: "jqa"`

### 9. Consolidate index

Read all symbol files and create `.discovery/code/symbols/index.json`.

**Before consolidating**, run the completeness check:

### 9b. ⛔ COMPLETENESS GATE — Verify all manifest files were parsed

Build the set of ALL files from ALL manifest arrays (source_files, test_files, config_files, mock_files, i18n_files, enum_files, annotated_files). Then compare against the set of files that have symbol JSONs in `.discovery/code/symbols/`.

```javascript
// Completeness check (run in Node.js or equivalent)
const manifest = JSON.parse(fs.readFileSync('.discovery/code/scan-manifest.json'));
const arrays = ['source_files','test_files','config_files','mock_files','i18n_files','enum_files','annotated_files'];
const manifestFiles = new Set();
arrays.forEach(key => (manifest.files[key] || []).forEach(f => manifestFiles.add(f)));

const parsedFiles = new Set();
glob.sync('.discovery/code/symbols/*.json').forEach(f => {
  if (f.endsWith('index.json')) return;
  const d = JSON.parse(fs.readFileSync(f));
  parsedFiles.add(d.file);
});

const missing = [...manifestFiles].filter(f => !parsedFiles.has(f));
if (missing.length > 0) {
  console.error(`⛔ COMPLETENESS FAILED: ${missing.length}/${manifestFiles.size} files not parsed:`);
  missing.forEach(f => console.error(`  MISSING: ${f}`));
  // DO NOT proceed — process missing files first
}
```

**If ANY files are missing**:
1. Log which files are missing and their extensions
2. Process them now (go back to Step 5 for just the missing files)
3. Re-run this completeness check
4. Only proceed to consolidation when `missing.length === 0`

⛔ **MANDATORY**: The index MUST cover 100% of manifest files. A partial index is a **FAILED** extraction.

Once complete, generate `.discovery/code/symbols/index.json`:

```json
{
  "version": 1,
  "generated_at": "<ISO timestamp>",
  "total_files": 342,
  "total_symbols": 4521,
  "by_source": {
    "tree-sitter": 3800,
    "resolver": 2100,
    "llm": 520,
    "heuristic": 12,
    "jqa": 0
  },
  "by_language": {
    "typescript": { "files": 234, "symbols": 3200 },
    "java": { "files": 89, "symbols": 1100 },
    "python": { "files": 19, "symbols": 221 }
  },
  "symbols": [
    { "id": "src/services/user.service.ts::UserService", "kind": "class", "file": "src/services/user.service.ts", "line": 15 },
    { "id": "src/services/user.service.ts::UserService.getUser", "kind": "method", "file": "src/services/user.service.ts", "line": 22 }
  ]
}
```

### 10. Update state

Update `.discovery/code/state.json`:
```json
{
  "pipeline": {
    "extract_symbols": {
      "status": "completed",
      "completed_at": "<ISO timestamp>",
      "total_files": 342,
      "total_symbols": 4521
    }
  }
}
```

### 11. Report

```
📊 Symbol extraction complete
├── Files processed: 342 (skipped 0 unchanged)
├── Symbols extracted: 4,521
├── By source: Tree-sitter 3,800 | Resolver 2,100 | LLM 520 | Heuristic 12
├── By language: TypeScript 3,200 | Java 1,100 | Python 221
├── Resolvers used: typescript (ts-morph), python (jedi)
└── Index saved: .discovery/code/symbols/index.json

Next: Run `@discovery-code index` to build the relationship graph (or it runs automatically).
```

## Fast Path: `pipeline.js`

If `.discovery/code/tools/pipeline.js` exists, this skill's work (and all downstream steps) can be performed automatically:

```bash
node .discovery/code/tools/pipeline.js "<src-dir>" --clean
```

The pipeline calls `.discovery/code/tools/batch-extract-all.js` internally which runs `ts-parse.js` on every file and produces `index.json`. Use the individual skill steps when you need fine-grained control or debugging.

See `how-to/HOW-TO-PIPELINE.md` for full documentation.

## Guardrails

- ⛔ **MANDATORY**: Tree-sitter MUST be the primary extractor for ALL languages that have a grammar in GRAMMAR_MAP. LLM is ONLY a fallback for languages WITHOUT a grammar. If `by_source.tree-sitter == 0` at the end AND the repo has files with supported grammars (JS, TS, Python, Java, etc.) → the extraction **FAILED**. Do NOT proceed to build-graph. Fix Tree-sitter setup and re-run.
- ⛔ **MANDATORY**: `.discovery/code/tools/ts-parse.js` MUST exist and be verified (Step 2b) before processing any files. Skipping ts-parse.js creation is a critical failure.
- **Incremental** — never re-parse files whose hash hasn't changed
- **Install on demand** — only install grammars for languages present in the repo
- **Tree-sitter first** — always run Tree-sitter before any LLM call. LLM may only enrich or handle unsupported languages.
- **DO NOT** process binary files, images, or generated files
- **Cap batch size** — for repos with >1,000 files, process in batches of 100 and report progress
- **Handle failures gracefully** — if a file fails to parse, log it and continue with next file


## Multi-Module Convention

All per-module artifacts are namespaced under a **module slug** subdirectory. See `.github/MULTI-MODULE.md` for full layout.

**Path resolution**: When this skill references a path like `.discovery/code/scan-manifest.json` or `.requirement/<slug>/flows/`, the actual path is `.discovery/code/scans/<module-slug>/scan-manifest.json` or `.requirement/<module-slug>/flows/`.

**Registry**: Read `.discovery/code/registry.json` or `.discovery/runtime/registry.json` to discover available modules. Update the registry when producing new artifacts.

**Module slug**: Derived from the app URL path (e.g., `tran-adequacyTRAN` from `http://localhost:3000/tran-adequacyTRAN`). If only one module exists, use it implicitly. If multiple exist, ask the user.
