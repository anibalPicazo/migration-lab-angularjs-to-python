#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Parser = require('tree-sitter');

const GRAMMAR_MAP = {
  '.js': 'tree-sitter-javascript',
  '.jsx': 'tree-sitter-javascript',
  '.html': 'tree-sitter-html',
  '.css': 'tree-sitter-css',
};

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node ts-parse.js <filepath>');
  process.exit(1);
}

const ext = path.extname(filePath).toLowerCase();
const grammarName = GRAMMAR_MAP[ext];
if (!grammarName) {
  console.log(JSON.stringify({ error: 'no-grammar', ext }));
  process.exit(0);
}

function loadLanguage(moduleName) {
  const mod = require(moduleName);
  return mod.nodeTypeInfo ? mod : (mod.language || mod);
}

function lineOfIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

function preview(source, node) {
  return source.slice(node.startIndex, Math.min(node.startIndex + 220, node.endIndex)).replace(/\s+/g, ' ').trim();
}

function parseInSegments(parser, source) {
  try {
    return [{ tree: parser.parse(source), source, lineOffset: 0 }];
  } catch (error) {
    if (!/Invalid argument/i.test(String(error && error.message))) {
      throw error;
    }
  }

  const lines = source.split('\n');
  const segments = [];
  let chunk = [];
  let chunkSize = 0;
  let lineOffset = 0;

  function flush() {
    if (!chunk.length) return;
    const chunkSource = chunk.join('\n');
    segments.push({
      tree: parser.parse(chunkSource),
      source: chunkSource,
      lineOffset,
    });
    lineOffset += chunk.length;
    chunk = [];
    chunkSize = 0;
  }

  for (const line of lines) {
    if (chunkSize + line.length + 1 > 30000) {
      flush();
    }
    chunk.push(line);
    chunkSize += line.length + 1;
  }
  flush();
  return segments;
}

function extractJsSymbols(tree, source, lineOffset) {
  const symbolTypes = new Set([
    'function_declaration',
    'method_definition',
    'call_expression',
    'assignment_expression',
    'variable_declarator',
    'class_declaration',
  ]);
  const symbols = [];

  function getName(node) {
    if (node.type === 'call_expression') {
      const fnNode = node.childForFieldName('function') || node.firstNamedChild;
      return fnNode ? source.slice(fnNode.startIndex, fnNode.endIndex) : '(call)';
    }
    if (node.type === 'assignment_expression') {
      const leftNode = node.childForFieldName('left') || node.firstNamedChild;
      return leftNode ? source.slice(leftNode.startIndex, leftNode.endIndex) : '(assignment)';
    }
    if (node.type === 'variable_declarator') {
      const nameNode = node.childForFieldName('name') || node.firstNamedChild;
      return nameNode ? source.slice(nameNode.startIndex, nameNode.endIndex) : '(variable)';
    }
    const nameNode = node.childForFieldName('name') || node.firstNamedChild;
    return nameNode ? source.slice(nameNode.startIndex, nameNode.endIndex) : '(anonymous)';
  }

  function walk(node) {
    if (symbolTypes.has(node.type)) {
      symbols.push({
        type: node.type,
        name: getName(node),
        start: node.startPosition.row + 1 + lineOffset,
        end: node.endPosition.row + 1 + lineOffset,
        text_preview: preview(source, node),
      });
    }
    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i));
    }
  }

  walk(tree.rootNode);
  return symbols;
}

function extractAngularRegistrations(source) {
  const registrations = [];
  const withArray = /CNT\.ngModule\.(controller|factory|service|directive)\(\s*['"]([^'"]+)['"]\s*,\s*\[([\s\S]*?)function\s*\(([^)]*)\)/g;
  let match;
  while ((match = withArray.exec(source)) !== null) {
    const deps = [...match[3].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]);
    registrations.push({
      type: 'angular_registration',
      kind: 'angular_registration',
      registration_kind: match[1],
      name: match[2],
      di_dependencies: deps,
      function_params: match[4].split(',').map((item) => item.trim()).filter(Boolean),
      line: lineOfIndex(source, match.index),
      text_preview: match[0].slice(0, 220).replace(/\s+/g, ' ').trim(),
    });
  }

  const lifecycle = /CNT\.ngModule\.(run|config)\(\s*\[([\s\S]*?)function\s*\(([^)]*)\)/g;
  while ((match = lifecycle.exec(source)) !== null) {
    const deps = [...match[2].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]);
    registrations.push({
      type: 'angular_registration',
      kind: 'angular_registration',
      registration_kind: match[1],
      name: match[1],
      di_dependencies: deps,
      function_params: match[3].split(',').map((item) => item.trim()).filter(Boolean),
      line: lineOfIndex(source, match.index),
      text_preview: match[0].slice(0, 220).replace(/\s+/g, ' ').trim(),
    });
  }

  return registrations;
}

function extractScopeAssignments(source) {
  return [...source.matchAll(/\$scope\.([A-Za-z0-9_]+)\s*=\s*function\s*\(([^)]*)\)/g)].map((match) => ({
    type: 'scope_assignment',
    kind: 'scope_assignment',
    name: `$scope.${match[1]}`,
    scope_property: match[1],
    parameters: match[2].split(',').map((item) => item.trim()).filter(Boolean),
    line: lineOfIndex(source, match.index),
    text_preview: match[0].slice(0, 200).replace(/\s+/g, ' ').trim(),
  }));
}

function extractStateTransitions(source) {
  return [...source.matchAll(/\$state\.go\(\s*['"]([^'"]+)['"]/g)].map((match) => ({
    type: 'state_transition',
    kind: 'state_transition',
    name: match[1],
    line: lineOfIndex(source, match.index),
    text_preview: match[0],
  }));
}

function extractApiUrls(source) {
  return [...source.matchAll(/var\s+(URL_[A-Z0-9_]+)\s*=\s*['"]([^'"]+)['"]/g)].map((match) => ({
    type: 'api_url',
    kind: 'api_url',
    name: match[1],
    url_template: match[2],
    line: lineOfIndex(source, match.index),
    text_preview: match[0],
  }));
}

function extractHttpCalls(source, apiUrls) {
  const urlMap = Object.fromEntries(apiUrls.map((item) => [item.name, item.url_template]));
  return [...source.matchAll(/T3_HTTPService(?:\[['"]([A-Za-z]+)['"]\]|\.(get|post|put|delete))\s*\(\s*([A-Za-z0-9_]+)/g)].map((match) => ({
    type: 'http_call',
    kind: 'http_call',
    name: (match[1] || match[2] || 'get').toUpperCase(),
    http_method: (match[1] || match[2] || 'get').toUpperCase(),
    url_variable: match[3],
    url_template: urlMap[match[3]] || null,
    line: lineOfIndex(source, match.index),
    text_preview: match[0],
  }));
}

function extractRouteStates(source) {
  const routes = [];
  const stateStartRegex = /\.state\(\s*['"]([^'"]+)['"]\s*,\s*{/g;
  const matches = [...source.matchAll(stateStartRegex)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const block = source.slice(start, end);
    routes.push({
      type: 'route_state',
      kind: 'route_state',
      name: match[1],
      url: (block.match(/url:\s*['"]([^'"]+)['"]/) || [])[1] || null,
      template: (block.match(/template:\s*require\(['"](.+?)['"]\)/) || [])[1] || null,
      lazy_contexts: [...block.matchAll(/require\.context\(\s*['"](.+?)['"]/g)].map((item) => item[1]),
      line: lineOfIndex(source, start),
      text_preview: block.slice(0, 220).replace(/\s+/g, ' ').trim(),
    });
  }
  return routes;
}

function extractCssDependencies(source) {
  return [...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)]
    .map((match) => match[1])
    .filter((value) => value.endsWith('.css') || value.includes('static'))
    .map((value, index) => ({
      type: 'css_dependency',
      kind: 'css_dependency',
      name: value,
      line: index + 1,
    }));
}

function extractHtmlSymbols(tree, source, lineOffset) {
  const symbols = [];
  function walk(node) {
    if (node.type === 'element') {
      const openTag = node.childForFieldName('start_tag') || node.firstNamedChild;
      const name = openTag ? preview(source, openTag).split(/\s+/)[0].replace('<', '') : 'element';
      symbols.push({
        type: 'html_element',
        name,
        start: node.startPosition.row + 1 + lineOffset,
        end: node.endPosition.row + 1 + lineOffset,
        text_preview: preview(source, node),
      });
    }
    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i));
    }
  }
  walk(tree.rootNode);
  return symbols;
}

function extractHtmlBindings(source) {
  const bindings = [];
  const patterns = [
    { regex: /\b(?:data-)?ng-controller="([^"]+)"/g, kind: 'ng_controller' },
    { regex: /\b(?:data-)?ng-click="([^"]+)"/g, kind: 'ng_click' },
    { regex: /\b(?:data-)?ng-model="([^"]+)"/g, kind: 'ng_model' },
    { regex: /\b(?:data-)?ng-init="([^"]+)"/g, kind: 'ng_init' },
    { regex: /\bui-sref="([^"]+)"/g, kind: 'ui_sref' },
    { regex: /\bdata-translate>([^<]+)</g, kind: 'translate_key' },
  ];

  for (const { regex, kind } of patterns) {
    let match;
    while ((match = regex.exec(source)) !== null) {
      bindings.push({
        type: kind,
        kind,
        name: match[1].trim(),
        line: lineOfIndex(source, match.index),
        text_preview: match[0].slice(0, 180),
      });
    }
  }

  return bindings;
}

function extractCssSelectors(source) {
  return [...new Set([...source.matchAll(/\.([A-Za-z_-][A-Za-z0-9_-]*)/g)].map((match) => match[1]))].map((name) => ({
    type: 'css_selector',
    kind: 'css_selector',
    name,
    line: 1,
  }));
}

let language;
try {
  language = loadLanguage(grammarName);
} catch (error) {
  console.log(JSON.stringify({ error: 'grammar-not-installed', grammar: grammarName }));
  process.exit(0);
}

const parser = new Parser();
parser.setLanguage(language);

const source = fs.readFileSync(filePath, 'utf8');
const parsedSegments = parseInSegments(parser, source);
const output = {
  file: filePath,
  language: ext,
  symbols: [],
};

if (ext === '.js' || ext === '.jsx') {
  output.symbols = parsedSegments.flatMap((segment) => extractJsSymbols(segment.tree, segment.source, segment.lineOffset));
  output.angular_registrations = extractAngularRegistrations(source);
  output.scope_assignments = extractScopeAssignments(source);
  output.state_transitions = extractStateTransitions(source);
  output.api_urls = extractApiUrls(source);
  output.http_calls = extractHttpCalls(source, output.api_urls);
  output.route_states = path.basename(filePath) === 'app.js' ? extractRouteStates(source) : [];
  output.css_dependencies = path.basename(filePath) === 'index.js' ? extractCssDependencies(source) : [];
}

if (ext === '.html') {
  output.symbols = parsedSegments.flatMap((segment) => extractHtmlSymbols(segment.tree, segment.source, segment.lineOffset));
  output.ng_bindings = extractHtmlBindings(source);
}

if (ext === '.css') {
  output.symbols = extractCssSelectors(source);
}

console.log(JSON.stringify(output, null, 2));
