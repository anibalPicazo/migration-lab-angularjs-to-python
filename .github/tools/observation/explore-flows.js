#!/usr/bin/env node
/**
 * Explore user flows using Playwright programmatic API.
 * Records step-by-step interactions on each discovered flow.
 * Output: .requirement/<slug>/flows/flow-*.json + screenshots
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
// Derive obs-slug from URL path (e.g. http://host/tran-adequacyTRAN → tran-adequacyTRAN)
const urlPath = new URL(BASE_URL).pathname.replace(/^\/|\/$/g, '');
const SLUG = process.argv[3] || urlPath || 'default';
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FLOWS_DIR = path.join(ROOT, '.requirement', SLUG, 'flows');
const OBS_DIR = path.join(ROOT, '.discovery/runtime', 'observations', SLUG);
const SCREENSHOTS_DIR = path.join(OBS_DIR, 'screenshots');
const DOMS_DIR = path.join(OBS_DIR, 'doms');

fs.mkdirSync(FLOWS_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(DOMS_DIR, { recursive: true });

// Flow candidates discovered from source code analysis
const FLOW_CANDIDATES = [
  {
    name: 'navigation-adequacy-tran',
    label: 'Navigation Hub (navigationAdequacyTRAN)',
    route: '/#/navigationAdequacyTRAN',
    pattern: 'navigation',
    description: 'Landing page for the TRAN adequacy module - navigation menu and entry point',
  },
  {
    name: 'consult-marks-search',
    label: 'Consult Marks — Search & Filter',
    route: '/#/consultMarks',
    pattern: 'search-filter',
    description: 'Filter marks by ID, name, process ID, availability, customer visibility. Sort and paginate table.',
    interactions: [
      { action: 'fill', selector: 'input[name="id_F"]', value: 'TEST', label: 'ID filter' },
      { action: 'clear', selector: 'input[name="id_F"]', label: 'Clear ID filter' },
      { action: 'fill', selector: 'input[name="nombre_F"], input[id="nombre"]', value: 'test', label: 'Name filter' },
      { action: 'click_button_text', text: /filtrar|buscar|search/i, label: 'Search button' },
    ],
  },
  {
    name: 'consult-marks-table-sort',
    label: 'Consult Marks — Table Sort',
    route: '/#/consultMarks',
    pattern: 'table-interaction',
    description: 'Click table column headers to sort marks. Select rows for bulk actions.',
    interactions: [
      { action: 'click_nth', selector: 'table th', index: 1, label: 'Sort by first column' },
      { action: 'screenshot', label: 'After sort' },
      { action: 'click_nth', selector: 'table th', index: 2, label: 'Sort by second column' },
    ],
  },
  {
    name: 'manage-marks-form',
    label: 'Manage Marks — Create/Edit Form',
    route: '/#/manageMarks',
    pattern: 'crud-form',
    description: 'Form to create or edit a mark. Fields: ID, name, process ID, availability (radio), customer visibility (radio), description. Linked categories table.',
    interactions: [
      { action: 'screenshot', label: 'Initial form state' },
      { action: 'fill_if_exists', selector: 'input[name="id_F"]', value: 'MARK_001', label: 'Mark ID' },
      { action: 'fill_if_exists', selector: 'input[id="nombre"], input[name="nombre_F"]', value: 'Test Mark', label: 'Mark name' },
      { action: 'fill_if_exists', selector: 'input[id="idProceso"], input[name="idProceso_F"]', value: 'PROC_001', label: 'Process ID' },
      { action: 'screenshot', label: 'Form filled state' },
    ],
  },
  {
    name: 'manage-mark-categories-form',
    label: 'Manage Mark Categories — Create/Edit Form',
    route: '/#/manageMarkCategories',
    pattern: 'crud-form',
    description: 'Form to create or edit a mark category. Fields: ID, name, type (dropdown), description. Has aceptar/cancelar/volver buttons.',
    interactions: [
      { action: 'screenshot', label: 'Initial form state' },
      { action: 'fill_if_exists', selector: 'input[id="id"]', value: 'CAT_001', label: 'Category ID' },
      { action: 'fill_if_exists', selector: 'input[id="nombre"], input[id="name"]', value: 'Test Category', label: 'Category name' },
      { action: 'screenshot', label: 'Form filled state' },
    ],
  },
  {
    name: 'consult-mark-categories-search',
    label: 'Consult Mark Categories — Search & Filter',
    route: '/#/consultMarkCategories',
    pattern: 'search-filter',
    description: 'Filter categories by ID, name, type. Sort table columns. Click row to edit.',
    interactions: [
      { action: 'screenshot', label: 'Initial list state' },
      { action: 'click_nth', selector: 'table th', index: 0, label: 'Sort by ID column' },
      { action: 'screenshot', label: 'After sort' },
    ],
  },
  {
    name: 'select-mark-categories',
    label: 'Select Mark Categories — Selector',
    route: '/#/selectMarkCategories',
    pattern: 'selection-list',
    description: 'Select one or more mark categories from a list. Used as embedded component.',
    interactions: [
      { action: 'screenshot', label: 'Category selector state' },
    ],
  },
];

async function takeScreenshot(page, name, step, label) {
  const filename = `flow-${name}-step${step}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`    📸 ${filename} — ${label}`);
  return `screenshots/${filename}`;
}

async function getPageInfo(page) {
  return {
    title: await page.title().catch(() => ''),
    url: page.url(),
    visibleText: await page.evaluate(() => {
      const body = document.body;
      return body ? body.innerText.slice(0, 500) : '';
    }).catch(() => ''),
  };
}

async function exploreFlow(page, flowDef) {
  const steps = [];
  let stepNum = 0;

  const fullUrl = BASE_URL.replace(/\/$/, '') + flowDef.route;
  console.log(`\n  🔄 Flow: ${flowDef.label}`);
  console.log(`     URL: ${fullUrl}`);

  // Step 0: Navigate
  try {
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
  } catch (err) {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  const info0 = await getPageInfo(page);
  const screenshot0 = await takeScreenshot(page, flowDef.name, stepNum, 'initial state');
  steps.push({
    step: stepNum++,
    action: 'navigate',
    url: flowDef.route,
    full_url: fullUrl,
    page_title: info0.title,
    screenshot: screenshot0,
  });

  // Extract DOM info for observations
  const domInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
      tag: el.tagName.toLowerCase(),
      type: el.type || el.tagName.toLowerCase(),
      name: el.name || '',
      id: el.id || '',
      placeholder: el.placeholder || '',
      disabled: el.disabled,
      visible: el.offsetParent !== null,
    })).filter(e => e.visible);

    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]')).map(b => ({
      text: (b.textContent || b.value || '').trim().slice(0, 60),
      type: b.type || 'button',
      disabled: b.disabled,
      visible: b.offsetParent !== null,
    })).filter(b => b.visible && b.text);

    const tables = Array.from(document.querySelectorAll('table')).map(t => ({
      headers: Array.from(t.querySelectorAll('th')).map(h => h.textContent.trim()),
      rowCount: t.querySelectorAll('tbody tr').length,
    }));

    const selects = Array.from(document.querySelectorAll('select')).map(s => ({
      name: s.name || s.id || '',
      options: Array.from(s.options).map(o => o.text.trim()).filter(Boolean),
    }));

    return { inputs, buttons, tables, selects };
  });

  steps.push({
    step: stepNum++,
    action: 'inspect_dom',
    inputs_found: domInfo.inputs,
    buttons_found: domInfo.buttons,
    tables_found: domInfo.tables,
    selects_found: domInfo.selects,
  });

  // Execute defined interactions
  if (flowDef.interactions) {
    for (const interaction of flowDef.interactions) {
      try {
        if (interaction.action === 'screenshot') {
          const screenshot = await takeScreenshot(page, flowDef.name, stepNum, interaction.label);
          steps.push({ step: stepNum++, action: 'screenshot', label: interaction.label, screenshot });

        } else if (interaction.action === 'fill') {
          const el = await page.$(interaction.selector).catch(() => null);
          if (el) {
            await el.fill(interaction.value);
            await page.waitForTimeout(500);
            steps.push({ step: stepNum++, action: 'fill', selector: interaction.selector, label: interaction.label, value: interaction.value });
            console.log(`    ✓ Fill: ${interaction.label} = "${interaction.value}"`);
          } else {
            console.log(`    - Skip (not found): ${interaction.label} (${interaction.selector})`);
            steps.push({ step: stepNum++, action: 'skip', reason: 'element_not_found', selector: interaction.selector, label: interaction.label });
          }

        } else if (interaction.action === 'fill_if_exists') {
          const el = await page.$(interaction.selector).catch(() => null);
          if (el) {
            const isVisible = await el.isVisible().catch(() => false);
            if (isVisible) {
              await el.fill(interaction.value);
              await page.waitForTimeout(300);
              steps.push({ step: stepNum++, action: 'fill', selector: interaction.selector, label: interaction.label, value: interaction.value });
              console.log(`    ✓ Fill: ${interaction.label} = "${interaction.value}"`);
            } else {
              steps.push({ step: stepNum++, action: 'skip', reason: 'not_visible', selector: interaction.selector, label: interaction.label });
            }
          } else {
            steps.push({ step: stepNum++, action: 'skip', reason: 'element_not_found', selector: interaction.selector, label: interaction.label });
          }

        } else if (interaction.action === 'clear') {
          const el = await page.$(interaction.selector).catch(() => null);
          if (el) {
            await el.fill('');
            await page.waitForTimeout(300);
            steps.push({ step: stepNum++, action: 'clear', selector: interaction.selector, label: interaction.label });
          }

        } else if (interaction.action === 'click_button_text') {
          const buttons = await page.$$('button').catch(() => []);
          let clicked = false;
          for (const btn of buttons) {
            const text = await btn.textContent().catch(() => '');
            if (interaction.text.test(text.trim())) {
              await btn.click().catch(() => {});
              await page.waitForTimeout(1000);
              const screenshot = await takeScreenshot(page, flowDef.name, stepNum, interaction.label);
              steps.push({ step: stepNum++, action: 'click', target: text.trim(), label: interaction.label, screenshot });
              console.log(`    ✓ Click button: "${text.trim()}"`);
              clicked = true;
              break;
            }
          }
          if (!clicked) {
            steps.push({ step: stepNum++, action: 'skip', reason: 'button_not_found', label: interaction.label });
          }

        } else if (interaction.action === 'click_nth') {
          const els = await page.$$(interaction.selector).catch(() => []);
          const target = els[interaction.index];
          if (target) {
            const isVisible = await target.isVisible().catch(() => false);
            if (isVisible) {
              await target.click().catch(() => {});
              await page.waitForTimeout(800);
              const screenshot = await takeScreenshot(page, flowDef.name, stepNum, interaction.label);
              steps.push({ step: stepNum++, action: 'click', selector: interaction.selector, index: interaction.index, label: interaction.label, screenshot });
              console.log(`    ✓ Click: ${interaction.label}`);
            }
          } else {
            steps.push({ step: stepNum++, action: 'skip', reason: 'element_not_found', selector: interaction.selector, label: interaction.label });
          }
        }
      } catch (err) {
        console.log(`    ✗ Error on step "${interaction.label}": ${err.message.split('\n')[0]}`);
        steps.push({ step: stepNum++, action: 'error', label: interaction.label, error: err.message.split('\n')[0] });
      }
    }
  }

  // Final screenshot
  const finalScreenshot = await takeScreenshot(page, flowDef.name, stepNum, 'final state');
  const finalInfo = await getPageInfo(page);
  steps.push({
    step: stepNum++,
    action: 'observe',
    result: 'completed',
    url: finalInfo.url,
    page_title: finalInfo.title,
    screenshot: finalScreenshot,
  });

  const flowRecord = {
    name: flowDef.name,
    label: flowDef.label,
    start_url: fullUrl,
    pattern: flowDef.pattern,
    description: flowDef.description,
    recorded_at: new Date().toISOString(),
    steps,
    outcome: 'completed',
    observations: [
      `DOM inputs found: ${domInfo.inputs.length}`,
      `DOM buttons found: ${domInfo.buttons.length}`,
      `DOM tables found: ${domInfo.tables.length}`,
      domInfo.tables.length > 0 ? `Table headers: ${domInfo.tables.map(t => t.headers.join(', ')).join(' | ')}` : null,
      domInfo.selects.length > 0 ? `Selects: ${domInfo.selects.map(s => `${s.name}(${s.options.length} opts)`).join(', ')}` : null,
    ].filter(Boolean),
    dom_snapshot: {
      inputs: domInfo.inputs,
      buttons: domInfo.buttons,
      tables: domInfo.tables,
      selects: domInfo.selects,
    },
  };

  const flowPath = path.join(FLOWS_DIR, `flow-${flowDef.name}.json`);
  fs.writeFileSync(flowPath, JSON.stringify(flowRecord, null, 2));
  console.log(`    ✅ Saved: flow-${flowDef.name}.json (${steps.length} steps)`);

  return flowRecord;
}

async function main() {
  console.log(`\n🔄 Exploring flows at: ${BASE_URL}`);
  console.log(`📁 Flows dir: ${FLOWS_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const flowDef of FLOW_CANDIDATES) {
    try {
      const record = await exploreFlow(page, flowDef);
      results.push({ name: flowDef.name, status: 'completed', steps: record.steps.length });
      successCount++;
    } catch (err) {
      console.log(`  ✗ Flow failed: ${flowDef.name} — ${err.message.split('\n')[0]}`);
      results.push({ name: flowDef.name, status: 'error', error: err.message.split('\n')[0] });
      errorCount++;
    }
  }

  await browser.close();

  // Write flows index
  const flowsIndex = {
    slug: SLUG,
    base_url: BASE_URL,
    recorded_at: new Date().toISOString(),
    total_flows: FLOW_CANDIDATES.length,
    completed: successCount,
    errors: errorCount,
    flows: results,
    flow_candidates_from_codebase: [
      { source: 'consultMarks_controller.js', type: 'search-filter', methods: ['filtrar()', 'limpiarFiltros()', 'getMark(id)'] },
      { source: 'consultMarks_model.js', type: 'api', endpoints: ['listMarks', 'getMark', 'exportMarks', 'importMarks'] },
      { source: 'manageMarks_model.js', type: 'api', endpoints: ['createMark', 'getMark', 'updateMark'] },
      { source: 'manageMarkCategories_model.js', type: 'api', endpoints: ['createMarkCategory', 'getMarkCategory', 'updateMarkCategory', 'listMarkCategoryTypes'] },
      { source: 'consultMarkCategories_model.js', type: 'api', endpoints: ['listMarkCategories', 'exportMarkCategories', 'importMarkCategories'] },
      { source: 'selectMarkCategories_model.js', type: 'api', endpoints: ['listMarkCategories', 'listMarkCategoryTypes'] },
      { source: 'navigationAdequacyTRAN_model.js', type: 'api', endpoints: ['listInformationBlockOrg', 'listMarkCategories', 'listMarkCategoryTypes', 'listMarks'] },
    ],
    modal_controllers_found: [
      'consultMarksModalController',
      'manageMarkCategoriesModalController',
      'consultMarkCategoriesModalController',
      'navigationAdequacyTRANModalController',
      'manageMarksModalController',
    ],
  };

  const indexPath = path.join(FLOWS_DIR, 'flows-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(flowsIndex, null, 2));

  // Summary
  console.log('\n📊 Explore Summary');
  console.log(`├── Flows explored: ${successCount}/${FLOW_CANDIDATES.length}`);
  if (errorCount > 0) console.log(`├── Errors: ${errorCount}`);
  console.log(`├── Flow files: ${FLOWS_DIR}`);
  console.log(`├── Index: ${indexPath}`);
  results.forEach(r => {
    const icon = r.status === 'completed' ? '✓' : '✗';
    console.log(`│   ${icon} ${r.name} (${r.steps || 0} steps)`);
  });
  console.log(`└── Screenshots: ${SCREENSHOTS_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
