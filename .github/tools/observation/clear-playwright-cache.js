#!/usr/bin/env node
/**
 * Clear Playwright MCP browser profile cache.
 *
 * Removes Cache, Code Cache, GPUCache, and Service Worker data from
 * the persistent MCP browser profiles in ~/Library/Caches/ms-playwright/mcp-*.
 *
 * Usage:
 *   node .github/tools/observation/clear-playwright-cache.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_BASE = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');

function rmDirSync(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }
  return false;
}

function main() {
  if (!fs.existsSync(CACHE_BASE)) {
    console.log('No Playwright cache directory found — nothing to clear.');
    process.exit(0);
  }

  const CACHE_SUBDIRS = ['Cache', 'Code Cache', 'GPUCache', 'Service Worker', 'Session Storage', 'Local Storage'];
  let cleared = 0;

  const entries = fs.readdirSync(CACHE_BASE).filter(d =>
    d.startsWith('mcp-') && fs.statSync(path.join(CACHE_BASE, d)).isDirectory()
  );

  for (const profile of entries) {
    const defaultDir = path.join(CACHE_BASE, profile, 'Default');
    if (!fs.existsSync(defaultDir)) continue;

    for (const sub of CACHE_SUBDIRS) {
      const target = path.join(defaultDir, sub);
      if (rmDirSync(target)) {
        console.log(`  Cleared ${profile}/Default/${sub}`);
        cleared++;
      }
    }
  }

  if (cleared > 0) {
    console.log(`✅ Cleared ${cleared} cache directories from ${entries.length} MCP profile(s).`);
  } else {
    console.log('No cache directories found to clear.');
  }
}

main();
