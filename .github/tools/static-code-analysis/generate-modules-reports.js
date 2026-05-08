#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const slug = process.argv[2] || 'adequacYTRANS';
const codebaseRoot = path.join(repoRoot, '.discovery/code');
const scanDir = path.join(codebaseRoot, 'scans', slug);
const modulesDir = path.join(codebaseRoot, 'modules', slug);
const reportsDir = path.join(codebaseRoot, 'reports', slug);
const graphPath = path.join(codebaseRoot, 'graph', slug, 'edges.json');
const resolverPath = path.join(scanDir, 'resolver-angularjs.json');

fs.mkdirSync(modulesDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(scanDir, 'scan-manifest.json'), 'utf8'));
const resolver = fs.existsSync(resolverPath)
  ? JSON.parse(fs.readFileSync(resolverPath, 'utf8'))
  : { module_profiles: {}, platform_services: [] };
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

// Discover features: manifest.features → resolver.module_profiles → existing module JSONs
let features = manifest.features || [];
if (!features.length) {
  features = Object.keys(resolver.module_profiles || {});
}
if (!features.length && fs.existsSync(modulesDir)) {
  features = fs.readdirSync(modulesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

// Load profile data: prefer module JSONs (authoritative), fall back to resolver
function getProfile(feature) {
  const moduleJsonPath = path.join(modulesDir, `${feature}.json`);
  if (fs.existsSync(moduleJsonPath)) {
    return JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
  }
  return resolver.module_profiles[feature] || { feature };
}

function featurePrefixes(feature) {
  const profile = getProfile(feature);
  if (profile.file_prefixes && profile.file_prefixes.length) return profile.file_prefixes;
  const packagePrefixes = (manifest.feature_packages || [])
    .filter((item) => item.feature === feature)
    .map((item) => item.prefix.endsWith('/') ? item.prefix : `${item.prefix}/`);
  return packagePrefixes.length ? packagePrefixes : [`src/cgt/${feature}/`];
}

function featureEdges(feature) {
  const prefixes = featurePrefixes(feature);
  return graph.edges.filter((edge) =>
    String(edge.source).includes(feature) ||
    String(edge.target).includes(feature) ||
    (edge.file && prefixes.some((prefix) => edge.file.startsWith(prefix)))
  );
}

for (const feature of features) {
  const profile = getProfile(feature);
  const edges = featureEdges(feature);
  const outgoing = {};
  const incoming = {};
  for (const edge of edges) {
    outgoing[edge.type] = (outgoing[edge.type] || 0) + (String(edge.source).includes(feature) ? 1 : 0);
    incoming[edge.type] = (incoming[edge.type] || 0) + (String(edge.target).includes(feature) ? 1 : 0);
  }
  const moduleOutput = {
    ...profile,
    graph_summary: {
      total_edges: edges.length,
      outgoing,
      incoming,
    },
  };
  fs.writeFileSync(path.join(modulesDir, `${feature}.json`), JSON.stringify(moduleOutput, null, 2));
}

const summaryLines = [
  '# Static code analysis summary',
  '',
  `- Module slug: ${slug}`,
  `- Root: ${manifest.root}`,
  `- Features: ${features.join(', ')}`,
  `- Files scanned: ${manifest.total_files}`,
  `- Routes detected: ${(manifest.routes || []).map((route) => `${route.state} (${route.url})`).join(', ')}`,
  `- Platform services: ${(resolver.platform_services || []).join(', ') || 'none'}`,
  '',
  '## Feature coverage',
  '',
];

for (const feature of features) {
  const profile = getProfile(feature);
  const files = profile.files || [];
  const tests = profile.tests || [];
  const endpoints = (profile.model && profile.model.endpoints) || [];
  summaryLines.push(`- **${feature}**: ${files.length} files, ${tests.length} tests, ${endpoints.length} API endpoints`);
}

const dependenciesLines = [
  '# Feature dependency report',
  '',
  '| Feature | Controller -> Service | Service -> Model | View bindings | API endpoints |',
  '| --- | --- | --- | --- | --- |',
];

for (const feature of features) {
  const profile = getProfile(feature);
  const viewBindings = profile.view
    ? (profile.view.actions || []).length + (profile.view.models || []).length
    : 0;
  const endpoints = (profile.model && profile.model.endpoints) || [];
  dependenciesLines.push(`| ${feature} | ${profile.controller ? profile.controller.name : '-'} | ${profile.service ? profile.service.name : '-'} | ${viewBindings} | ${endpoints.length} |`);
}

const apiLines = [
  '# API surface report',
  '',
];

for (const feature of features) {
  const profile = getProfile(feature);
  const endpoints = (profile.model && profile.model.endpoints) || [];
  if (!endpoints.length) continue;
  apiLines.push(`## ${feature}`);
  apiLines.push('');
  for (const endpoint of endpoints) {
    apiLines.push(`- \`${endpoint.http_method} ${endpoint.url_template}\` via \`${endpoint.name}\``);
  }
  apiLines.push('');
}

fs.writeFileSync(path.join(reportsDir, 'summary.md'), `${summaryLines.join('\n')}\n`);
fs.writeFileSync(path.join(reportsDir, 'dependencies.md'), `${dependenciesLines.join('\n')}\n`);
fs.writeFileSync(path.join(reportsDir, 'api-surface.md'), `${apiLines.join('\n')}\n`);

console.log(JSON.stringify({
  slug,
  modules: features.length,
  reports: [
    path.join('.discovery/code', 'reports', slug, 'summary.md'),
    path.join('.discovery/code', 'reports', slug, 'dependencies.md'),
    path.join('.discovery/code', 'reports', slug, 'api-surface.md'),
  ],
}, null, 2));
