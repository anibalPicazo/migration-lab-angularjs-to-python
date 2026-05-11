# UI Design System — Sistema de Diseño

## Brand & Tokens

### Color Palette

#### Primary (Corporativo Azul Oscuro)
```css
--primary: #1e3a8a;         /* Base: Azul corporativo */
--primary-hover: #1d4ed8;   /* Hover: Más vivo */
--on-primary: #ffffff;      /* Text on primary */
```

#### Secondary (Gris Azulado)
```css
--secondary: #475569;              /* Base: Gris azulado */
--secondary-hover-fill: #475569;   /* Hover: Se rellena */
--on-secondary: #ffffff;
```

#### Neutral Palette
```css
--bg: #f6f7fb;              /* Fondo de página */
--surface: #ffffff;         /* Superficie: cards, modals */
--text: #0f172a;            /* Texto principal: azul-gris oscuro */
--muted: #64748b;           /* Texto secundario: gris azulado */
--border: #e2e8f0;          /* Bordes: gris muy claro */
```

#### Semantic Colors (Optional for future)
```css
--success: #10b981;         /* Operación exitosa */
--warning: #f59e0b;         /* Advertencia */
--error: #ef4444;           /* Error / destrucción */
--info: #3b82f6;            /* Información */
```

### Typography

#### Font Family
```css
--font: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
```

**Rationale**: Sistema nativo → sin carga de fuentes externas, rendimiento.

#### Scale (Optional guideline)
```
Heading 1:  28-32px, weight 600
Heading 2:  20-24px, weight 600
Heading 3:  16-20px, weight 600
Body:       14-16px, weight 400
Caption:    12-14px, weight 400
```

### Motion & Transitions

```css
--t-fast: 160ms ease;       /* Quick transitions: hover colors */
--t-med: 220ms ease;        /* Medium: box-shadow, opacity */
--t-slow: 400ms ease;       /* Slow: page transitions (future) */
```

### Spacing

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;
--spacing-2xl: 32px;

/* Used in components */
gap: var(--spacing-md);
padding: var(--spacing-lg);
margin-bottom: var(--spacing-xl);
```

### Border Radius

```css
--r: 12px;                 /* Default border-radius */
--r-sm: 8px;               /* Pequeño (inputs, small buttons) */
--r-lg: 16px;              /* Grande (cards anchos) */
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.08);
--shadow-md: 0 8px 22px rgba(15, 23, 42, 0.14);
--shadow-lg: 0 16px 40px rgba(15, 23, 42, 0.16);
```

---

## Component Library

### 1. Button

#### Variants
- **Primary** (filled, dark blue)
- **Secondary** (outlined, fills on hover)
- **Ghost** (text-only, minimal)
- **Danger** (red, for destructive actions)

#### Structure
```html
<button class="btn btn-primary" [disabled]="isLoading()">
  {{ i18n.t('buttons.submit') }}
</button>
```

#### CSS
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  border: none;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: box-shadow var(--t-med), background-color var(--t-med);
  font-family: var(--font);
}

/* Primary */
.btn-primary {
  background-color: var(--primary);
  color: var(--on-primary);
}
.btn-primary:hover {
  background-color: var(--primary-hover);
  box-shadow: var(--shadow-md);
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Secondary (Outlined → Filled on hover) */
.btn-secondary {
  background-color: transparent;
  color: var(--secondary);
  border: 1px solid var(--secondary);
}
.btn-secondary:hover {
  background-color: var(--secondary-hover-fill);
  color: var(--on-secondary);
}

/* Ghost */
.btn-ghost {
  background-color: transparent;
  color: var(--primary-hover);
  border: none;
}
.btn-ghost:hover {
  text-decoration: underline;
}
```

### 2. Card

#### Structure
```html
<section class="card">
  <h2>{{ cardTitle() }}</h2>
  <div class="card-content">
    <!-- Content -->
  </div>
</section>
```

#### CSS
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
  padding: 16px;
  transition: box-shadow var(--t-med);
}
.card:hover {
  box-shadow: var(--shadow-md);
}
```

### 3. Form Input

#### Structure
```html
<div class="form-group">
  <label for="input-id" class="form-label">{{ i18n.t('form.label') }}</label>
  <input
    id="input-id"
    type="text"
    class="form-input"
    [formControl]="control"
    [attr.aria-invalid]="control.invalid && control.touched"
  />
  @if (control.invalid && control.touched) {
    <span class="form-error">{{ control.errors?.['required'] ? i18n.t('errors.required') : '' }}</span>
  }
</div>
```

#### CSS
```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: var(--spacing-lg);
}

.form-label {
  font-weight: 600;
  color: var(--text);
  font-size: 0.95rem;
}

.form-input {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: var(--font);
  font-size: 1rem;
  color: var(--text);
  background-color: var(--surface);
  transition: box-shadow var(--t-fast), border-color var(--t-fast);
}
.form-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.1);
  border-color: var(--primary);
}
.form-input:disabled {
  background-color: var(--bg);
  opacity: 0.6;
}
.form-input[aria-invalid="true"] {
  border-color: var(--error);
}

.form-error {
  color: var(--error);
  font-size: 0.85rem;
  margin-top: -4px;
}
```

### 4. Table

#### Structure
```html
<div class="table-container">
  <table class="table">
    <thead>
      <tr>
        <th>{{ i18n.t('table.header.id') }}</th>
        <th>{{ i18n.t('table.header.status') }}</th>
        <th>{{ i18n.t('table.header.action') }}</th>
      </tr>
    </thead>
    <tbody>
      @for (item of items(); track item.id) {
        <tr [class.row-error]="item.status === 'error'">
          <td>{{ item.id }}</td>
          <td>{{ item.status }}</td>
          <td><button class="btn btn-ghost" (click)="viewDetails(item)">View</button></td>
        </tr>
      }
    </tbody>
  </table>
</div>
```

#### CSS
```css
.table-container {
  overflow-x: auto;
  border-radius: var(--r);
  background: var(--surface);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.table thead {
  background-color: var(--bg);
  border-bottom: 2px solid var(--border);
}

.table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: var(--text);
}

.table td {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.table tbody tr:hover {
  background-color: rgba(30, 58, 138, 0.02);
}

.row-error {
  background-color: rgba(239, 68, 68, 0.05);
}
```

### 5. Loading Spinner

#### Component (Angular)
```typescript
@Component({
  selector: 'app-loading-spinner',
  template: `<div class="spinner"></div>`,
  styleUrls: ['./loading-spinner.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSpinnerComponent {}
```

#### CSS
```css
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 6. Error Banner

#### Component
```typescript
@Component({
  selector: 'app-error-banner',
  template: `
    @if (error(); as msg) {
      <div class="error-banner">
        <span>{{ msg }}</span>
        <button class="btn-close" (click)="dismiss()">×</button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorBannerComponent {
  error = input<string | null>(null);
  onDismiss = output<void>();

  dismiss() {
    this.onDismiss.emit();
  }
}
```

#### CSS
```css
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--error);
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--error);
  margin-bottom: var(--spacing-lg);
  animation: slideDown 0.3s ease-out;
}

.btn-close {
  background: none;
  border: none;
  color: var(--error);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  margin-left: var(--spacing-md);
}

@keyframes slideDown {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

### 7. Header & Footer

#### Header Component
```typescript
@Component({
  selector: 'app-header',
  template: `
    <header class="header">
      <div class="container">
        <h1 class="logo">{{ i18n.t('app.title') }}</h1>
        <nav class="nav">
          <a routerLink="/queries" routerLinkActive="active">{{ i18n.t('nav.queries') }}</a>
          <a routerLink="/results" routerLinkActive="active">{{ i18n.t('nav.results') }}</a>
          <select class="lang-selector" (change)="changeLang($event)">
            <option value="es-ES">Español</option>
            <option value="en-EN">English</option>
          </select>
        </nav>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  i18n = inject(I18nService);

  changeLang(event: Event) {
    const lang = (event.target as HTMLSelectElement).value;
    this.i18n.setLanguage(lang);
  }
}
```

#### CSS
```css
.header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 12px 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  margin: 0;
  font-size: 1.5rem;
  color: var(--primary);
}

.nav {
  display: flex;
  gap: 20px;
  align-items: center;
}

.nav a {
  color: var(--muted);
  text-decoration: none;
  transition: color var(--t-fast);
}
.nav a:hover,
.nav a.active {
  color: var(--primary);
  text-decoration: underline;
}

.lang-selector {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background-color: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-family: var(--font);
}
```

---

## Layout & Grid

### Container
```css
.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 18px;
}
```

### Stack (Vertical layout)
```css
.stack {
  display: grid;
  gap: var(--spacing-md);
}
```

### Row (Horizontal layout)
```css
.row {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  flex-wrap: wrap;
}
```

### Spacer (Flexible space)
```css
.spacer {
  flex: 1;
}
```

### Utilities
```html
<div class="container">
  <div class="stack">
    <div class="row">
      <p>Left content</p>
      <div class="spacer"></div>
      <button>Right button</button>
    </div>
  </div>
</div>
```

---

## Responsive Design (Mobile-First)

### Breakpoints
```css
/* Mobile: 0px - 640px (default) */
/* Tablet: 640px+ */
/* Desktop: 1024px+ */
```

### Example: Responsive Card Layout
```css
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
}

@media (min-width: 640px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## Accessibility (A11y)

### Focus Visible
```css
:focus-visible {
  outline: 3px solid rgba(29, 78, 216, 0.25);
  outline-offset: 2px;
}
```

### Color Contrast
- **Text on background**: ≥ 4.5:1
- **Large text (18px+)**: ≥ 3:1
- **Example**: `--text: #0f172a` on `--surface: #ffffff` = 15.2:1 ✅

### Semantic HTML
```html
<!-- Use semantic tags -->
<header>, <nav>, <main>, <section>, <article>, <aside>, <footer>
<button> vs <div onclick>
<label for="id"> paired with <input id="id">
```

### ARIA Labels
```html
<button aria-label="Close modal">×</button>
<input aria-invalid="true" aria-describedby="error-msg" />
<span id="error-msg">This field is required</span>
```

---

## Responsive Table (Mobile)

### Pattern: Stackable Table
```css
@media (max-width: 640px) {
  .table {
    display: block;
  }
  
  .table thead {
    display: none;  /* Hide header on mobile */
  }
  
  .table tbody,
  .table tr {
    display: block;
  }
  
  .table td {
    display: block;
    text-align: right;
    padding: 8px;
  }
  
  .table td::before {
    content: attr(data-label);
    float: left;
    font-weight: 600;
  }
}
```

---

## File Structure

```
src/
├── app/
├── styles/
│   ├── main.css             ← Base reset, tokens, utilities
│   ├── theme.css            ← Design system (colors, spacing)
│   └── components.css        ← Component library (optional)
└── assets/
    ├── config.json
    └── i18n/
        ├── es-ES.json
        └── en-EN.json
```

---

## Usage Example (Full Page)

```html
<!-- query-form.component.html -->
<div class="container">
  <main class="stack">
    <header class="card">
      <h1>{{ i18n.t('form.title') }}</h1>
      <p class="muted">{{ i18n.t('form.subtitle') }}</p>
    </header>

    <app-error-banner [error]="error()" (onDismiss)="clearError()" />

    <form [formGroup]="form" (ngSubmit)="submit()" class="card">
      <div class="form-group">
        <label for="operation">{{ i18n.t('form.operation') }}</label>
        <select id="operation" class="form-input" formControlName="operationType">
          @for (op of operations(); track op.id) {
            <option [value]="op.id">{{ op.name }}</option>
          }
        </select>
      </div>

      <div class="form-group">
        <label for="document">{{ i18n.t('form.document_id') }}</label>
        <input id="document" class="form-input" formControlName="documentId" />
      </div>

      <div class="row">
        <button type="submit" class="btn btn-primary" [disabled]="!form.valid || isLoading()">
          {{ isLoading() ? 'Enviando...' : i18n.t('buttons.submit') }}
        </button>
        <button type="reset" class="btn btn-secondary">
          {{ i18n.t('buttons.reset') }}
        </button>
      </div>
    </form>

    <app-loading-spinner *ngIf="isLoading()" />
  </main>
</div>
```

---

## References
- [02-tech-stack.md](02-tech-stack.md) — Stack de CSS
- [05-guardrails.md](05-guardrails.md) — Directrices de accesibilidad
- WCAG AA Guidelines: https://www.w3.org/WAI/WCAG2AA-Conformance
- Angular NgOptimizedImage: https://angular.dev/guide/image-optimization
