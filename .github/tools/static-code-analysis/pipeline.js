#!/usr/bin/env node
/**
 * SCA Pipeline — deterministic orchestrator for all extraction tools.
 *
 * Runs the full static code analysis pipeline in order:
 *   1. scan-repo.js       → scan-manifest.json
 *   2. batch-extract-all.js → symbols/*.json + index.json
 *   3. angularjs-resolve.js → resolver-angularjs.json (if AngularJS detected)
 *   4. build-graph.js      → graph/SLUG/edges.json
 *   5. generate-modules-reports.js → modules/SLUG/*.json + reports/SLUG/*.md
 *
 * Usage:
 *   node .github/tools/static-code-analysis/pipeline.js <SOURCE_DIR> <SLUG>
 *   node .github/tools/static-code-analysis/pipeline.js   (uses defaults from scan-manifest)
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = process.cwd();
const toolsDir = path.join(repoRoot, '.github', 'tools', 'static-code-analysis');
const sourceDir = process.argv[2] || '';
const slugArg = process.argv[3] || '';

if (!sourceDir) {
  console.error('Usage: node pipeline.js <SOURCE_DIR> [SLUG]');
  process.exit(1);
}

const slug = slugArg || path.basename(sourceDir);

function run(label, script, args) {
  const scriptPath = path.join(toolsDir, script);
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ ${label}: script not found: ${scriptPath}`);
    process.exit(1);
  }
  console.log(`\n⏳ ${label}...`);
  const start = Date.now();
  try {
    const output = execFileSync('node', [scriptPath, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit'],
      maxBuffer: 50 * 1024 * 1024,
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    // Parse JSON output if available
    try {
      const result = JSON.parse(output);
      console.log(`✅ ${label} (${elapsed}s)`, JSON.stringify(result, null, 2).slice(0, 500));
    } catch (_) {
      console.log(`✅ ${label} (${elapsed}s)`);
    }
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`❌ ${label} failed (${elapsed}s): ${err.message}`);
    process.exit(1);
  }
}

// ── Step 1: Scan repo ─────────────────────────────────────────────
run('Scan repo', 'scan-repo.js', [sourceDir, slug]);

// ── Step 2: Extract symbols ───────────────────────────────────────
run('Extract symbols', 'batch-extract-all.js', [slug]);

// ── Step 3: AngularJS resolver (if detected) ──────────────────────
const manifestPath = path.join(repoRoot, '.discovery/code', 'scans', slug, 'scan-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const frameworks = (manifest.frameworks || []).map(f => f.toLowerCase());
  if (frameworks.some(f => f.includes('angularjs') || f.includes('angular.js') || f.includes('angular 1'))) {
    run('AngularJS resolver', 'angularjs-resolve.js', [slug]);
  } else {
    console.log('\n⏭️  AngularJS resolver: skipped (not an AngularJS project)');
  }
} else {
  console.log('\n⚠️  No scan-manifest.json found — skipping resolver');
}

// ── Step 4: Build graph ───────────────────────────────────────────
run('Build graph', 'build-graph.js', [slug]);

// ── Step 5: Generate module reports ───────────────────────────────
run('Generate modules & reports', 'generate-modules-reports.js', [slug]);

// ── Summary ───────────────────────────────────────────────────────
const scaRoot = path.join(repoRoot, '.discovery/code');
const stats = {
  slug,
  symbols: fs.readdirSync(path.join(scaRoot, 'symbols', slug)).filter(f => f.endsWith('.json') && f !== 'index.json').length,
  features: fs.readdirSync(path.join(scaRoot, 'modules', slug)).filter(f => f.endsWith('.json')).length,
  reports: fs.readdirSync(path.join(scaRoot, 'reports', slug)).filter(f => f.endsWith('.md')).length,
};

try {
  const edges = JSON.parse(fs.readFileSync(path.join(scaRoot, 'graph', slug, 'edges.json'), 'utf8'));
  stats.edges = edges.total_edges;
  stats.edge_types = edges.by_type;
} catch (_) {}

console.log('\n══════════════════════════════════════════');
console.log('✅ SCA Pipeline complete');
console.log(JSON.stringify(stats, null, 2));
