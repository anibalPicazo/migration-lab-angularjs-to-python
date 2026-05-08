---
name: discovery-runtime-screen-specs
description: Generates per-screen visual specifications and flow storyboards from observation data (DOM summaries, HTML snapshots, screenshots, flows) enriched with SCA data (resolver, functional-map). Produces screen-specs/screen-specs.json, screen-specs/screen-specs.md, and screen-specs/flow-storyboards.md.
license: Apache-2.0
compatibility: Requires .discovery/runtime/ data AND .requirement/<slug>/functional-map/functional-map.json AND .discovery/code/ resolver data.
metadata:
  author: synthesize
  version: "1.0"
---

# Screen Specifications & Flow Storyboards

Synthesize observation visual data (DOM summaries, HTML snapshots, screenshots, flows) with SCA resolver and functional-map into per-screen specifications and step-by-step flow storyboards.

**Purpose**: Provide enough visual + structural detail for a developer or agent to reproduce each screen in the target framework without access to the running legacy app.

## Prerequisites

- `.discovery/runtime/observations/<obs-slug>/doms/*.json` — DOM summaries per page
- `.discovery/runtime/observations/<obs-slug>/doms/*.html` — Full HTML snapshots per page
- `.discovery/runtime/observations/<obs-slug>/screenshots/*.png` — Screenshots per page + flow steps
- `.requirement/<obs-slug>/flows/flow-*.json` — Recorded user flows with screenshot refs
- `.requirement/<slug>/functional-map/functional-map.json` — API endpoints, screens, platform services
- `.discovery/code/scans/<slug>/resolver-angularjs.json` — Module profiles with scope methods, endpoints, views

## Outputs

| Artifact | Location | Content |
|----------|----------|---------|
| Screen specs JSON | `.requirement/<slug>/screen-specs/screen-specs.json` | Structured data: layout tree, forms, buttons, tables, CSS, api endpoints, scope methods, flows per screen |
| Screen specs MD | `.requirement/<slug>/screen-specs/screen-specs.md` | Human-readable per-screen spec with screenshot refs, layout tree, form fields, action table, API wiring, flows |
| Flow storyboards | `.requirement/<slug>/screen-specs/flow-storyboards.md` | Step-by-step storyboard per observed flow with action, screenshot ref, result |

## Steps

### Step 1: Build screen inventory

Read all DOM summary files from `.discovery/runtime/observations/<obs-slug>/doms/*.json`.

**Deduplication**: Observation may capture the same screen in both kebab-case (`consult-marks.json`) and camelCase (`consultMarks.json`). Deduplicate by normalizing to camelCase. Prefer the camelCase version if both exist (it matches feature names in the resolver).

Skip `home.json` — it's the app shell, not a module screen.

For each unique screen, locate:
- DOM summary: `.discovery/runtime/observations/<obs-slug>/doms/<name>.json`
- HTML snapshot: `.discovery/runtime/observations/<obs-slug>/doms/<name>.html`
- Screenshot: `.discovery/runtime/observations/<obs-slug>/screenshots/<name>.png` (try camelCase, then kebab-case)

### Step 2: Extract layout tree from HTML snapshots

For each screen's HTML snapshot, parse the HTML and extract a **component layout tree** showing the structural hierarchy. Include only layout-significant elements:

**Tags**: `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`, `div`, `form`, `table`, `thead`, `tbody`, `fieldset`

**CSS class keywords**: `panel`, `container`, `row`, `col`, `grid`, `toolbar`, `barra`, `cabecera`, `contenido`, `tabla`, `boton`, `formulario`

**AngularJS directives**: Elements with `ng-controller`, `ng-view`, `ng-include`

Output format (indented tree, max depth 6):
```
header
  div.cabecera_principal
    header._displayHeadHome
div#page
  div#content_page
    div.ng-scope[ng-controller=consultMarksController]
      form.ng-pristine
    footer
```

**Strip** `<script>` and `<style>` tags before parsing to reduce noise.

### Step 3: Enrich with SCA data

For each screen, match to its feature in the resolver and functional-map:

From `resolver-angularjs.json` → `module_profiles[<feature>]`:
- `controller.scope_methods[]` → list of public scope methods
- `model.endpoints[]` → API endpoints wired to this feature

From `functional-map.json` → `screens[]` where `feature == <screen_name>`:
- `form_fields[]` → field name, id, type, required, label
- `ng_models[]` → all ng-model bindings
- `actions[]` → buttons and their ng-click handlers
- `table_columns[]` → data table column definitions

### Step 4: Map flows to screens

Read all flow files from `.requirement/<obs-slug>/flows/flow-*.json`.

For each flow, match it to the screen(s) it involves by checking if the flow name contains significant words from the screen's feature name (words > 3 chars).

Extract per step:
- `step` number
- `action` (navigate, click, fill, etc.)
- `screenshot` path
- `result` or `message`

### Step 5: Generate screen-specs.json

Build a JSON array where each element represents one screen:

```json
{
  "feature": "consultMarks",
  "title": "Page title from DOM",
  "url": "http://...",
  "screenshot": ".discovery/runtime/.../consultMarks.png",
  "layout_tree": ["header", "  div.cabecera_principal", ...],
  "design_system": { "detected": true, "name": "...", "evidence": [...] },
  "css_resources": [...],
  "forms": [...],
  "buttons": [...],
  "tables": [...],
  "headings": [...],
  "ng_models": [...],
  "actions": [...],
  "form_fields": [...],
  "table_columns": [...],
  "api_endpoints": [...],
  "scope_methods": [...],
  "flows": [{ "name": "...", "outcome": "...", "steps": [...] }]
}
```

Write to `.requirement/<slug>/screen-specs/screen-specs.json`.

### Step 6: Generate screen-specs.md

For each screen in the JSON, produce a markdown section with:

1. **Header**: Feature name, URL
2. **Screenshot reference**: Path to PNG with viewing instructions
3. **Design system**: Detected name and CSS evidence
4. **Component Layout Tree**: The extracted tree in a code block
5. **Form Fields table**: columns = #, Name, ID, Type, Required, Label, ng-model
6. **Actions & Buttons table**: columns = Button text, Type, CSS Class, ng-click/Action
7. **Data Table**: Column headers and observed row count
8. **API Endpoints table**: columns = Method, URL, Function
9. **Scope Methods**: Comma-separated list of all controller scope methods
10. **User Flows**: For each matched flow, a table with Step, Action, Screenshot, Result

Write to `.requirement/<slug>/screen-specs/screen-specs.md`.

### Step 7: Generate flow-storyboards.md

Read ALL flow files (not just those matched to screens).

Produce:
1. **Summary table**: Flow name, steps count, screenshots count, outcome, video ref
2. **Per flow section**: Start URL, pattern, outcome, observations/errors, then per step: action, URL, page title, screenshot path, result

Write to `.requirement/<slug>/screen-specs/flow-storyboards.md`.

## Error Handling

- If no DOM summaries exist → skip layout tree, use only functional-map screen data
- If no HTML snapshots exist → skip layout tree extraction entirely
- If no screenshots exist → still generate specs but mark screenshot as "not available"
- If no flows exist → skip screen-specs/flow-storyboards.md and flow sections in screen-specs
- If `.requirement/<slug>/functional-map/functional-map.json` doesn't exist → run `discovery-runtime-extract-functionality` first

## Quality Checklist

- [ ] Every screen in the resolver has a matching entry in screen-specs
- [ ] Layout trees are max 30 lines (truncate if longer)
- [ ] All screenshot paths are relative and point to existing files
- [ ] Form fields have ng-model mappings where available
- [ ] API endpoints per screen match the resolver data
- [ ] Flow storyboards cover ALL recorded flows, not just matched ones
