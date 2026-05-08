#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const repoRoot = process.cwd();
const slug = process.argv[2] || 'adequacYTRANS';
const codebaseRoot = path.join(repoRoot, '.discovery/code');
const scanDir = path.join(codebaseRoot, 'scans', slug);
const symbolsDir = path.join(codebaseRoot, 'symbols', slug);
const manifestPath = path.join(scanDir, 'scan-manifest.json');
const statePath = path.join(scanDir, 'state.json');
const parserPath = path.join(repoRoot, '.github', 'tools', 'static-code-analysis', 'ts-parse.js');

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing manifest: ${manifestPath}`);
  process.exit(1);
}

fs.mkdirSync(symbolsDir, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const allFiles = [...new Set([
  ...(manifest.files.source_files || []),
  ...(manifest.files.test_files || []),
  ...(manifest.files.config_files || []),
  ...(manifest.files.mock_files || []),
  ...(manifest.files.i18n_files || []),
  ...(manifest.files.enum_files || []),
  ...(manifest.files.annotated_files || []),
])];

const stats = {
  total: allFiles.length,
  processed: 0,
  skipped: 0,
  failed: 0,
  failures: [],
  by_type: {},
  by_source: {
    'tree-sitter': 0,
    'deterministic-parse': 0,
    'text-extract': 0,
    resolver: 0,
    llm: 0,
  },
  symbols_total: 0,
};

function sha(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function getFileCategory(relPath) {
  if ((manifest.files.mock_files || []).includes(relPath)) return 'mock';
  if ((manifest.files.i18n_files || []).includes(relPath)) return 'i18n';
  if ((manifest.files.enum_files || []).includes(relPath)) return 'enum';
  if ((manifest.files.config_files || []).includes(relPath)) return 'config';
  if ((manifest.files.test_files || []).includes(relPath)) return 'test';
  if ((manifest.files.annotated_files || []).includes(relPath)) return 'annotated';
  return 'source';
}

function flattenEntries(value, prefix, depth, maxDepth) {
  const entries = [];
  if (depth > maxDepth) {
    return entries;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === 'object' && !Array.isArray(child) && depth < maxDepth) {
        entries.push(...flattenEntries(child, nextKey, depth + 1, maxDepth));
      } else {
        entries.push([nextKey, child]);
      }
    }
  }
  return entries;
}

function flattenKeys(value, prefix) {
  let keys = [];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        keys = keys.concat(flattenKeys(child, nextKey));
      } else {
        keys.push(nextKey);
      }
    }
  }
  return keys;
}

function extractSchema(value, depth, maxDepth) {
  if (depth >= maxDepth) {
    return Array.isArray(value) ? 'array' : typeof value;
  }
  if (Array.isArray(value)) {
    return value.length ? [extractSchema(value[0], depth + 1, maxDepth)] : [];
  }
  if (value && typeof value === 'object') {
    const schema = {};
    for (const [key, child] of Object.entries(value)) {
      schema[key] = extractSchema(child, depth + 1, maxDepth);
    }
    return schema;
  }
  return typeof value;
}

function parseJSON(absPath, relPath, category) {
  try {
    const raw = fs.readFileSync(absPath, 'utf8');
    const data = JSON.parse(raw);
    const symbols = [];
    if (category === 'mock') {
      symbols.push({
        name: path.basename(relPath, '.json'),
        kind: 'api_response_schema',
        type: 'api_response_schema',
        file: relPath,
        line: 1,
        confidence: 'high',
        source: 'deterministic-parse',
        schema: extractSchema(data, 0, 3),
      });
    } else if (category === 'i18n') {
      for (const key of flattenKeys(data, '')) {
        symbols.push({
          name: key,
          kind: 'i18n_key',
          type: 'i18n_key',
          file: relPath,
          line: 1,
          confidence: 'high',
          source: 'deterministic-parse',
        });
      }
    } else if (category === 'enum') {
      for (const [key, value] of flattenEntries(data, '', 0, 1)) {
        symbols.push({
          name: key,
          kind: 'enum_value',
          type: 'enum_value',
          value: typeof value === 'object' ? JSON.stringify(value).slice(0, 200) : String(value),
          file: relPath,
          line: 1,
          confidence: 'high',
          source: 'deterministic-parse',
        });
      }
    } else {
      for (const [key, value] of flattenEntries(data, '', 0, 2)) {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value).slice(0, 200);
        const isEndpoint = typeof value === 'string' && (value.startsWith('http') || value.startsWith('/') || key.toLowerCase().includes('url') || key.toLowerCase().includes('endpoint'));
        symbols.push({
          name: key,
          kind: isEndpoint ? 'endpoint_url' : 'config_entry',
          type: isEndpoint ? 'endpoint_url' : 'config_entry',
          value: stringValue,
          file: relPath,
          line: 1,
          confidence: 'high',
          source: 'deterministic-parse',
        });
      }
    }
    return { symbols, source: 'deterministic-parse' };
  } catch (error) {
    return {
      symbols: [{
        name: path.basename(relPath),
        kind: 'raw_json_text',
        type: 'raw_json_text',
        file: relPath,
        line: 1,
        confidence: 'medium',
        source: 'text-extract',
        error: error.message,
      }],
      source: 'text-extract',
    };
  }
}

function parseTXT(absPath, relPath) {
  const content = fs.readFileSync(absPath, 'utf8');
  const lines = content.split('\n');
  const symbols = [{
    name: path.basename(relPath),
    kind: 'annotated_file',
    type: 'annotated_file',
    file: relPath,
    line: 1,
    end_line: lines.length,
    confidence: 'medium',
    source: 'text-extract',
  }];
  lines.forEach((line, index) => {
    const match = line.match(/\/\/\s*(NOTA|NOTE|TODO|FIXME|IMPORTANT|REVIEW):\s*(.+)/i);
    if (match) {
      symbols.push({
        name: `${match[1]}: ${match[2].slice(0, 100)}`,
        kind: 'annotation',
        type: 'annotation',
        file: relPath,
        line: index + 1,
        confidence: 'medium',
        source: 'text-extract',
      });
    }
  });
  return { symbols, source: 'text-extract' };
}

function parseXML(absPath, relPath) {
  const content = fs.readFileSync(absPath, 'utf8');
  const symbols = [...new Set([...content.matchAll(/<([A-Za-z_][A-Za-z0-9_.:-]*)/g)].map((match) => match[1]))].map((name) => ({
    name,
    kind: 'xml_element',
    type: 'xml_element',
    file: relPath,
    line: 1,
    confidence: 'medium',
    source: 'deterministic-parse',
  }));
  return { symbols, source: 'deterministic-parse' };
}

function parseYAML(absPath, relPath) {
  const content = fs.readFileSync(absPath, 'utf8');
  return {
    symbols: [{
      name: path.basename(relPath),
      kind: 'yaml_config',
      type: 'yaml_config',
      file: relPath,
      line: 1,
      end_line: content.split('\n').length,
      confidence: 'medium',
      source: 'text-extract',
    }],
    source: 'text-extract',
  };
}

function parseTreeSitter(absPath) {
  try {
    const output = execFileSync(process.execPath, [parserPath, absPath], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    const parsed = JSON.parse(output);
    if (parsed.error) {
      return { error: parsed.error, source: 'tree-sitter', parsed };
    }
    return { parsed, source: 'tree-sitter' };
  } catch (error) {
    return { error: error.message.slice(0, 240), source: 'tree-sitter' };
  }
}

function normalizeTreeSitter(parsed, relPath, category) {
  const normalized = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const line = item.line || item.start || 1;
      const kind = item.kind || (key === 'symbols' ? String(item.type || 'unknown').replace(/_/g, '-') : key.replace(/_/g, '-'));
      const symbol = {
        id: `${relPath}::${kind}::${item.name || '(anonymous)'}:${line}`,
        name: item.name || '(anonymous)',
        kind,
        type: item.type || key,
        file: relPath,
        line,
        end_line: item.end || item.end_line || line,
        category,
        confidence: item.confidence || 'high',
        source: item.source || 'tree-sitter',
      };
      for (const [extraKey, extraValue] of Object.entries(item)) {
        if (!(extraKey in symbol) && !['start', 'end'].includes(extraKey)) {
          symbol[extraKey] = extraValue;
        }
      }
      normalized.push(symbol);
    }
  }
  return normalized;
}

function relativeSymbolPath(relPath) {
  return path.join(symbolsDir, `${sha(relPath).slice(0, 16)}.json`);
}

const allSymbols = [];
const parsedFiles = new Set();

for (const relPath of allFiles) {
  const absPath = path.join(manifest.root, relPath);
  const category = getFileCategory(relPath);
  const ext = path.extname(relPath).toLowerCase();
  stats.by_type[ext.replace(/^\./, '') || 'other'] = (stats.by_type[ext.replace(/^\./, '') || 'other'] || 0) + 1;

  if (!fs.existsSync(absPath)) {
    stats.failed++;
    stats.failures.push({ file: relPath, error: 'file-not-found' });
    continue;
  }

  let result;
  if (ext === '.json') {
    result = parseJSON(absPath, relPath, category);
  } else if (ext === '.txt') {
    result = parseTXT(absPath, relPath);
  } else if (ext === '.yml' || ext === '.yaml') {
    result = parseYAML(absPath, relPath);
  } else if (ext === '.xml' || ext === '.xsd') {
    result = parseXML(absPath, relPath);
  } else {
    result = parseTreeSitter(absPath);
  }

  if (result.error) {
    stats.failed++;
    stats.failures.push({ file: relPath, error: result.error });
    continue;
  }

  const symbols = result.parsed ? normalizeTreeSitter(result.parsed, relPath, category) : result.symbols.map((symbol, index) => ({
    id: symbol.id || `${relPath}::${symbol.kind || symbol.type}::${symbol.name || '(anonymous)'}:${symbol.line || 1}:${index}`,
    category,
    ...symbol,
  }));

  if (!result.parsed) {
    stats.by_source[result.source] += symbols.length;
  } else {
    stats.by_source['tree-sitter'] += symbols.length;
  }

  parsedFiles.add(relPath);
  stats.processed++;
  stats.symbols_total += symbols.length;
  allSymbols.push(...symbols);

  const fileOutput = {
    file: relPath,
    file_hash: `sha256:${sha(fs.readFileSync(absPath)).slice(0, 16)}`,
    category,
    language: ext.replace(/^\./, '') || 'unknown',
    parsed_at: new Date().toISOString(),
    parser: { primary: result.parsed ? 'tree-sitter' : result.source },
    symbols,
  };
  fs.writeFileSync(relativeSymbolPath(relPath), JSON.stringify(fileOutput, null, 2));
}

const missing = allFiles.filter((file) => !parsedFiles.has(file));
if (missing.length) {
  console.error(`Completeness failed: ${missing.length} files missing`);
  missing.forEach((file) => console.error(`  MISSING ${file}`));
  process.exit(2);
}

const supportedCount = allFiles.filter((file) => ['.js', '.jsx', '.html', '.css'].includes(path.extname(file).toLowerCase())).length;
if (supportedCount > 0 && stats.by_source['tree-sitter'] === 0) {
  console.error('Tree-sitter extraction produced 0 symbols for supported languages.');
  process.exit(3);
}

const byLanguage = {};
for (const relPath of allFiles) {
  const language = path.extname(relPath).toLowerCase().replace(/^\./, '') || 'unknown';
  byLanguage[language] = byLanguage[language] || { files: 0, symbols: 0 };
  byLanguage[language].files++;
}
for (const symbol of allSymbols) {
  const language = path.extname(symbol.file).toLowerCase().replace(/^\./, '') || 'unknown';
  byLanguage[language] = byLanguage[language] || { files: 0, symbols: 0 };
  byLanguage[language].symbols++;
}

const indexOutput = {
  version: 2,
  module_slug: slug,
  generated_at: new Date().toISOString(),
  total_files: stats.processed,
  total_symbols: allSymbols.length,
  by_source: stats.by_source,
  by_language: byLanguage,
  by_category: stats.by_type,
  symbols: allSymbols,
};

fs.writeFileSync(path.join(symbolsDir, 'index.json'), JSON.stringify(indexOutput, null, 2));

let state = { version: 1, module_slug: slug, pipeline: {}, file_hashes: {} };
if (fs.existsSync(statePath)) {
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    state = { version: 1, module_slug: slug, pipeline: {}, file_hashes: {} };
  }
}
state.pipeline = state.pipeline || {};
state.pipeline.extract_symbols = {
  status: 'completed',
  completed_at: new Date().toISOString(),
  total_files: stats.processed,
  total_symbols: allSymbols.length,
  by_source: stats.by_source,
};
state.file_hashes = state.file_hashes || {};
for (const relPath of allFiles) {
  const absPath = path.join(manifest.root, relPath);
  if (fs.existsSync(absPath)) {
    state.file_hashes[relPath] = sha(fs.readFileSync(absPath)).slice(0, 16);
  }
}
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

console.log(JSON.stringify({
  slug,
  stats,
  by_language: byLanguage,
  index: path.join('.discovery/code', 'symbols', slug, 'index.json'),
}, null, 2));
