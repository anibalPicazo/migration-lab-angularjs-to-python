#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const sourceRoot = path.resolve(process.argv[2] || '.');
const slug = process.argv[3] || path.basename(sourceRoot);
const now = new Date().toISOString();

const codebaseRoot = path.join(repoRoot, '.discovery/code');
const scansDir = path.join(codebaseRoot, 'scans', slug);
const symbolsDir = path.join(codebaseRoot, 'symbols', slug);
const graphDir = path.join(codebaseRoot, 'graph', slug);
const modulesDir = path.join(codebaseRoot, 'modules', slug);
const reportsDir = path.join(codebaseRoot, 'reports', slug);
const repomixDir = path.join(codebaseRoot, 'scans', slug);
const registryPath = path.join(codebaseRoot, 'registry.json');

const EXCLUDED_DIRS = new Set([
  '.git',
  '.discovery/code',
  '.discovery/runtime',
  'node_modules',
  'dist',
  'build',
  'test-results',
  'undefined',
]);

const ROOT_DIR_IGNORES = new Set(['css', 'test', 'tests', 'dist', 'build', 'conf', 'lang', 'enum', 'assets']);
const PARSEABLE_EXTS = new Set(['.js', '.jsx', '.html', '.css', '.json', '.txt', '.yml', '.yaml', '.xml', '.xsd']);

for (const dir of [scansDir, symbolsDir, graphDir, modulesDir, reportsDir, repomixDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeRel(value) {
  return value.replace(/\\/g, '/');
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function pathIfExists(absPath) {
  return fs.existsSync(absPath) ? absPath : null;
}

function relIfExists(absPath) {
  return absPath && fs.existsSync(absPath) ? normalizeRel(path.relative(sourceRoot, absPath)) : null;
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function walk(dir, outDirs, outFiles) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const abs = path.join(dir, entry.name);
    const rel = normalizeRel(path.relative(sourceRoot, abs));
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      outDirs.push(rel);
      walk(abs, outDirs, outFiles);
      continue;
    }
    outFiles.push(rel);
  }
}

function discoverPackageRoots() {
  const roots = [];
  if (pathIfExists(path.join(sourceRoot, 'package.json')) && pathIfExists(path.join(sourceRoot, 'src'))) {
    roots.push('');
  }
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }
    const packageDir = path.join(sourceRoot, entry.name);
    if (pathIfExists(path.join(packageDir, 'package.json')) && pathIfExists(path.join(packageDir, 'src'))) {
      roots.push(entry.name);
    }
  }
  return uniqueSorted(roots);
}

function packageDirName(packageDir) {
  return packageDir ? path.basename(packageDir) : path.basename(sourceRoot);
}

function packageAliases(packageDir, pkg) {
  const aliases = new Set([packageDirName(packageDir)]);
  if (!pkg || !pkg.name) {
    return [...aliases];
  }

  aliases.add(pkg.name);
  const scoped = pkg.name.includes('/') ? pkg.name.split('/')[1] : pkg.name;
  aliases.add(scoped);

  if (scoped.includes('.')) {
    const parts = scoped.split('.');
    aliases.add(parts.slice(1).join('.'));
    aliases.add(parts[parts.length - 1]);
  }

  return [...aliases].filter(Boolean);
}

function findFeatureDirs(srcDir) {
  if (!fs.existsSync(srcDir)) return [];
  return fs.readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !ROOT_DIR_IGNORES.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function buildFeaturePackages(packageInfos) {
  const legacyFeaturesRoot = path.join(sourceRoot, 'src', 'cgt');
  if (fs.existsSync(legacyFeaturesRoot)) {
    return fs.readdirSync(legacyFeaturesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        feature: entry.name,
        package_dir: '',
        package_name: null,
        prefix: normalizeRel(path.join('src', 'cgt', entry.name)),
      }))
      .sort((a, b) => a.feature.localeCompare(b.feature));
  }

  return packageInfos
    .filter((info) => info.dirName.startsWith('cgt-'))
    .flatMap((info) => findFeatureDirs(path.join(sourceRoot, info.package_dir, 'src')).map((feature) => ({
      feature,
      package_dir: info.package_dir,
      package_name: info.package_json && info.package_json.name ? info.package_json.name : info.dirName,
      prefix: normalizeRel(path.join(info.package_dir, 'src', feature)),
    })))
    .sort((a, b) => a.feature.localeCompare(b.feature));
}

function buildAliasMap(packageInfos) {
  const aliasMap = new Map();
  for (const info of packageInfos) {
    for (const alias of info.aliases) {
      aliasMap.set(alias, info.package_dir);
    }
  }
  return aliasMap;
}

function resolvePackageImport(importPath, baseFileRel, aliasMap) {
  if (!importPath) return null;
  const normalized = normalizeRel(importPath).replace(/\/+$/, '');

  if (normalized.startsWith('@telefonica/')) {
    const withoutScope = normalized.slice('@telefonica/'.length);
    const slashIndex = withoutScope.indexOf('/');
    const packageToken = slashIndex === -1 ? withoutScope : withoutScope.slice(0, slashIndex);
    const subPath = slashIndex === -1 ? '' : withoutScope.slice(slashIndex + 1);
    const candidates = uniqueSorted([
      packageToken,
      packageToken.includes('.') ? packageToken.split('.').slice(1).join('.') : null,
      packageToken.includes('.') ? packageToken.split('.').slice(-1)[0] : null,
    ]);
    for (const candidate of candidates) {
      if (!aliasMap.has(candidate)) continue;
      const packageDir = aliasMap.get(candidate);
      const relPath = normalizeRel(path.join(packageDir, subPath));
      return fs.existsSync(path.join(sourceRoot, relPath)) ? relPath : relPath;
    }
    return normalized;
  }

  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    const baseDir = normalizeRel(path.dirname(baseFileRel));
    const relPath = normalizeRel(path.normalize(path.join(baseDir, normalized)));
    return fs.existsSync(path.join(sourceRoot, relPath)) ? relPath : relPath;
  }

  if (normalized.startsWith('src/')) {
    return normalized;
  }

  return normalized;
}

function inferFeatureFromPath(relPath) {
  if (!relPath || relPath.startsWith('@telefonica/')) return null;

  const legacyMatch = relPath.match(/(?:^|\/)src\/cgt\/([^/]+)/);
  if (legacyMatch) return legacyMatch[1];

  const moduleMatch = relPath.match(/(?:^|\/)src\/([^/]+)(?:\/|$)/);
  if (moduleMatch && !ROOT_DIR_IGNORES.has(moduleMatch[1])) {
    return moduleMatch[1];
  }

  return null;
}

function collectRoutes(appSource, appRelPath, aliasMap) {
  const routes = [];
  const stateStartRegex = /\.state\(\s*['"]([^'"]+)['"]\s*,\s*{/g;
  const matches = [...appSource.matchAll(stateStartRegex)];

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const blockStart = match.index;
    const blockEnd = index + 1 < matches.length ? matches[index + 1].index : appSource.length;
    const block = appSource.slice(blockStart, blockEnd);
    const templateRaw = (block.match(/template:\s*require\(['"](.+?)['"]\)/) || [])[1] || null;
    const template = templateRaw ? resolvePackageImport(templateRaw, appRelPath, aliasMap) : null;
    const lazyContexts = uniqueSorted(
      [...block.matchAll(/require\.context\(\s*['"](.+?)['"]/g)].map((item) =>
        resolvePackageImport(item[1], appRelPath, aliasMap)
      )
    );

    routes.push({
      state: match[1],
      url: (block.match(/url:\s*['"]([^'"]+)['"]/) || [])[1] || null,
      template,
      lazy_contexts: lazyContexts,
      feature: inferFeatureFromPath(template) || lazyContexts.map(inferFeatureFromPath).find(Boolean) || null,
    });
  }

  return routes;
}

function collectCssDependencies(indexSource, indexRelPath, aliasMap) {
  return uniqueSorted(
    [...indexSource.matchAll(/require\(\s*['"]([^'"]+?)['"]\s*\)/g)]
      .map((item) => resolvePackageImport(item[1], indexRelPath, aliasMap))
      .filter((value) => value && (value.endsWith('.css') || value.includes('static')))
  );
}

function classifyFile(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if (ext === '.txt') return 'annotated_files';
  if (ext === '.json' && /\/lang\/.+\.json$/i.test(relPath)) return 'i18n_files';
  if (ext === '.json' && /\/enum\/.+\.json$/i.test(relPath)) return 'enum_files';
  if (/\/(?:test|tests)\//i.test(relPath) || /\.spec\.js$/i.test(relPath) || /Spec\.js$/i.test(relPath)) return 'test_files';
  if (/\/conf\/(?:mocks|records)\//i.test(relPath)) return 'mock_files';
  if (/(^|\/)conf\//i.test(relPath) || path.basename(relPath) === 'package.json' || ['.yml', '.yaml', '.xml', '.xsd'].includes(ext)) {
    return 'config_files';
  }
  return 'source_files';
}

function languageName(ext) {
  const map = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.html': 'html',
    '.css': 'css',
    '.json': 'json',
    '.txt': 'text',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.xml': 'xml',
    '.xsd': 'xml',
  };
  return map[ext] || ext.replace(/^\./, '') || 'unknown';
}

const directories = [];
const files = [];
walk(sourceRoot, directories, files);

const packageRoots = discoverPackageRoots();
const packageInfos = packageRoots.map((packageDir) => {
  const absPackageDir = packageDir ? path.join(sourceRoot, packageDir) : sourceRoot;
  const packageJson = readJsonIfExists(path.join(absPackageDir, 'package.json'));
  return {
    package_dir: packageDir,
    dirName: packageDirName(packageDir),
    package_json: packageJson,
    aliases: packageAliases(packageDir, packageJson),
  };
});

const aliasMap = buildAliasMap(packageInfos);
const featurePackages = buildFeaturePackages(packageInfos);

const containerInfo =
  packageInfos.find((info) => info.dirName.startsWith('cnt-')) ||
  packageInfos.find((info) => info.package_json && /(?:^|\/).+\.cnt-/.test(info.package_json.name || '')) ||
  null;

const containerDir = containerInfo ? containerInfo.package_dir : '';
const appRelPath = relIfExists(path.join(sourceRoot, containerDir, 'src', 'app.js')) || 'src/app.js';
const indexRelPath = relIfExists(path.join(sourceRoot, containerDir, 'src', 'index.js')) || 'src/index.js';
const indexSource = readIfExists(path.join(sourceRoot, indexRelPath));
const appSource = readIfExists(path.join(sourceRoot, appRelPath));

const parseableFiles = files.filter((file) => PARSEABLE_EXTS.has(path.extname(file).toLowerCase()));
const fileArrays = {
  source_files: [],
  test_files: [],
  config_files: [],
  mock_files: [],
  i18n_files: [],
  enum_files: [],
  annotated_files: [],
};

for (const relPath of parseableFiles) {
  fileArrays[classifyFile(relPath)].push(relPath);
}

for (const key of Object.keys(fileArrays)) {
  fileArrays[key] = uniqueSorted(fileArrays[key]);
}

const extCounts = new Map();
for (const relPath of parseableFiles) {
  const ext = path.extname(relPath).toLowerCase();
  extCounts.set(ext, (extCounts.get(ext) || 0) + 1);
}

const languages = [...extCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([ext, count]) => ({
    language: languageName(ext),
    files: count,
    extensions: [ext],
    confidence: 'high',
  }));

const frameworks = uniqueSorted(
  ['angularjs']
    .concat(indexSource.includes('ui.router') || appSource.includes('$stateProvider') ? ['ui-router'] : [])
    .concat(indexSource.includes('oc.lazyLoad') || appSource.includes('$ocLazyLoad') ? ['ocLazyLoad'] : [])
    .concat(indexSource.includes('gettext') || appSource.includes('gettextCatalog') ? ['gettext'] : [])
);

const manifestsFound = uniqueSorted(packageRoots.map((packageDir) => normalizeRel(path.join(packageDir, 'package.json'))));
const entryPoints = uniqueSorted([
  relIfExists(path.join(sourceRoot, containerDir, 'src', 'index.js')),
  relIfExists(path.join(sourceRoot, containerDir, 'src', 'app.js')),
  relIfExists(path.join(sourceRoot, containerDir, 'src', 'index.html')),
].filter(Boolean));

const containerPackage = containerInfo && containerInfo.package_json ? containerInfo.package_json : null;
const contextRoot =
  containerPackage &&
  containerPackage.telefonica &&
  containerPackage.telefonica.despliegue &&
  containerPackage.telefonica.despliegue.contextRoot
    ? containerPackage.telefonica.despliegue.contextRoot.replace(/^\//, '')
    : null;

const manifest = {
  version: 2,
  module_slug: slug,
  scanned_at: now,
  root: sourceRoot,
  frameworks,
  framework_details: {
    framework: 'AngularJS',
    module_name:
      (indexSource.match(/name:\s*['"]([^'"]+)['"]/) || [])[1] ||
      (containerPackage && containerPackage.name) ||
      slug,
    css_dependencies: collectCssDependencies(indexSource, indexRelPath, aliasMap),
    container_package: containerDir || null,
  },
  manifests_found: manifestsFound,
  entry_points: entryPoints,
  routes: collectRoutes(appSource, appRelPath, aliasMap),
  features: featurePackages.map((item) => item.feature),
  feature_packages: featurePackages,
  package_roots: packageRoots,
  platform_services: [],
  api_endpoints: [],
  languages,
  directories: {
    total: directories.length + 1,
    source: uniqueSorted(featurePackages.map((item) => `${item.prefix}/`).concat(entryPoints.length ? [normalizeRel(path.join(containerDir, 'src/'))] : ['src/'])),
    test: ['**/test/', '**/tests/', '**/*.spec.js', '**/*Spec.js'],
    config: uniqueSorted(packageRoots.map((item) => normalizeRel(path.join(item, 'conf/'))).filter((item) => item !== 'conf/' || fs.existsSync(path.join(sourceRoot, 'conf')))),
    excluded: ['dist/', 'test-results/', 'undefined/', 'node_modules/'],
  },
  total_files: parseableFiles.length,
  user_context: `full pipeline for ${slug}`,
  exclusions: ['dist', 'test-results', 'undefined', 'node_modules'],
  files: fileArrays,
};

const statePath = path.join(scansDir, 'state.json');
let state = { version: 1, module_slug: slug, pipeline: {}, file_hashes: {} };
if (fs.existsSync(statePath)) {
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    state = { version: 1, module_slug: slug, pipeline: {}, file_hashes: {} };
  }
}
state.version = 1;
state.module_slug = slug;
state.pipeline = state.pipeline || {};
state.pipeline.scan = {
  status: 'completed',
  completed_at: now,
  root: sourceRoot,
  total_files: parseableFiles.length,
};

let registry = { modules: {} };
if (fs.existsSync(registryPath)) {
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    registry = { modules: {} };
  }
}
registry.modules = registry.modules || {};
registry.modules[slug] = {
  label:
    (containerPackage &&
      containerPackage.telefonica &&
      containerPackage.telefonica.despliegue &&
      containerPackage.telefonica.despliegue.name) ||
    (containerPackage && containerPackage.description) ||
    slug,
  source_root: sourceRoot,
  app_url: contextRoot ? `http://localhost:3000/${contextRoot}` : null,
  artifacts: {
    scan_manifest: `scans/${slug}/scan-manifest.json`,
    state: `scans/${slug}/state.json`,
    symbols: `symbols/${slug}/index.json`,
    graph: `graph/${slug}/edges.json`,
    modules: `modules/${slug}/`,
    reports: `reports/${slug}/`,
    repomix: `scans/${slug}/repomix-output.xml`,
  },
  scanned_at: now,
};

fs.writeFileSync(path.join(scansDir, 'scan-manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

console.log(JSON.stringify({
  slug,
  root: sourceRoot,
  total_files: manifest.total_files,
  features: manifest.features,
  frameworks: manifest.frameworks,
  routes: manifest.routes.length,
  manifest: path.join('.discovery/code', 'scans', slug, 'scan-manifest.json'),
}, null, 2));
