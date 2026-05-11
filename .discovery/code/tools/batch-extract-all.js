#!/usr/bin/env node
/**
 * Batch symbol extraction — Deterministic parsing for AngularJS project
 * Routes: JavaScript → Regex patterns, JSON → JSON.parse, HTML → Text analysis
 * Framework-specific: AngularJS 1.x pattern detection
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CODEBASE = path.join(ROOT, '.discovery/code');
const MANIFEST_PATH = path.join(CODEBASE, 'scans/frontend/scan-manifest.json');
const SYMBOLS_DIR = path.join(CODEBASE, 'symbols/frontend');

// Read manifest
if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`❌ Manifest not found: ${MANIFEST_PATH}`);
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const moduleRoot = path.join(ROOT, manifest.root);

// Build unified file list from manifest
const allFiles = [
    ...(manifest.files.source || []),
    ...(manifest.files.test || []),
    ...(manifest.files.config || [])
];
const uniqueFiles = [...new Set(allFiles)];

// Ensure symbols dir
if (!fs.existsSync(SYMBOLS_DIR)) fs.mkdirSync(SYMBOLS_DIR, { recursive: true });

// Stats
const stats = {
    total: uniqueFiles.length,
    processed: 0,
    skipped: 0,
    failed: 0,
    failures: [],
    by_type: {},
    by_source: { 'regex-parse': 0, 'json-parse': 0, 'text-extract': 0 },
    symbols_total: 0,
};

// === JavaScript/AngularJS Parser (Regex-based, deterministic) ===
function parseJavaScript(absPath, relPath, isTest) {
    const symbols = [];
    try {
        const content = fs.readFileSync(absPath, 'utf8');
        const lines = content.split('\n');

        // Detect AngularJS module definition: angular.module('name', [...])
        const moduleMatch = content.match(/angular\.module\s*\(\s*['"]([^'"]+)['"]/);
        if (moduleMatch) {
            const lineNum = content.substring(0, moduleMatch.index).split('\n').length;
            symbols.push({
                id: `${relPath}::${moduleMatch[1]}`,
                name: moduleMatch[1],
                kind: 'angular_module',
                type: 'module',
                file: relPath,
                line: lineNum,
                confidence: 'high',
                source: 'regex-parse',
                category: isTest ? 'test' : 'source'
            });
        }

        // Detect AngularJS registrations: .service(), .controller(), .component(), etc.
        const registrationPatterns = [
            { regex: /\.(service|factory|provider)\s*\(\s*['"]([^'"]+)['"]/, kind: 'angular_service' },
            { regex: /\.controller\s*\(\s*['"]([^'"]+)['"]/, kind: 'angular_controller' },
            { regex: /\.component\s*\(\s*['"]([^'"]+)['"]/, kind: 'angular_component' },
            { regex: /\.filter\s*\(\s*['"]([^'"]+)['"]/, kind: 'angular_filter' },
            { regex: /\.directive\s*\(\s*['"]([^'"]+)['"]/, kind: 'angular_directive' },
            { regex: /\.config\s*\(/, kind: 'angular_config' },
            { regex: /\.run\s*\(/, kind: 'angular_run' }
        ];

        for (const pattern of registrationPatterns) {
            let match;
            const regex = new RegExp(pattern.regex.source, 'g');
            while ((match = regex.exec(content)) !== null) {
                const lineNum = content.substring(0, match.index).split('\n').length;
                const name = match[2] || `${pattern.kind}_line_${lineNum}`;
                symbols.push({
                    id: `${relPath}::${name}:${lineNum}`,
                    name: name,
                    kind: pattern.kind,
                    type: pattern.kind.replace('angular_', ''),
                    file: relPath,
                    line: lineNum,
                    confidence: 'high',
                    source: 'regex-parse',
                    category: isTest ? 'test' : 'source'
                });
            }
        }

        // Detect function declarations
        const funcRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
        let funcMatch;
        while ((funcMatch = funcRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, funcMatch.index).split('\n').length;
            symbols.push({
                id: `${relPath}::${funcMatch[1]}:${lineNum}`,
                name: funcMatch[1],
                kind: 'function',
                type: 'function_declaration',
                file: relPath,
                line: lineNum,
                confidence: 'high',
                source: 'regex-parse',
                category: isTest ? 'test' : 'source'
            });
        }

        // Detect dependencies injection (common AngularJS pattern)
        const injectRegex = /\$inject\s*=\s*\[(.*?)\]/g;
        let injectMatch;
        while ((injectMatch = injectRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, injectMatch.index).split('\n').length;
            const deps = injectMatch[1].split(',').map(d => d.trim().replace(/['"]/g, ''));
            symbols.push({
                id: `${relPath}::deps:${lineNum}`,
                name: 'dependencies',
                kind: 'dependency_injection',
                type: 'injection',
                file: relPath,
                line: lineNum,
                dependencies: deps,
                confidence: 'high',
                source: 'regex-parse',
                category: isTest ? 'test' : 'source'
            });
        }

        // Detect API calls ($http, httpx)
        const httpRegex = /\$http\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
        let httpMatch;
        while ((httpMatch = httpRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, httpMatch.index).split('\n').length;
            symbols.push({
                id: `${relPath}::http:${lineNum}`,
                name: httpMatch[2],
                kind: 'http_call',
                type: 'api_call',
                method: httpMatch[1].toUpperCase(),
                endpoint: httpMatch[2],
                file: relPath,
                line: lineNum,
                confidence: 'high',
                source: 'regex-parse',
                category: isTest ? 'test' : 'source'
            });
        }

        return { symbols, source: 'regex-parse' };
    } catch (err) {
        return { error: err.message, symbols: [], source: 'regex-parse' };
    }
}

// === JSON Parser ===
function parseJSON(absPath, relPath, category) {
    try {
        const raw = fs.readFileSync(absPath, 'utf8');
        const data = JSON.parse(raw);
        const symbols = [];
        const fileName = path.basename(relPath, '.json');

        // Config files - extract endpoint URLs
        if (category === 'config' || relPath.includes('config.json')) {
            const entries = flattenEntries(data);
            for (const [key, value] of entries) {
                let kind = 'config_entry';
                const strVal = typeof value === 'string' ? value : '';
                if (strVal.startsWith('http') || strVal.startsWith('/') ||
                    key.toLowerCase().includes('url') || key.toLowerCase().includes('endpoint') ||
                    key.toLowerCase().includes('api')) {
                    kind = 'endpoint_url';
                }
                symbols.push({
                    id: `${relPath}::${key}`,
                    type: kind,
                    name: key,
                    kind: kind,
                    value: typeof value === 'object' ? JSON.stringify(value).substring(0, 150) : String(value).substring(0, 150),
                    file: relPath,
                    line: 1,
                    confidence: 'high',
                    source: 'json-parse',
                    category: category
                });
            }
        }
        // i18n files - extract translation keys
        else if (relPath.includes('i18n') || relPath.includes('es-ES') || relPath.includes('en-EN')) {
            const keys = flattenKeys(data);
            for (const key of keys) {
                symbols.push({
                    id: `${relPath}::${key}`,
                    type: 'i18n_key',
                    name: key,
                    kind: 'i18n_key',
                    file: relPath,
                    line: 1,
                    confidence: 'high',
                    source: 'json-parse',
                    category: 'i18n'
                });
            }
        }
        // Package files - extract dependencies
        else if (relPath.includes('package.json')) {
            if (data.dependencies) {
                for (const [pkg, version] of Object.entries(data.dependencies)) {
                    symbols.push({
                        id: `${relPath}::dep::${pkg}`,
                        type: 'dependency',
                        name: pkg,
                        kind: 'npm_dependency',
                        version: version,
                        file: relPath,
                        line: 1,
                        confidence: 'high',
                        source: 'json-parse',
                        category: 'config'
                    });
                }
            }
            if (data.scripts) {
                for (const [script, cmd] of Object.entries(data.scripts)) {
                    symbols.push({
                        id: `${relPath}::script::${script}`,
                        type: 'script',
                        name: script,
                        kind: 'npm_script',
                        command: cmd,
                        file: relPath,
                        line: 1,
                        confidence: 'high',
                        source: 'json-parse',
                        category: 'config'
                    });
                }
            }
        }

        return { symbols, source: 'json-parse' };
    } catch (err) {
        return { error: err.message, symbols: [], source: 'json-parse' };
    }
}

// === HTML Parser ===
function parseHTML(absPath, relPath) {
    try {
        const content = fs.readFileSync(absPath, 'utf8');
        const symbols = [];
        const lines = content.split('\n');

        // Extract custom components (app-* tags)
        const componentRegex = /<(app-[a-z-]+)/g;
        let match;
        while ((match = componentRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            symbols.push({
                id: `${relPath}::${match[1]}:${lineNum}`,
                name: match[1],
                kind: 'angular_component_usage',
                type: 'component_tag',
                file: relPath,
                line: lineNum,
                confidence: 'high',
                source: 'text-extract',
                category: 'source'
            });
        }

        // Extract ng-directives
        const ngDirectiveRegex = /(ng-[a-z-]+)\s*=\s*["']([^"']+)["']/g;
        while ((match = ngDirectiveRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            symbols.push({
                id: `${relPath}::${match[1]}:${lineNum}`,
                name: match[1],
                kind: 'angular_directive',
                type: 'directive',
                value: match[2],
                file: relPath,
                line: lineNum,
                confidence: 'high',
                source: 'text-extract',
                category: 'source'
            });
        }

        // Extract ui-view (UI-Router)
        if (content.includes('<ui-view')) {
            const lineNum = content.indexOf('<ui-view');
            symbols.push({
                id: `${relPath}::ui-view`,
                name: 'ui-view',
                kind: 'router_outlet',
                type: 'ui_router',
                file: relPath,
                line: content.substring(0, lineNum).split('\n').length,
                confidence: 'high',
                source: 'text-extract',
                category: 'source'
            });
        }

        return { symbols, source: 'text-extract' };
    } catch (err) {
        return { error: err.message, symbols: [], source: 'text-extract' };
    }
}

// === CSS Parser ===
function parseCSS(absPath, relPath) {
    try {
        const content = fs.readFileSync(absPath, 'utf8');
        const symbols = [];

        // Extract class selectors
        const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
        const classes = new Set();
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            if (!classes.has(match[1])) {
                classes.add(match[1]);
                const lineNum = content.substring(0, match.index).split('\n').length;
                symbols.push({
                    id: `${relPath}::.${match[1]}`,
                    name: match[1],
                    kind: 'css_class',
                    type: 'class_selector',
                    file: relPath,
                    line: lineNum,
                    confidence: 'high',
                    source: 'text-extract',
                    category: 'source'
                });
            }
        }

        return { symbols, source: 'text-extract' };
    } catch (err) {
        return { error: err.message, symbols: [], source: 'text-extract' };
    }
}

// === Helper functions ===
function flattenKeys(obj, prefix = '') {
    const keys = [];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${k}` : k;
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                keys.push(...flattenKeys(v, fullKey));
            } else {
                keys.push(fullKey);
            }
        }
    }
    return keys;
}

function flattenEntries(obj, prefix = '', depth = 0) {
    const entries = [];
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && depth < 2) {
        for (const [k, v] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${k}` : k;
            if (typeof v === 'object' && v !== null && !Array.isArray(v) && depth < 1) {
                entries.push(...flattenEntries(v, fullKey, depth + 1));
            } else {
                entries.push([fullKey, v]);
            }
        }
    }
    return entries;
}

function getFileCategory(relPath) {
    if (relPath.includes('/tests/') || relPath.includes('.spec.')) return 'test';
    if (relPath.includes('config.json') || relPath.includes('package')) return 'config';
    if (relPath.includes('i18n')) return 'i18n';
    return 'source';
}

// ============ MAIN ============
console.error(`\n📦 Batch extraction: ${uniqueFiles.length} files`);
const allSymbols = [];

for (const relPath of uniqueFiles) {
    const absPath = path.join(moduleRoot, relPath);
    const ext = path.extname(relPath).toLowerCase();
    const category = getFileCategory(relPath);
    const isTest = category === 'test';

    if (!fs.existsSync(absPath)) {
        stats.failed++;
        stats.failures.push({ file: relPath, error: 'File not found' });
        continue;
    }

    const contentHash = crypto.createHash('sha256')
        .update(fs.readFileSync(absPath))
        .digest('hex')
        .substring(0, 12);

    const pathHash = crypto.createHash('sha256')
        .update(relPath)
        .digest('hex')
        .substring(0, 16);

    const symbolFile = path.join(SYMBOLS_DIR, `${pathHash}.json`);

    let result;
    let symbols = [];

    try {
        const extKey = ext.replace('.', '') || 'other';
        stats.by_type[extKey] = (stats.by_type[extKey] || 0) + 1;

        if (ext === '.js') {
            result = parseJavaScript(absPath, relPath, isTest);
            symbols = result.symbols;
            stats.by_source['regex-parse'] += symbols.length;
        } else if (ext === '.json') {
            result = parseJSON(absPath, relPath, category);
            symbols = result.symbols;
            stats.by_source['json-parse'] += symbols.length;
        } else if (ext === '.html') {
            result = parseHTML(absPath, relPath);
            symbols = result.symbols;
            stats.by_source['text-extract'] += symbols.length;
        } else if (ext === '.css') {
            result = parseCSS(absPath, relPath);
            symbols = result.symbols;
            stats.by_source['text-extract'] += symbols.length;
        } else {
            // Skip unknown types
            stats.skipped++;
            continue;
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

    // Save per-file symbol JSON
    const fileOutput = {
        file: relPath,
        file_hash: `sha256:${contentHash}`,
        language: ext.replace('.', ''),
        category,
        parsed_at: new Date().toISOString(),
        parser: { primary: result ? result.source || 'unknown' : 'unknown' },
        symbols,
    };
    fs.writeFileSync(symbolFile, JSON.stringify(fileOutput, null, 2));
    allSymbols.push(...symbols);
    stats.symbols_total += symbols.length;
}

// === Build consolidated index.json ===
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
    version: 2,
    generated_at: new Date().toISOString(),
    module_slug: 'frontend',
    total_files: stats.processed,
    total_symbols: allSymbols.length,
    by_source: stats.by_source,
    by_language: byLanguage,
    by_category: stats.by_type,
    symbols: allSymbols.map(s => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        file: s.file,
        line: s.line,
        category: s.category,
        source: s.source,
        confidence: s.confidence,
    })),
};

fs.writeFileSync(
    path.join(SYMBOLS_DIR, 'index.json'),
    JSON.stringify(index, null, 2)
);

// === Update state.json ===
const statePath = path.join(CODEBASE, 'state.json');
const state = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
    : { version: 1, pipeline: {} };

state.current_module = 'frontend';
state.pipeline.scan = state.pipeline.scan || {};
state.pipeline.extract_symbols = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    total_files: stats.processed,
    total_symbols: allSymbols.length,
};
state.file_hashes = state.file_hashes || {};

for (const relPath of uniqueFiles) {
    const absPath = path.join(moduleRoot, relPath);
    if (fs.existsSync(absPath)) {
        const hash = crypto.createHash('sha256')
            .update(fs.readFileSync(absPath))
            .digest('hex')
            .substring(0, 12);
        state.file_hashes[relPath] = hash;
    }
}

fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

// === Report ===
console.error(`\n📊 Extraction complete`);
console.error(`├── Files: ${stats.processed} processed, ${stats.failed} failed, ${stats.skipped} skipped`);
console.error(`├── Symbols: ${stats.symbols_total}`);
console.error(`├── By source: Regex ${stats.by_source['regex-parse']} | JSON ${stats.by_source['json-parse']} | Text ${stats.by_source['text-extract']}`);
console.error(`├── By type: ${Object.entries(stats.by_type).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' | ')}`);
if (stats.failures.length > 0) {
    console.error(`└── Failures:`);
    for (const f of stats.failures.slice(0, 5)) {
        console.error(`    ⚠️  ${f.file}: ${f.error}`);
    }
    if (stats.failures.length > 5) {
        console.error(`    ... and ${stats.failures.length - 5} more`);
    }
}

console.log(JSON.stringify({ success: true, stats, by_language: byLanguage }, null, 2));
