#!/usr/bin/env node
// Build relationship graph from extracted symbols
// Includes generic levels + AngularJS-specific relationship types
// Reads .discovery/code/symbols/frontend/index.json → produces .discovery/code/graph/frontend/edges.json

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CODEBASE = path.join(ROOT, '.discovery/code');
const SYMBOLS_DIR = path.join(CODEBASE, 'symbols/frontend');
const GRAPH_DIR = path.join(CODEBASE, 'graph/frontend');
const INDEX_PATH = path.join(SYMBOLS_DIR, 'index.json');
const MANIFEST_PATH = path.join(CODEBASE, 'scans/frontend/scan-manifest.json');

if (!fs.existsSync(GRAPH_DIR)) fs.mkdirSync(GRAPH_DIR, { recursive: true });

if (!fs.existsSync(INDEX_PATH)) {
    console.error('❌ Symbol index not found. Run extract-symbols first.');
    process.exit(1);
}

const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const allSymbols = index.symbols;

console.log(`Building graph from ${allSymbols.length} symbols across ${index.total_files} files...`);

// Load per-file symbol JSONs for detailed data
const detailedByFile = {};
const symbolFiles = fs.readdirSync(SYMBOLS_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
for (const sf of symbolFiles) {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(SYMBOLS_DIR, sf), 'utf8'));
        detailedByFile[data.file] = data;
    } catch (e) { /* skip */ }
}

const edges = [];
const edgeSet = new Set();

function addEdge(source, target, type, confidence, file, line, sources) {
    const key = `${source}|${target}|${type}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({
        source, target, type, confidence,
        sources: sources || ['regex-parse'],
        file: file || null,
        line: line || null
    });
}

// Group symbols by file and kind
const symbolsByFile = {};
const symbolsByKind = {};
for (const sym of allSymbols) {
    if (!symbolsByFile[sym.file]) symbolsByFile[sym.file] = [];
    symbolsByFile[sym.file].push(sym);

    if (!symbolsByKind[sym.kind]) symbolsByKind[sym.kind] = [];
    symbolsByKind[sym.kind].push(sym);
}

// Build lookup maps
const modules = symbolsByKind['angular_module'] || [];
const services = [...(symbolsByKind['angular_service'] || []), ...(symbolsByKind['angular_factory'] || [])];
const controllers = symbolsByKind['angular_controller'] || [];
const components = symbolsByKind['angular_component'] || [];
const filters = symbolsByKind['angular_filter'] || [];
const directives = symbolsByKind['angular_directive'] || [];
const configs = symbolsByKind['angular_config'] || [];
const runs = symbolsByKind['angular_run'] || [];
const httpCalls = symbolsByKind['http_call'] || [];
const i18nKeys = symbolsByKind['i18n_key'] || [];
const configEntries = symbolsByKind['config_entry'] || [];
const endpointUrls = symbolsByKind['endpoint_url'] || [];
const cssClasses = symbolsByKind['css_class'] || [];
const htmlComponentUsages = symbolsByKind['angular_component_usage'] || [];
const ngDirectives = symbolsByKind['angular_directive'] || [];
const routerOutlets = symbolsByKind['router_outlet'] || [];

// ====================
// GENERIC LEVEL 1: CONTAINS (file → symbol)
// ====================
console.log('  Level 1: CONTAINS edges...');
for (const [file, syms] of Object.entries(symbolsByFile)) {
    for (const sym of syms) {
        if (!['http_call', 'angular_component_usage'].includes(sym.kind)) {
            addEdge(file, sym.id, 'CONTAINS', 'high', file, sym.line, ['regex-parse']);
        }
    }
}

// ====================
// GENERIC LEVEL 2: Test → Source
// ====================
console.log('  Level 2: Test → Source edges...');
for (const file of Object.keys(symbolsByFile)) {
    const basename = path.basename(file);
    const specMatch = basename.match(/^(.+?)\.spec\.(js|ts)$/);
    if (specMatch) {
        const sourceName = specMatch[1] + '.' + specMatch[2];
        for (const sourceFile of Object.keys(symbolsByFile)) {
            if (path.basename(sourceFile) === sourceName) {
                addEdge(file, sourceFile, 'TESTS', 'high', file, null, ['regex-parse']);
            }
        }
    }
}

// ====================
// ANGULARJS LEVEL 1: Module → Registrations
// ====================
console.log('  AngularJS Level 1: Module REGISTERS...');
for (const mod of modules) {
    const moduleFile = mod.file;
    const moduleName = mod.name;

    // Find all registrations in the same file as the module
    const registrations = [
        ...services.filter(s => s.file === moduleFile),
        ...controllers.filter(s => s.file === moduleFile),
        ...components.filter(s => s.file === moduleFile),
        ...filters.filter(s => s.file === moduleFile),
        ...directives.filter(s => s.file === moduleFile),
        ...configs.filter(s => s.file === moduleFile),
        ...runs.filter(s => s.file === moduleFile)
    ];

    for (const reg of registrations) {
        addEdge(mod.id, reg.id, 'REGISTERS', 'high', moduleFile, reg.line, ['regex-parse']);
    }
}

// ====================
// ANGULARJS LEVEL 2: Module Dependencies
// ====================
console.log('  AngularJS Level 2: Module DEPENDS_ON...');
// Detect: angular.module('app', ['ui.router'])
for (const mod of modules) {
    const detail = detailedByFile[mod.file];
    if (detail && detail.symbols) {
        for (const sym of detail.symbols) {
            if (sym.name === mod.name && sym.text_preview) {
                const depsMatch = sym.text_preview.match(/\[\s*(['"][^'"]+['"]\s*,?\s*)+\]/);
                if (depsMatch) {
                    const deps = depsMatch[0].match(/['"]([^'"]+)['"]/g) || [];
                    for (const dep of deps) {
                        const depName = dep.replace(/['"]/g, '');
                        addEdge(mod.id, `module::${depName}`, 'DEPENDS_ON', 'high', mod.file, mod.line, ['regex-parse']);
                    }
                }
            }
        }
    }
}

// ====================
// ANGULARJS LEVEL 3: Dependency Injection
// ====================
console.log('  AngularJS Level 3: INJECTS dependencies...');
for (const [file, detail] of Object.entries(detailedByFile)) {
    if (!detail.symbols) continue;
    for (const sym of detail.symbols) {
        if (sym.kind === 'dependency_injection' && sym.dependencies) {
            // Find the parent symbol (service/controller that has these deps)
            const fileSyms = symbolsByFile[file] || [];
            const parent = fileSyms.find(s =>
                ['angular_service', 'angular_controller', 'angular_component', 'angular_config', 'angular_run']
                    .includes(s.kind) && Math.abs(s.line - sym.line) < 5
            );

            if (parent) {
                for (const dep of sym.dependencies) {
                    // Check if dependency is a known service
                    const depService = services.find(s => s.name === dep);
                    if (depService) {
                        addEdge(parent.id, depService.id, 'INJECTS', 'high', file, sym.line, ['regex-parse']);
                    } else {
                        // Framework or external dependency
                        addEdge(parent.id, `service::${dep}`, 'INJECTS', 'high', file, sym.line, ['regex-parse']);
                    }
                }
            }
        }
    }
}

// ====================
// ANGULARJS LEVEL 4: HTTP API Calls
// ====================
console.log('  AngularJS Level 4: HTTP CALLS_API...');
for (const httpCall of httpCalls) {
    // Link to service that makes the call
    const fileSyms = symbolsByFile[httpCall.file] || [];
    const service = fileSyms.find(s => s.kind === 'angular_service');
    if (service) {
        addEdge(service.id, `api::${httpCall.method}::${httpCall.endpoint}`, 'CALLS_API', 'high', httpCall.file, httpCall.line, ['regex-parse']);
    }

    // Link to config endpoint if matches
    const configEndpoint = [...configEntries, ...endpointUrls].find(e =>
        e.value && e.value.includes(httpCall.endpoint)
    );
    if (configEndpoint) {
        addEdge(httpCall.id, configEndpoint.id, 'USES_CONFIG', 'medium', httpCall.file, httpCall.line, ['regex-parse']);
    }
}

// ====================
// ANGULARJS LEVEL 5: Component Usage in HTML
// ====================
console.log('  AngularJS Level 5: HTML USES_COMPONENT...');
for (const usage of htmlComponentUsages) {
    const componentName = usage.name;
    const component = components.find(c => c.name === componentName);
    if (component) {
        addEdge(usage.file, component.id, 'USES_COMPONENT', 'high', usage.file, usage.line, ['text-extract']);
    }
}

// ====================
// ANGULARJS LEVEL 6: Router Outlets
// ====================
console.log('  AngularJS Level 6: Router outlets...');
for (const outlet of routerOutlets) {
    addEdge(outlet.file, 'router::ui-router', 'USES_ROUTER', 'high', outlet.file, outlet.line, ['text-extract']);
}

// ====================
// GENERIC LEVEL 3: i18n → Views
// ====================
console.log('  Level 3: i18n references...');
const i18nFilesByLang = {};
for (const key of i18nKeys) {
    const lang = path.basename(path.dirname(key.file));
    if (!i18nFilesByLang[lang]) i18nFilesByLang[lang] = new Set();
    i18nFilesByLang[lang].add(key.file);
}
for (const file of Object.keys(symbolsByFile)) {
    if (file.endsWith('.html') || file.endsWith('.js')) {
        for (const i18nFile of Object.values(i18nFilesByLang).flatMap(s => [...s])) {
            // Simple heuristic: HTML/JS files can use i18n
            if (file !== i18nFile) {
                addEdge(file, i18nFile, 'USES_I18N', 'medium', file, null, ['heuristic']);
            }
        }
    }
}

// ====================
// GENERIC LEVEL 4: CSS Classes
// ====================
console.log('  Level 4: CSS class definitions...');
for (const cssClass of cssClasses) {
    addEdge(cssClass.file, `style::${cssClass.name}`, 'DEFINES_STYLE', 'high', cssClass.file, cssClass.line, ['text-extract']);
}

// ====================
// GENERIC LEVEL 5: Config Endpoints
// ====================
console.log('  Level 5: Config endpoint definitions...');
for (const cfg of [...configEntries, ...endpointUrls]) {
    if (cfg.kind === 'endpoint_url' || (cfg.name && cfg.name.toLowerCase().includes('url'))) {
        addEdge(cfg.file, `config::endpoint::${cfg.name}`, 'DEFINES_ENDPOINT', 'high', cfg.file, cfg.line, ['json-parse']);
    }
}

// ====================
// CROSS-FILE RESOLUTION: Service → Service
// ====================
console.log('  Cross-file: Service dependencies...');
// Parse service files for usage of other services (by name matching)
for (const service of services) {
    const detail = detailedByFile[service.file];
    if (!detail || !detail.symbols) continue;

    const fileContent = detail.symbols.map(s => s.text_preview || '').join(' ');

    // Check if this service uses other services (by name)
    for (const otherService of services) {
        if (otherService.id !== service.id && fileContent.includes(otherService.name)) {
            addEdge(service.id, otherService.id, 'USES_SERVICE', 'medium', service.file, null, ['heuristic']);
        }
    }
}

// Count by type and confidence
const byType = {};
const byConfidence = {};
for (const e of edges) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    byConfidence[e.confidence] = (byConfidence[e.confidence] || 0) + 1;
}

const graphOutput = {
    version: 2,
    generated_at: new Date().toISOString(),
    module_slug: 'frontend',
    total_edges: edges.length,
    by_type: byType,
    by_confidence: byConfidence,
    edges
};

fs.writeFileSync(
    path.join(GRAPH_DIR, 'edges.json'),
    JSON.stringify(graphOutput, null, 2)
);

// Update state
const statePath = path.join(CODEBASE, 'state.json');
let state = {};
if (fs.existsSync(statePath)) {
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (e) { }
}
state.pipeline = state.pipeline || {};
state.pipeline.build_graph = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    total_edges: edges.length,
    by_type: byType
};
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

// Report
console.log('\n📊 Graph built');
console.log(`├── Total edges: ${edges.length}`);
console.log(`├── By type: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
console.log(`├── By confidence: ${Object.entries(byConfidence).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
console.log(`└── Saved: .discovery/code/graph/frontend/edges.json`);

console.log(JSON.stringify({ success: true, total_edges: edges.length, by_type: byType }, null, 2));
