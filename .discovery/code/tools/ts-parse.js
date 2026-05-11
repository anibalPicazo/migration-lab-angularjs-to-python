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
    '.html': 'tree-sitter-html',
    '.css': 'tree-sitter-css',
    '.json': 'tree-sitter-json',
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
if (!filepath) {
    console.error('Usage: ts-parse.js <filepath>');
    process.exit(1);
}

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
const angularjs_registrations = [];
const html_elements = [];
const css_selectors = [];

// Symbol types to extract from AST
const SYMBOL_TYPES = new Set([
    'import_statement', 'import_declaration',
    'class_declaration', 'class_definition',
    'interface_declaration',
    'function_declaration', 'function_definition',
    'method_definition', 'method_declaration',
    'call_expression',
    'export_statement',
    'struct_type_declaration', 'type_declaration',
    'variable_declaration', 'lexical_declaration'
]);

// Extract AngularJS patterns from JS files
function extractAngularJS(node, source) {
    if (node.type === 'call_expression') {
        const callee = node.childForFieldName('function');
        if (!callee) return;

        const calleeText = source.substring(callee.startIndex, callee.endIndex);

        // Detect: angular.module('name', [...])
        if (calleeText.includes('angular.module')) {
            const args = node.childForFieldName('arguments');
            if (args && args.namedChildCount > 0) {
                const moduleName = args.namedChild(0);
                if (moduleName) {
                    angularjs_registrations.push({
                        type: 'module',
                        name: source.substring(moduleName.startIndex, moduleName.endIndex).replace(/['"]/g, ''),
                        line: node.startPosition.row + 1,
                        kind: 'angular_module'
                    });
                }
            }
        }

        // Detect: .service('Name', [...]), .controller('Name', [...]), .component('name', {...}), .filter('name', ...), .directive('name', ...)
        const chainPatterns = /\.(service|controller|component|filter|directive|factory|provider|config|run)\s*\(/;
        if (chainPatterns.test(calleeText)) {
            const match = calleeText.match(/\.(service|controller|component|filter|directive|factory|provider|config|run)/);
            if (match) {
                const type = match[1];
                const args = node.childForFieldName('arguments');
                if (args && args.namedChildCount > 0) {
                    const nameNode = args.namedChild(0);
                    if (nameNode) {
                        const name = source.substring(nameNode.startIndex, nameNode.endIndex).replace(/['"]/g, '');
                        angularjs_registrations.push({
                            type: type,
                            name: name,
                            line: node.startPosition.row + 1,
                            kind: 'angular_' + type
                        });
                    }
                }
            }
        }
    }
}

// Extract HTML elements and AngularJS directives
function extractHTML(node, source) {
    if (node.type === 'element') {
        const tagNode = node.childForFieldName('tag_name') || node.childForFieldName('start_tag')?.childForFieldName('tag_name');
        if (tagNode) {
            const tagName = source.substring(tagNode.startIndex, tagNode.endIndex);
            const attrs = {};

            // Extract attributes
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child.type === 'start_tag') {
                    for (let j = 0; j < child.childCount; j++) {
                        const attr = child.child(j);
                        if (attr.type === 'attribute') {
                            const attrName = attr.childForFieldName('name');
                            const attrValue = attr.childForFieldName('value');
                            if (attrName) {
                                const name = source.substring(attrName.startIndex, attrName.endIndex);
                                const value = attrValue ? source.substring(attrValue.startIndex, attrValue.endIndex).replace(/['"]/g, '') : '';
                                attrs[name] = value;
                            }
                        }
                    }
                }
            }

            html_elements.push({
                tag: tagName,
                line: node.startPosition.row + 1,
                attributes: attrs,
                kind: 'html_element',
                is_angular_component: tagName.includes('-') || tagName.startsWith('app-'),
                has_ng_directives: Object.keys(attrs).some(k => k.startsWith('ng-'))
            });
        }
    }
}

// Extract CSS selectors
function extractCSS(node, source) {
    if (node.type === 'rule_set') {
        const selectors = node.childForFieldName('selectors');
        if (selectors) {
            const selectorText = source.substring(selectors.startIndex, selectors.endIndex);
            css_selectors.push({
                selector: selectorText.trim(),
                line: node.startPosition.row + 1,
                kind: 'css_selector'
            });
        }
    }
    if (node.type === 'class_selector') {
        const className = source.substring(node.startIndex, node.endIndex);
        css_selectors.push({
            selector: className,
            line: node.startPosition.row + 1,
            kind: 'css_class'
        });
    }
}

function walk(node, source) {
    // Standard symbol extraction
    if (SYMBOL_TYPES.has(node.type)) {
        const nameNode = node.childForFieldName('name') || node.firstNamedChild;
        const symbolName = nameNode ? nameNode.text : null;

        symbols.push({
            type: node.type,
            name: symbolName,
            start: node.startPosition.row + 1,
            end: node.endPosition.row + 1,
            text_preview: source.substring(node.startIndex, Math.min(node.startIndex + 200, node.endIndex))
        });
    }

    // Framework-specific extraction
    if (ext === '.js' || ext === '.jsx') {
        extractAngularJS(node, source);
    } else if (ext === '.html') {
        extractHTML(node, source);
    } else if (ext === '.css') {
        extractCSS(node, source);
    }

    // Recurse
    for (let i = 0; i < node.childCount; i++) {
        walk(node.child(i), source);
    }
}

walk(tree.rootNode, source);

const output = {
    file: filepath,
    language: ext,
    symbols
};

// Add framework-specific arrays only if they have data
if (angularjs_registrations.length > 0) output.angularjs_registrations = angularjs_registrations;
if (html_elements.length > 0) output.html_elements = html_elements;
if (css_selectors.length > 0) output.css_selectors = css_selectors;

console.log(JSON.stringify(output, null, 2));
