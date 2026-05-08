#!/usr/bin/env node
/**
 * Observe running app using Playwright programmatic API.
 * Takes screenshots and captures DOM structure for all known routes.
 * Output: .discovery/runtime/observations/<slug>/
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
// Derive obs-slug from URL path (e.g. http://host/tran-adequacyTRAN → tran-adequacyTRAN)
const urlPath = new URL(BASE_URL).pathname.replace(/^\/|\/$/g, '');
const SLUG = process.argv[3] || urlPath || 'default';
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OBS_DIR = path.join(ROOT, '.discovery/runtime', 'observations', SLUG);
const SCREENSHOTS_DIR = path.join(OBS_DIR, 'screenshots');
const DOMS_DIR = path.join(OBS_DIR, 'doms');

// Routes to observe — loaded from sitemap.json if available, otherwise from CLI arg 4 (JSON file) or built-in defaults
function loadRoutes() {
  // 1. Try routes file from CLI arg 4
  const routesArg = process.argv[4];
  if (routesArg && fs.existsSync(routesArg)) {
    try {
      const routes = JSON.parse(fs.readFileSync(routesArg, 'utf8'));
      if (Array.isArray(routes)) return routes;
    } catch (_) {}
  }
  // 2. Try existing sitemap.json in OBS_DIR
  const sitemapPath = path.join(OBS_DIR, 'sitemap.json');
  if (fs.existsSync(sitemapPath)) {
    try {
      const sitemap = JSON.parse(fs.readFileSync(sitemapPath, 'utf8'));
      if (sitemap.pages && sitemap.pages.length > 0) {
        return sitemap.pages.map(p => ({ route: p.route, label: p.label || p.name, source: 'sitemap' }));
      }
    } catch (_) {}
  }
  // 3. Fallback: just observe root
  return [{ route: '/', label: 'Home / Root', source: 'default' }];
}

const KNOWN_ROUTES = loadRoutes();

function slugifyRoute(route) {
  return route.replace(/^\//, '').replace(/[#\/]/g, '-').replace(/^-/, '') || 'home';
}

async function extractPageData(page, route, label) {
  const title = await page.title().catch(() => '');
  const url = page.url();

  // Extract forms
  const forms = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('form')).map(form => ({
      action: form.action || '',
      method: form.method || 'get',
      fields: Array.from(form.querySelectorAll('input, select, textarea')).map(el => ({
        name: el.name || el.id || '',
        type: el.type || el.tagName.toLowerCase(),
        required: el.required || false,
        label: (() => {
          const lbl = document.querySelector(`label[for="${el.id}"]`);
          return lbl ? lbl.textContent.trim() : (el.placeholder || el.name || '');
        })(),
      })).filter(f => f.name || f.label),
    }));
  }).catch(() => []);

  // Extract buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'))
      .slice(0, 30)
      .map(el => ({
        label: (el.textContent || el.value || el.ariaLabel || '').trim().slice(0, 80),
        type: el.type || el.tagName.toLowerCase(),
      }))
      .filter(b => b.label);
  }).catch(() => []);

  // Extract tables
  const tables = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('table, [role="grid"]')).map(table => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = table.querySelectorAll('tr').length;
      return { headers: headers.slice(0, 10), row_count: rows };
    });
  }).catch(() => []);

  // Extract navigation links
  const links = await page.evaluate((baseUrl) => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 60) }))
      .filter(l => l.href && !l.href.endsWith('.css') && !l.href.endsWith('.js'))
      .filter(l => l.href.startsWith(baseUrl) || l.href.startsWith('#') || l.href.startsWith('/'))
      .slice(0, 50);
  }, BASE_URL).catch(() => []);

  // Extract CSS resources
  const cssResources = await page.evaluate(() => {
    const external = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => ({ type: 'link', href: l.href, source: 'head' }));
    const inline = Array.from(document.querySelectorAll('style'))
      .map(s => ({ type: 'inline', size_bytes: s.textContent.length, source: 'head' }));
    return [...external, ...inline];
  }).catch(() => []);

  // Design system detection from class names
  const designSystem = await page.evaluate(() => {
    const allClasses = new Set();
    document.querySelectorAll('[class]').forEach(el => {
      el.className.toString().split(/\s+/).forEach(c => c && allClasses.add(c));
    });
    const classArr = Array.from(allClasses);
    // Look for known Telefónica/DIMA patterns
    const prefixes = ['boton-', 'panel-', 'tabla_', 'cgt-', 't3-', 'dima-', 'at-', 'aei-'];
    const detected = prefixes.filter(p => classArr.some(c => c.startsWith(p)));
    return { detected: detected.length > 0, prefixes_found: detected, sample_classes: classArr.slice(0, 20) };
  }).catch(() => ({ detected: false, prefixes_found: [], sample_classes: [] }));

  // Check for tabs/accordions
  const tabs = await page.evaluate(() => {
    const tabEls = document.querySelectorAll('[role="tab"], .tab, .nav-tab, .tab-item');
    return Array.from(tabEls).map(t => t.textContent.trim()).filter(Boolean).slice(0, 10);
  }).catch(() => []);

  // Check for modals / dialogs
  const modals = await page.evaluate(() => {
    const modalEls = document.querySelectorAll('[role="dialog"], .modal, .dialog');
    return Array.from(modalEls).map(m => ({
      visible: window.getComputedStyle(m).display !== 'none',
      text: m.textContent.trim().slice(0, 100),
    })).filter(m => m.visible);
  }).catch(() => []);

  return { title, url, forms, buttons, tables, links, cssResources, designSystem, tabs, modals };
}

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(DOMS_DIR, { recursive: true });

  console.log(`\n🌐 Observing: ${BASE_URL}`);
  console.log(`📁 Output dir: ${OBS_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const sitemapPages = [];
  const allCssResources = [];
  let designSystemInfo = { detected: false };

  for (const routeInfo of KNOWN_ROUTES) {
    const fullUrl = BASE_URL.replace(/\/$/, '') + routeInfo.route;
    const screenshotName = slugifyRoute(routeInfo.route) + '.png';
    const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);

    console.log(`  → Visiting: ${fullUrl}`);

    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500); // Extra wait for SPA rendering

      // Take full-page screenshot
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`    📸 Screenshot: ${screenshotName}`);

      const data = await extractPageData(page, routeInfo.route, routeInfo.label);

      // Save DOM snapshots (HTML + JSON)
      const domSlug = slugifyRoute(routeInfo.route);
      const htmlContent = await page.content();
      fs.writeFileSync(path.join(DOMS_DIR, `${domSlug}.html`), htmlContent, 'utf8');
      fs.writeFileSync(path.join(DOMS_DIR, `${domSlug}.json`), JSON.stringify(data, null, 2), 'utf8');
      console.log(`    🗂️  DOM: ${domSlug}.html + ${domSlug}.json`);

      // Merge CSS resources (deduplicate)
      data.cssResources.forEach(r => {
        if (r.type === 'link' && !allCssResources.some(c => c.href === r.href)) {
          allCssResources.push(r);
        }
      });

      // Update design system info
      if (data.designSystem.detected) {
        designSystemInfo = {
          detected: true,
          prefixes_found: data.designSystem.prefixes_found,
          sample_classes: data.designSystem.sample_classes,
        };
      }

      sitemapPages.push({
        route: routeInfo.route,
        label: routeInfo.label,
        source: routeInfo.source,
        title: data.title,
        url: data.url,
        screenshot: `screenshots/${screenshotName}`,
        elements: {
          forms: data.forms,
          buttons: data.buttons.slice(0, 15),
          tables: data.tables,
          links: data.links.length,
          tabs: data.tabs,
          modals_visible: data.modals.length,
        },
        requires_auth: false,
      });

      console.log(`    ✓ title="${data.title}" forms=${data.forms.length} buttons=${data.buttons.length} tables=${data.tables.length} links=${data.links.length}`);

    } catch (err) {
      console.log(`    ✗ Error: ${err.message.split('\n')[0]}`);
      sitemapPages.push({
        route: routeInfo.route,
        label: routeInfo.label,
        source: routeInfo.source,
        error: err.message.split('\n')[0],
        screenshot: null,
        requires_auth: false,
      });
    }
  }

  await browser.close();

  // Build sitemap
  const sitemap = {
    base_url: BASE_URL,
    slug: SLUG,
    observed_at: new Date().toISOString(),
    total_pages: sitemapPages.filter(p => !p.error).length,
    total_routes_attempted: KNOWN_ROUTES.length,
    css_resources: allCssResources,
    design_system: {
      detected: designSystemInfo.detected,
      evidence: designSystemInfo.prefixes_found || [],
      sample_classes: (designSystemInfo.sample_classes || []).slice(0, 30),
    },
    routes_from_codebase: KNOWN_ROUTES.filter(r => r.source === 'codebase_routes').map(r => r.route),
    pages: sitemapPages,
    routes_not_visited: [],
  };

  const sitemapPath = path.join(OBS_DIR, 'sitemap.json');
  fs.writeFileSync(sitemapPath, JSON.stringify(sitemap, null, 2));
  console.log(`\n✅ Sitemap written: ${sitemapPath}`);

  // Summary
  const visited = sitemapPages.filter(p => !p.error).length;
  const failed = sitemapPages.filter(p => p.error).length;
  const totalForms = sitemapPages.reduce((n, p) => n + (p.elements?.forms?.length || 0), 0);
  const totalTables = sitemapPages.reduce((n, p) => n + (p.elements?.tables?.length || 0), 0);
  const totalButtons = sitemapPages.reduce((n, p) => n + (p.elements?.buttons?.length || 0), 0);

  console.log('\n📊 Observation Summary');
  console.log(`├── Pages visited: ${visited}/${KNOWN_ROUTES.length}`);
  if (failed > 0) console.log(`├── Errors: ${failed}`);
  console.log(`├── Forms found: ${totalForms}`);
  console.log(`├── Buttons found: ${totalButtons}`);
  console.log(`├── Tables found: ${totalTables}`);
  console.log(`├── CSS resources: ${allCssResources.length}`);
  console.log(`├── Design system detected: ${sitemap.design_system.detected}`);
  console.log(`├── Screenshots: ${SCREENSHOTS_DIR}`);
  console.log(`└── Sitemap: ${sitemapPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
