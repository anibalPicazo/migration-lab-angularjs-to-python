#!/usr/bin/env node
/**
 * Record videos of observation flows using Playwright's programmatic recordVideo API.
 *
 * Reads sitemap + flow JSONs from .discovery/runtime/, replays navigation/interactions,
 * and records a .webm video for each flow.
 *
 * Usage:
 *   node .github/tools/observation/record-discovery-runtime-videos.js [baseUrl] [slug]
 *
 * Defaults:
 *   baseUrl = http://localhost:3000
 *   slug    = first module in .discovery/runtime/observations/
 *
 * Output:
 *   .discovery/runtime/observations/<slug>/videos/<flow-name>.webm
 *
 * Requires: playwright (npm install playwright), ffmpeg
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OBS_DIR = path.join(ROOT, '.discovery/runtime');

async function main() {
  const baseUrl = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
  let slug = process.argv[3];

  // Derive the observation directory name from the APP_URL path
  // e.g. "http://localhost:3002/tran-adequacyTRAN" → "tran-adequacyTRAN"
  const urlPath = new URL(baseUrl).pathname.replace(/^\/|\/$/g, '');
  const obsSlug = urlPath || slug;

  // Auto-detect slug from existing observation directories
  if (!obsSlug) {
    const obsDir = path.join(OBS_DIR, 'observations');
    if (!fs.existsSync(obsDir)) {
      console.log('No .discovery/runtime/observations/ directory yet — skipping video recording.');
      process.exit(0);
    }
    const dirs = fs.readdirSync(obsDir).filter(d =>
      fs.statSync(path.join(obsDir, d)).isDirectory()
    );
    if (dirs.length === 0) {
      console.log('No module directories in .discovery/runtime/observations/ yet — skipping video recording.');
      process.exit(0);
    }
    slug = dirs[0];
    console.log(`Auto-detected module: ${slug}`);
  }

  // appBase is the full app URL (no slug appending — baseUrl already includes the path)
  const appBase = baseUrl;
  // Observation directories use the URL-derived name, not the module slug
  const dirName = obsSlug || slug;
  // Flows are stored in .requirement/<obs-slug>/flows/, using the same name as the observation dir
  const reqSlug = dirName || slug;
  const flowsDir = path.join(ROOT, '.requirement', reqSlug, 'flows');
  const videosDir = path.join(OBS_DIR, 'observations', dirName, 'videos');

  if (!fs.existsSync(flowsDir)) {
    console.log(`No flows directory yet: ${flowsDir} — skipping video recording.`);
    process.exit(0);
  }

  // Clean previous videos
  if (fs.existsSync(videosDir)) {
    for (const f of fs.readdirSync(videosDir)) {
      fs.unlinkSync(path.join(videosDir, f));
    }
  }
  fs.mkdirSync(videosDir, { recursive: true });

  // Read all flow files (skip flows-index.json which is just a manifest)
  const flowFiles = fs.readdirSync(flowsDir)
    .filter(f => f.endsWith('.json') && f !== 'flows-index.json');
  console.log(`Found ${flowFiles.length} flows to record.`);

  // Read sitemap
  const sitemapPath = path.join(OBS_DIR, 'observations', dirName, 'sitemap.json');
  let sitemap = null;
  if (fs.existsSync(sitemapPath)) {
    sitemap = JSON.parse(fs.readFileSync(sitemapPath, 'utf-8'));
  }

  const browser = await chromium.launch({ headless: true });

  // ── Helper: build URL from a sitemap route ──
  // Routes look like: "/", "/#!/consultMarks", "/#!/navigationAdequacyTRAN"
  function routeToUrl(route) {
    if (!route || route === '/') return appBase + '/';
    // Route is like /#!/foo — append to appBase
    return appBase + route;
  }

  // ── Pacing: seconds to pause between steps so videos are readable ──
  const PACE = {
    warmup:   2500,   // initial app load
    navigate: 3000,   // after each page navigation
    click:    2500,   // after a click action
    select:   1500,   // after a dropdown select
    fill:     1000,   // after filling an input
    pause:    2500,   // generic step pause
    sitemap:  3500,   // pause per sitemap page
    final:    3000,   // pause before closing video
  };

  // ── Helper: create context with video recording + navigate to app to warm up ──
  async function createRecordingContext() {
    const ctx = await browser.newContext({
      recordVideo: { dir: videosDir, size: { width: 1280, height: 720 } },
      viewport: { width: 1280, height: 720 },
    });
    const page = await ctx.newPage();
    // Navigate to app root first to ensure AngularJS bootstraps
    await safeGoto(page, appBase + '/');
    await page.waitForTimeout(PACE.warmup);
    await dismissModals(page);
    return { ctx, page };
  }

  // ── Helper: safe navigation ──
  async function safeGoto(page, url) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    } catch {
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 10000 });
      } catch { /* last resort — page may have loaded anyway */ }
    }
  }

  // ── Helper: safe click ──
  async function safeClick(page, selector) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector, { timeout: 5000 });
    } catch {
      // Try broader selectors
      try { await page.click(`text="${selector}"`, { timeout: 3000 }); } catch { /* ignore */ }
    }
  }

  // ── Helper: safe select ──
  async function safeSelect(page, selector, value) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.selectOption(selector, value, { timeout: 5000 });
    } catch { /* ignore */ }
  }

  // ── Helper: save video with name ──
  async function saveVideo(page, ctx, name) {
    await page.waitForTimeout(PACE.final); // let final state render
    const videoObj = page.video();
    await page.close();
    await ctx.close();
    if (videoObj) {
      const tmpPath = await videoObj.path();
      if (tmpPath && fs.existsSync(tmpPath)) {
        const dest = path.join(videosDir, `${name}.webm`);
        fs.copyFileSync(tmpPath, dest);
        // Clean up Playwright's auto-generated file
        try { fs.unlinkSync(tmpPath); } catch {}
        console.log(`  ✅ Saved: ${name}.webm`);
        return;
      }
    }
    console.log(`  ⚠️  No video captured for ${name}`);
  }

  // ═══════════════════════════════════════════════════
  // 1. Record sitemap walkthrough
  // ═══════════════════════════════════════════════════
  if (sitemap && sitemap.pages && sitemap.pages.length > 0) {
    console.log(`\nRecording sitemap walkthrough (${sitemap.pages.length} pages)...`);
    const { ctx, page } = await createRecordingContext();

    for (const p of sitemap.pages) {
      const url = routeToUrl(p.route);
      console.log(`  Navigating: ${p.route} → ${url}`);
      await safeGoto(page, url);
      await dismissModals(page);
      await page.waitForTimeout(PACE.sitemap);
    }

    await saveVideo(page, ctx, 'sitemap-walkthrough');
  }

  // ═══════════════════════════════════════════════════
  // 2. Record each flow
  // ═══════════════════════════════════════════════════
  for (const flowFile of flowFiles) {
    const flow = JSON.parse(fs.readFileSync(path.join(flowsDir, flowFile), 'utf-8'));
    const flowName = flowFile.replace(/\.json$/, '');
    const steps = flow.steps || [];

    if (steps.length === 0) {
      console.log(`\nSkipping flow: ${flowName} (no steps)`);
      continue;
    }

    console.log(`\nRecording flow: ${flowName} (${steps.length} steps)...`);
    const { ctx, page } = await createRecordingContext();

    for (const step of steps) {
      const action = (step.action || '').toLowerCase();
      const stepNum = step.step ?? '?';

      // ── navigate ──
      if (action === 'navigate' || action.includes('navigate')) {
        // Use step.url (full URL) if available, otherwise build from route
        let url = step.url || step.final_url || '';
        if (!url) {
          const target = step.target || step.route || '';
          url = target.startsWith('http') ? target : routeToUrl(target);
        }
        console.log(`  Step ${stepNum}: navigate → ${url}`);
        await safeGoto(page, url);
        await dismissModals(page);
        await page.waitForTimeout(PACE.navigate);

        // Compound actions like "navigate+select+click"
        if (action.includes('select') && (step.selector || step.elements)) {
          // Try to select the entity dropdown if present
          await safeSelect(page, 'select#entidad', step.value || '1');
          await page.waitForTimeout(PACE.select);
        }
        if (action.includes('click')) {
          // Try clicking Aceptar or submit button
          await safeClick(page, 'button[type="submit"], button[name="name"], .btn-primary');
          await page.waitForTimeout(PACE.click);
        }
      }
      // ── select (dropdown) ──
      else if (action === 'select') {
        const sel = step.selector || 'select#entidad';
        const val = step.value || '';
        console.log(`  Step ${stepNum}: select ${sel} → "${val}"`);
        await safeSelect(page, sel, val);
        await page.waitForTimeout(PACE.select);
      }
      // ── click ──
      else if (action === 'click') {
        const sel = step.selector || step.label || '';
        console.log(`  Step ${stepNum}: click → ${sel || step.description || '?'}`);
        if (sel) {
          await safeClick(page, sel);
        } else if (step.label) {
          await safeClick(page, `text="${step.label}"`);
        }
        await page.waitForTimeout(PACE.click);
      }
      // ── fill ──
      else if (action === 'fill' || action === 'type') {
        const sel = step.selector || step.target || '';
        const val = step.value != null ? String(step.value) : '';
        console.log(`  Step ${stepNum}: fill ${sel} → "${val}"`);
        try {
          await page.waitForSelector(sel, { timeout: 5000 });
          await page.fill(sel, val);
        } catch { /* ignore */ }
        await page.waitForTimeout(PACE.fill);
      }
      // ── state_go (AngularJS state transition) ──
      else if (action === 'state_go') {
        const state = step.state || step.target || '';
        console.log(`  Step ${stepNum}: state_go → ${state}`);
        // Navigate to the state via hash route
        if (state) {
          const url = `${appBase}/#!/${state}`;
          await safeGoto(page, url);
          await page.waitForTimeout(PACE.navigate);
        }
      }
      // ── wait / observe / other ──
      else {
        console.log(`  Step ${stepNum}: ${action || 'pause'} — ${step.description || ''}`);
        await page.waitForTimeout(PACE.pause);
      }
    }

    await saveVideo(page, ctx, flowName);
  }

  await browser.close();

  // Count final videos
  const finalVids = fs.readdirSync(videosDir).filter(f => f.endsWith('.webm'));
  console.log(`\n🎬 Done! ${finalVids.length} videos in ${videosDir}`);
}

async function dismissModals(page) {
  try {
    await page.evaluate(() => {
      document.querySelectorAll('.caja-aviso, .modal, [role="dialog"], .modal-backdrop').forEach(n => n.remove());
    });
  } catch { /* ignore */ }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
