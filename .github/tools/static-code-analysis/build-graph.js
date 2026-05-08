#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const slug = process.argv[2] || 'adequacYTRANS';
const codebaseRoot = path.join(repoRoot, '.discovery/code');
const scanDir = path.join(codebaseRoot, 'scans', slug);
const symbolsDir = path.join(codebaseRoot, 'symbols', slug);
const graphDir = path.join(codebaseRoot, 'graph', slug);
const statePath = path.join(scanDir, 'state.json');
const manifest = JSON.parse(fs.readFileSync(path.join(scanDir, 'scan-manifest.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(symbolsDir, 'index.json'), 'utf8'));
const resolverPath = path.join(scanDir, 'resolver-angularjs.json');
const resolver = fs.existsSync(resolverPath) ? JSON.parse(fs.readFileSync(resolverPath, 'utf8')) : { additional_edges: [], platform_services: [] };

fs.mkdirSync(graphDir, { recursive: true });

const detailedByFile = {};
for (const entry of fs.readdirSync(symbolsDir)) {
  if (!entry.endsWith('.json') || entry === 'index.json') continue;
  const data = JSON.parse(fs.readFileSync(path.join(symbolsDir, entry), 'utf8'));
  detailedByFile[data.file] = data;
}

const edges = [];
const edgeSet = new Set();

function addEdge(source, target, type, confidence, file, line, sources) {
  const key = `${source}|${target}|${type}`;
  if (!source || !target || edgeSet.has(key)) return;
  edgeSet.add(key);
  edges.push({
    source,
    target,
    type,
    confidence,
    sources: sources || ['tree-sitter'],
    file: file || null,
    line: line || null,
  });
}

const allSymbols = index.symbols;
const symbolsByFile = {};
for (const symbol of allSymbols) {
  symbolsByFile[symbol.file] = symbolsByFile[symbol.file] || [];
  symbolsByFile[symbol.file].push(symbol);
}

const platformServices = new Set([...(manifest.platform_services || []), ...(resolver.platform_services || [])]);
const callExpressions = allSymbols.filter((symbol) => symbol.kind === 'call-expression');
const crossFileTargetKinds = new Set([
  'function-declaration',
  'assignment-expression',
  'variable-declarator',
  'method-definition',
  'angular_registration',
  'scope_assignment',
]);
const commonCallNames = new Set([
  'then',
  'catch',
  'map',
  'filter',
  'forEach',
  'push',
  'replace',
  'substring',
  'copy',
  'init',
  'click',
  'trim',
  'split',
  'join',
]);
const namedSymbols = Object.create(null);
for (const symbol of allSymbols) {
  if (!symbol.name || !crossFileTargetKinds.has(symbol.kind)) continue;
  namedSymbols[symbol.name] = namedSymbols[symbol.name] || [];
  namedSymbols[symbol.name].push(symbol);
}

function featurePrefixes(feature) {
  const packagePrefixes = (manifest.feature_packages || [])
    .filter((item) => item.feature === feature)
    .map((item) => item.prefix.endsWith('/') ? item.prefix : `${item.prefix}/`);
  return packagePrefixes.length ? packagePrefixes : [`src/cgt/${feature}/`];
}

for (const [file, symbols] of Object.entries(symbolsByFile)) {
  for (const symbol of symbols) {
    if (symbol.kind === 'call-expression') continue;
    addEdge(file, symbol.id, 'CONTAINS', 'high', file, symbol.line, [symbol.source || 'tree-sitter']);
  }
}

const nonCallableKinds = new Set(['html_element', 'i18n_key', 'api_response_schema', 'config_entry', 'endpoint_url', 'enum_value', 'annotated_file', 'annotation', 'yaml_config', 'css_selector', 'xml_element']);
for (const [file, symbols] of Object.entries(symbolsByFile)) {
  const declarations = symbols.filter((symbol) => !nonCallableKinds.has(symbol.kind) && symbol.kind !== 'call-expression');
  for (const call of symbols.filter((symbol) => symbol.kind === 'call-expression')) {
    const callParts = String(call.name || '').split('.');
    const lastPart = callParts[callParts.length - 1];
    for (const declaration of declarations) {
      if (declaration.name === call.name || declaration.name === lastPart) {
        addEdge(call.id, declaration.id, 'CALLS', 'high', file, call.line, ['tree-sitter']);
      }
    }
  }
}

for (const call of callExpressions) {
  const parts = String(call.name || '').split('.');
  const objectName = parts[0];
  const lastPart = parts[parts.length - 1];
  if (platformServices.has(objectName)) {
    addEdge(`${call.file}::${objectName}`, `platform::${objectName}`, 'USES_SERVICE', 'high', call.file, call.line, ['tree-sitter', 'resolver']);
  }
  if (commonCallNames.has(lastPart)) {
    continue;
  }
  if (Array.isArray(namedSymbols[lastPart]) && namedSymbols[lastPart].length <= 10) {
    for (const target of namedSymbols[lastPart]) {
      if (target.file !== call.file) {
        addEdge(call.id, target.id, 'CALLS', 'medium', call.file, call.line, ['tree-sitter']);
      }
    }
  }
}

for (const file of Object.keys(symbolsByFile)) {
  const basename = path.basename(file);
  const specMatch = basename.match(/^(.+?)(?:Spec|\.spec|\.test)\.(js|jsx)$/);
  if (!specMatch) continue;
  const sourceName = `${specMatch[1]}.${specMatch[2]}`;
  for (const sourceFile of Object.keys(symbolsByFile)) {
    if (path.basename(sourceFile) === sourceName) {
      addEdge(file, sourceFile, 'TESTS', 'high', file, null, ['tree-sitter']);
    }
  }
}

for (const symbol of allSymbols.filter((item) => item.kind === 'annotated_file')) {
  const originalPath = symbol.file.replace(/\.txt$/, '');
  if (symbolsByFile[originalPath]) {
    addEdge(symbol.file, originalPath, 'ANNOTATES', 'high', symbol.file, null, ['text-extract']);
  }
}

for (const symbol of allSymbols.filter((item) => item.kind === 'endpoint_url')) {
  addEdge(`${symbol.file}::${symbol.name}`, `config::endpoint:${symbol.name}`, 'DEFINES_ENDPOINT', 'high', symbol.file, symbol.line, ['deterministic-parse']);
}

for (const symbol of allSymbols.filter((item) => item.kind === 'api_response_schema')) {
  addEdge(symbol.id, `api::mock:${symbol.name}`, 'MOCKS_API', 'high', symbol.file, symbol.line, ['deterministic-parse']);
}

for (const i18nFile of manifest.files.i18n_files || []) {
  const featureDir = path.dirname(path.dirname(i18nFile));
  for (const file of Object.keys(symbolsByFile)) {
    if (file.startsWith(`${featureDir}/`) && file.endsWith('.html')) {
      addEdge(file, i18nFile, 'USES_I18N', 'high', file, null, ['deterministic-parse']);
    }
  }
}

for (const feature of manifest.features || []) {
  const featureNode = `feature::${feature}`;
  const prefixes = featurePrefixes(feature);
  const featureFiles = Object.keys(symbolsByFile).filter((file) => prefixes.some((prefix) => file.startsWith(prefix)));
  for (const file of featureFiles) {
    addEdge(featureNode, file, 'FEATURE_CONTAINS', 'high', file, null, ['scan']);
  }
}

for (const route of manifest.routes || []) {
  if (!route.state) continue;
  const routeNode = `route::${route.state}`;
  if (route.template) {
    const templatePath = route.template.replace(/^\.\//, 'src/');
    if (symbolsByFile[templatePath]) {
      addEdge(routeNode, templatePath, 'ROUTES_TO', 'high', 'src/app.js', null, ['scan']);
    }
  }
  for (const lazyContext of route.lazy_contexts || []) {
    const feature = lazyContext.split('/').pop();
    if (feature) {
      addEdge(routeNode, `feature::${feature}`, 'LAZY_LOADS', 'medium', 'src/app.js', null, ['scan']);
    }
  }
}

for (const edge of resolver.additional_edges || []) {
  addEdge(edge.source, edge.target, edge.type, edge.confidence || 'high', edge.file, edge.line, edge.sources || ['resolver']);
}

// ── NEW: translate_key → i18n_key linkage ──────────────────────
// Links HTML translate keys to their i18n JSON definitions
const i18nKeys = allSymbols.filter((s) => s.kind === 'i18n_key');
const i18nByName = Object.create(null);
for (const ik of i18nKeys) {
  i18nByName[ik.name] = i18nByName[ik.name] || [];
  i18nByName[ik.name].push(ik);
}
for (const sym of allSymbols.filter((s) => s.kind === 'translate_key')) {
  const targets = i18nByName[sym.name];
  if (targets) {
    for (const target of targets) {
      addEdge(sym.id, target.id, 'TRANSLATES', 'high', sym.file, sym.line, ['deterministic-parse']);
    }
  }
}

// ── NEW: scope_assignment / ng_model / ng_click linkage ────────
// Links controller scope bindings to their HTML view usages
const scopeAssignments = allSymbols.filter((s) => s.kind === 'scope_assignment');
const scopeByName = Object.create(null);
for (const sa of scopeAssignments) {
  const cleanName = String(sa.name).replace(/^\$scope\./, '');
  scopeByName[cleanName] = scopeByName[cleanName] || [];
  scopeByName[cleanName].push(sa);
}
for (const sym of allSymbols.filter((s) => ['ng_model', 'ng_click', 'ng_init'].includes(s.kind))) {
  const bindingName = String(sym.name).replace(/\(.*$/, '').trim();
  const targets = scopeByName[bindingName];
  if (targets) {
    for (const target of targets) {
      addEdge(sym.id, target.id, 'BINDS_SCOPE', 'medium', sym.file, sym.line, ['deterministic-parse']);
    }
  }
}

// ── NEW: http_call → endpoint_url linkage ──────────────────────
// Links model HTTP calls to their config endpoint definitions
const endpointUrls = allSymbols.filter((s) => s.kind === 'endpoint_url');
const endpointByName = Object.create(null);
for (const eu of endpointUrls) {
  endpointByName[eu.name] = endpointByName[eu.name] || [];
  endpointByName[eu.name].push(eu);
}
for (const sym of allSymbols.filter((s) => s.kind === 'http_call' || s.kind === 'api_url')) {
  const callName = String(sym.name).split('/').pop().split('?')[0];
  for (const [epName, targets] of Object.entries(endpointByName)) {
    if (epName.includes(callName) || callName.includes(epName)) {
      for (const target of targets) {
        addEdge(sym.id, target.id, 'CALLS_ENDPOINT', 'medium', sym.file, sym.line, ['deterministic-parse']);
      }
    }
  }
}

// ── NEW: ng_controller → angular_registration linkage ──────────
const registrations = allSymbols.filter((s) => s.kind === 'angular_registration');
const regByName = Object.create(null);
for (const r of registrations) {
  regByName[r.name] = regByName[r.name] || [];
  regByName[r.name].push(r);
}
for (const sym of allSymbols.filter((s) => s.kind === 'ng_controller')) {
  const targets = regByName[sym.name];
  if (targets) {
    for (const target of targets) {
      addEdge(sym.id, target.id, 'WIRES_CONTROLLER', 'high', sym.file, sym.line, ['deterministic-parse']);
    }
  }
}

const byType = {};
const byConfidence = {};
for (const edge of edges) {
  byType[edge.type] = (byType[edge.type] || 0) + 1;
  byConfidence[edge.confidence] = (byConfidence[edge.confidence] || 0) + 1;
}

const output = {
  version: 2,
  module_slug: slug,
  generated_at: new Date().toISOString(),
  total_edges: edges.length,
  by_type: byType,
  by_confidence: byConfidence,
  edges,
};

fs.writeFileSync(path.join(graphDir, 'edges.json'), JSON.stringify(output, null, 2));

let state = { version: 1, module_slug: slug, pipeline: {} };
if (fs.existsSync(statePath)) {
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    state = { version: 1, module_slug: slug, pipeline: {} };
  }
}
state.pipeline = state.pipeline || {};
state.pipeline.build_graph = {
  status: 'completed',
  completed_at: new Date().toISOString(),
  total_edges: edges.length,
  by_type: byType,
};
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

console.log(JSON.stringify({
  slug,
  total_edges: edges.length,
  by_type: byType,
  graph: path.join('.discovery/code', 'graph', slug, 'edges.json'),
}, null, 2));
