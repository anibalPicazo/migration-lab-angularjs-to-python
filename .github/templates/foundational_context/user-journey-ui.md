# User Journey & UI Intent

Version: 0.1  
Owner: <product/ux>  
Last updated: <YYYY-MM-DD>  
Status: Draft | Active  

## Purpose

Guidance: Provide enough flow context for coherent UI + backend behavior generation.  
Guidance: Keep it lightweight and operational: journey slices + intent + low-fidelity UI structure.  
Guidance: Avoid pixel-level design; focus on outcomes, steps, and states.

## Journey slices (by outcome)

Guidance: Define 2–5 journeys that matter for end-to-end coherence.  
Guidance: Each journey describes a single outcome with clear Entry and Exit.  
Guidance: Steps should be numbered; keep them concrete and testable.

Journey: <Outcome name>  
Entry: <how the user starts>  
Steps:
1. <step>
2. <step>
3. <step>
Exit: <what "done" means>

Journey: <Outcome name>  
Entry: <how the user starts>  
Steps:
1. <step>
2. <step>
Exit: <what "done" means>

## UX intent (why this interaction exists)

Guidance: State the user needs and design intent that must be preserved in implementation.  
Guidance: Express as bullets; keep them stable across features.

- <intent statement>
- <intent statement>
- <intent statement>

## UI structure (low fidelity)

Guidance: Describe screens and regions schematically (names + responsibilities).  
Guidance: Prefer "screen + regions + key components" rather than free-form prose.

Screen: <Primary screen name>  
Regions:
- <Region>: <responsibility>
- <Region>: <responsibility>
- <Region>: <responsibility>

Key components (optional):
- <ComponentName>(<key props / state>)
- <ComponentName>(<key props / state>)

Additional screens (if any):
- <ScreenName>: <purpose>

## UI constraints

Guidance: Constraints that materially affect implementation and testability.  
Guidance: Include accessibility, responsiveness, localization, performance, and any platform constraints.

- <constraint>
- <constraint>
- <constraint>

## Design System & CSS Dependencies

Guidance: Document how the application gets its visual styling. This is CRITICAL for migrations — without it, the target app will render with zero styles.  
Guidance: Legacy apps often load 100% of CSS from external packages (e.g., via webpack `require()` in entry points). These must be detected and mapped.

### CSS package dependencies

Guidance: List packages that provide CSS/styles to the application.

| Package | Version | How loaded | Provides |
|---------|---------|-----------|----------|
| <package-name> | <version> | require() in index.js / link tag / SCSS import | <what styles it provides> |

### CSS loading mechanism

Guidance: Describe how CSS enters the application at build/runtime.

- Build tool: <webpack / vite / angular CLI / other>
- Entry point: <file where CSS is imported>
- Loading method: <require() / import / link tag / @import>

### CSS class naming conventions

Guidance: Document the naming convention(s) used in legacy views.

| Convention | Example | Context |
|------------|---------|---------|
| <convention-name> | <example-class> | <where used> |

### CSS class inventory (summary)

Guidance: Total unique classes grouped by UI region. Full inventory should be in module profiles.

| Category | Count | Example classes |
|----------|-------|----------------|
| Layout | <N> | <examples> |
| Forms | <N> | <examples> |
| Buttons | <N> | <examples> |
| Tables | <N> | <examples> |
| Pagination | <N> | <examples> |
| Modals | <N> | <examples> |

### Migration CSS strategy

Guidance: How CSS will be handled in the target application.

- <strategy: reuse legacy CSS package / create custom styles.css / use target design system / hybrid>
- Target design system: <name, if applicable>
- angular.json styles array: <what must be included>

## References

Guidance: Link to canonical design artifacts; do not copy large content.  
- <Figma link>
- <Design system link>
- <Mockup image path>
- <Relevant PRD/story link>
