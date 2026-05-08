#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const slug = process.argv[2] || 'adequacYTRANS';
const codebaseRoot = path.join(repoRoot, '.discovery/code');
const scanDir = path.join(codebaseRoot, 'scans', slug);
const symbolsDir = path.join(codebaseRoot, 'symbols', slug);
const resolverPath = path.join(scanDir, 'resolver-angularjs.json');
const registryPath = path.join(codebaseRoot, 'resolver-registry.json');

const manifest = JSON.parse(fs.readFileSync(path.join(scanDir, 'scan-manifest.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(symbolsDir, 'index.json'), 'utf8'));

const detailedByFile = {};
for (const entry of fs.readdirSync(symbolsDir)) {
  if (!entry.endsWith('.json') || entry === 'index.json') continue;
  const data = JSON.parse(fs.readFileSync(path.join(symbolsDir, entry), 'utf8'));
  detailedByFile[data.file] = data;
}

function readSource(relPath) {
  const absPath = path.join(manifest.root, relPath);
  return fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf8') : '';
}

function symbolsFor(relPath, kind) {
  const data = detailedByFile[relPath];
  if (!data) return [];
  return data.symbols.filter((symbol) => symbol.kind === kind);
}

function featurePrefixes(feature) {
  const packagePrefixes = (manifest.feature_packages || [])
    .filter((item) => item.feature === feature)
    .map((item) => item.prefix.endsWith('/') ? item.prefix : `${item.prefix}/`);
  return packagePrefixes.length ? packagePrefixes : [`src/cgt/${feature}/`];
}

function detectObjectName(source, fallback) {
  const varMatch = source.match(/var\s+([A-Za-z0-9_]+)\s*=\s*\{\s*\}/);
  if (varMatch) {
    return varMatch[1];
  }
  const assignmentMatch = source.match(/([A-Za-z0-9_]+)\.[A-Za-z0-9_]+\s*=\s*function\s*\(/);
  if (assignmentMatch) {
    return assignmentMatch[1];
  }
  return fallback;
}

function detectMethods(source, objectName) {
  const regex = new RegExp(`${objectName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\.([A-Za-z0-9_]+)\\s*=\\s*function\\s*\\(([^)]*)\\)\\s*{([\\s\\S]*?)\\n\\s*};`, 'g');
  const results = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    results.push({
      name: match[1],
      parameters: match[2].split(',').map((item) => item.trim()).filter(Boolean),
      body: match[3],
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return results;
}

const projectDefined = new Set(
  index.symbols
    .filter((symbol) => symbol.kind === 'angular_registration')
    .map((symbol) => symbol.name)
);
const angularBuiltins = new Set([
  '$scope',
  '$rootScope',
  '$http',
  '$q',
  '$state',
  '$stateParams',
  '$timeout',
  '$interval',
  '$log',
  '$filter',
  '$location',
  '$window',
  '$document',
  '$compile',
  '$parse',
  '$injector',
  '$templateCache',
  'gettextCatalog',
]);

const injected = new Set();
for (const symbol of index.symbols.filter((item) => item.kind === 'angular_registration')) {
  for (const dep of symbol.di_dependencies || []) {
    injected.add(dep);
  }
}

const platformServices = [...injected].filter((dep) => !projectDefined.has(dep) && !angularBuiltins.has(dep)).sort();

const moduleProfiles = {};
const additionalEdges = [];

function addEdge(source, target, type, confidence, file, line) {
  additionalEdges.push({
    source,
    target,
    type,
    confidence,
    sources: ['resolver'],
    file: file || null,
    line: line || null,
  });
}

for (const feature of manifest.features || []) {
  const prefixes = featurePrefixes(feature);
  const allFeatureFiles = [...new Set([
    ...(manifest.files.source_files || []).filter((file) => prefixes.some((prefix) => file.startsWith(prefix))),
    ...(manifest.files.test_files || []).filter((file) => prefixes.some((prefix) => file.startsWith(prefix))),
    ...(manifest.files.i18n_files || []).filter((file) => prefixes.some((prefix) => file.startsWith(prefix))),
    ...(manifest.files.enum_files || []).filter((file) => prefixes.some((prefix) => file.startsWith(prefix))),
    ...(manifest.files.annotated_files || []).filter((file) => prefixes.some((prefix) => file.startsWith(prefix))),
  ])].sort();

  const controllerFile = allFeatureFiles.find((file) => file.endsWith(`/${feature}_controller.js`)) || null;
  const serviceFile = allFeatureFiles.find((file) => file.endsWith(`/${feature}_service.js`)) || null;
  const modelFile = allFeatureFiles.find((file) => file.endsWith(`/${feature}_model.js`)) || null;
  const directiveFile = allFeatureFiles.find((file) => file.endsWith(`/${feature}_directive.js`)) || null;
  const viewFile = allFeatureFiles.find((file) => file.endsWith(`/${feature}_view.html`)) || null;

  const controllerSource = controllerFile ? readSource(controllerFile) : '';
  const serviceSource = serviceFile ? readSource(serviceFile) : '';
  const modelSource = modelFile ? readSource(modelFile) : '';

  const controllerRegistration = (symbolsFor(controllerFile || '', 'angular_registration')[0]) || null;
  const serviceRegistration = (symbolsFor(serviceFile || '', 'angular_registration')[0]) || null;
  const modelRegistration = (symbolsFor(modelFile || '', 'angular_registration')[0]) || null;
  const viewBindings = viewFile
    ? symbolsFor(viewFile, 'ng_click')
      .concat(symbolsFor(viewFile, 'ng_model'))
      .concat(symbolsFor(viewFile, 'ui_sref'))
      .concat(symbolsFor(viewFile, 'ng_controller'))
    : [];

  const scopeMethods = symbolsFor(controllerFile || '', 'scope_assignment').map((symbol) => {
    const delegatedCalls = (controllerRegistration && controllerRegistration.di_dependencies || [])
      .filter((dep) => !angularBuiltins.has(dep))
      .flatMap((dep) => [...controllerSource.matchAll(new RegExp(`${dep}\\.([A-Za-z0-9_]+)\\(`, 'g'))].map((match) => `${dep}.${match[1]}`))
      .filter((value, index, arr) => arr.indexOf(value) === index);
    return {
      name: symbol.scope_property,
      line: symbol.line,
      delegated_calls: delegatedCalls,
    };
  });

  const serviceObjectName = serviceFile ? detectObjectName(serviceSource, path.basename(serviceFile, '.js')) : '';
  const modelObjectName = modelFile ? detectObjectName(modelSource, path.basename(modelFile, '.js')) : '';
  const serviceMethods = serviceObjectName ? detectMethods(serviceSource, serviceObjectName) : [];
  const modelMethods = modelObjectName ? detectMethods(modelSource, modelObjectName) : [];

  const serviceProfiles = serviceMethods.map((method) => ({
    name: method.name,
    line: method.line,
    delegates_to: (serviceRegistration && serviceRegistration.di_dependencies || [])
      .filter((dep) => /Model$/.test(dep))
      .flatMap((dep) => [...method.body.matchAll(new RegExp(`${dep}\\.([A-Za-z0-9_]+)\\(`, 'g'))].map((match) => `${dep}.${match[1]}`)),
  }));

  const modelProfiles = modelMethods.map((method) => {
    // Strategy 1: URL declared inside method body (TRANS pattern)
    let urlMatch = method.body.match(/var\s+(URL_[A-Z0-9_]+)\s*=\s*['"]([^'"]+)['"]/);
    let urlTemplate = urlMatch ? urlMatch[2] : null;

    // Strategy 2: URL declared at file level, referenced by variable name in method body (GERE pattern)
    if (!urlTemplate) {
      // Collect file-level URL vars from full model source
      const fileUrls = {};
      const fileUrlRegex = /var\s+(URL_[A-Z0-9_]+)\s*=\s*['"]([^'"]+)['"]/g;
      let fileUrlMatch;
      while ((fileUrlMatch = fileUrlRegex.exec(modelSource)) !== null) {
        fileUrls[fileUrlMatch[1]] = fileUrlMatch[2];
      }
      // Find which URL variable is used in the method body (in T3_HTTPService calls or as argument)
      for (const [varName, url] of Object.entries(fileUrls)) {
        if (method.body.includes(varName)) {
          urlTemplate = url;
          break;
        }
      }
    }

    const httpMatch = method.body.match(/T3_HTTPService(?:\[['"]([A-Za-z]+)['"]\]|\.(get|post|put|delete))\s*\(/);
    return {
      name: method.name,
      line: method.line,
      http_method: ((httpMatch && (httpMatch[1] || httpMatch[2])) || 'get').toUpperCase(),
      url_template: urlTemplate,
      path_params: urlTemplate ? [...urlTemplate.matchAll(/{([^}]+)}/g)].map((item) => item[1]) : [],
    };
  }).filter((item) => item.url_template);

  const route = (manifest.routes || []).find((item) => item.feature === feature || item.state === feature) || null;

  if (viewFile && controllerRegistration) {
    addEdge(viewFile, `${controllerFile || viewFile}::${controllerRegistration.name}`, 'BINDS_CONTROLLER', 'high', viewFile, 1);
  }
  if (controllerRegistration && serviceRegistration) {
    addEdge(`${controllerFile || feature}::${controllerRegistration.name}`, `${serviceFile || feature}::${serviceRegistration.name}`, 'DEPENDS_ON', 'high', controllerFile, controllerRegistration.line);
  }
  if (serviceRegistration && modelRegistration) {
    addEdge(`${serviceFile || feature}::${serviceRegistration.name}`, `${modelFile || feature}::${modelRegistration.name}`, 'DEPENDS_ON', 'high', serviceFile, serviceRegistration.line);
  }
  if (route && viewFile) {
    addEdge(`route::${route.state}`, viewFile, 'ROUTES_TO', 'high', 'src/app.js', 1);
  }
  for (const binding of viewBindings.filter((item) => item.kind === 'ui_sref')) {
    addEdge(viewFile, `route::${binding.name}`, 'NAVIGATES_TO', 'high', viewFile, binding.line);
  }
  for (const endpoint of modelProfiles) {
    addEdge(`${modelFile || feature}::${endpoint.name}`, `api::${endpoint.http_method}:${endpoint.url_template}`, 'CALLS_API', 'high', modelFile, endpoint.line);
  }

  moduleProfiles[feature] = {
    feature,
    route,
    file_prefixes: prefixes,
    files: allFeatureFiles,
    controller: controllerRegistration ? {
      name: controllerRegistration.name,
      file: controllerFile,
      di_dependencies: controllerRegistration.di_dependencies || [],
      scope_methods: scopeMethods,
      state_transitions: symbolsFor(controllerFile || '', 'state_transition').map((symbol) => symbol.name),
    } : null,
    service: serviceRegistration ? {
      name: serviceRegistration.name,
      file: serviceFile,
      di_dependencies: serviceRegistration.di_dependencies || [],
      methods: serviceProfiles,
    } : null,
    model: modelRegistration ? {
      name: modelRegistration.name,
      file: modelFile,
      di_dependencies: modelRegistration.di_dependencies || [],
      endpoints: modelProfiles,
    } : null,
    directive: directiveFile,
    view: viewFile ? {
      file: viewFile,
      controller: symbolsFor(viewFile, 'ng_controller').map((symbol) => symbol.name),
      actions: symbolsFor(viewFile, 'ng_click').map((symbol) => symbol.name),
      models: symbolsFor(viewFile, 'ng_model').map((symbol) => symbol.name),
      navigations: symbolsFor(viewFile, 'ui_sref').map((symbol) => symbol.name),
    } : null,
    i18n_files: (manifest.files.i18n_files || []).filter((file) => prefixes.some((prefix) => file.startsWith(prefix))),
    enum_files: (manifest.files.enum_files || []).filter((file) => prefixes.some((prefix) => file.startsWith(prefix))),
    tests: (manifest.files.test_files || []).filter((file) => prefixes.some((prefix) => file.startsWith(prefix))),
  };
}

const resolverOutput = {
  version: 1,
  module_slug: slug,
  generated_at: new Date().toISOString(),
  resolver: 'angularjs-static',
  metadata: {
    framework: 'AngularJS',
    confidence: 'high',
    source: 'resolver',
  },
  platform_services: platformServices,
  module_profiles: moduleProfiles,
  additional_edges: additionalEdges,
};

let registry = { discovered: [], used: [] };
if (fs.existsSync(registryPath)) {
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    registry = { discovered: [], used: [] };
  }
}
registry.discovered = [
  {
    name: 'angularjs-static',
    skill: '.github/skills/discovery-code-resolve-angularjs/SKILL.md',
    framework: 'AngularJS',
  },
];
registry.used = [
  {
    slug,
    resolver: 'angularjs-static',
    completed_at: new Date().toISOString(),
  },
];

manifest.platform_services = platformServices;
manifest.api_endpoints = Object.values(moduleProfiles).flatMap((profile) => (profile.model ? profile.model.endpoints : []));
fs.writeFileSync(path.join(scanDir, 'scan-manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(resolverPath, JSON.stringify(resolverOutput, null, 2));
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

console.log(JSON.stringify({
  slug,
  resolver: 'angularjs-static',
  platform_services: platformServices,
  modules: Object.keys(moduleProfiles).length,
  resolver_output: path.join('.discovery/code', 'scans', slug, 'resolver-angularjs.json'),
}, null, 2));
