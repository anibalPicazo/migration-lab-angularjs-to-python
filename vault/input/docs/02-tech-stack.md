# Tech Stack — Stack Tecnológico

## Language & Runtime

| Component | Version | Notes |
|-----------|---------|-------|
| **TypeScript** | 5.x+ | Modo estricto obligatorio (`strict: true` en tsconfig) |
| **Node.js** | 22+ | Para desarrollo y build |
| **npm** | 11+ | Package manager único |

### TypeScript Strict Mode
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

## Frontend Framework

| Layer | Technology | Version | Detail |
|-------|-----------|---------|--------|
| **Framework** | Angular | 20 | Latest modern Angular with Signals |
| **Build** | Vite | 6+ (or Wite with Angular preset) | Fast bundle, dev server |
| **Module System** | ES modules | native | No CommonJS |
| **Testing** | Jasmine + Karma | latest | Unit tests + coverage |
| **E2E Testing** | Cypress or Playwright | latest | Optional, test automation |

### Angular 20 Configuration

#### Bootstrap (main.ts)
```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { APP_INITIALIZER } from '@angular/core';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: (configService: ConfigService) => () => configService.load(),
      deps: [ConfigService],
      multi: true
    }
  ]
});
```

#### Standalone Components
- **NO `standalone: true` en decorators** — es default en Angular 17+
- Cada componente tiene su `providers: []` local o usa `providedIn: 'root'`
- Importar dependencias directamente en cada componente

#### Change Detection Strategy
- **OBLIGATORIO**: `changeDetection: ChangeDetectionStrategy.OnPush` en todos los `@Component`
- Maximize performance y reactividad explícita

---

## State Management

### Signals (Angular Signals API)
- **Core state**: `signal(initialValue)`
- **Derived state**: `computed(() => ...)`
- **Effects**: `effect(() => ...)`
- **No Redux/NgRx** — Signals son suficientes para esta escala

### Pattern
```typescript
// Component state
export class MyComponent {
  count = signal(0);
  doubled = computed(() => this.count() * 2);  // derivado

  increment() {
    this.count.update(c => c + 1);
  }
}
```

---

## HTTP & API

### HttpClient
- `provideHttpClient()` en app.config.ts
- Interceptores funcionales para:
  - Manejo centralizado de errores
  - Timeout global = configurable via `requestTimeoutMs` en config.json
  - Headers por defecto (CORS, User-Agent)

### Configuration (Runtime)
**Ruta**: `assets/config.json`  
Cargado via `APP_INITIALIZER` sin recompilar

```json
{
  "apiBaseUrl": "http://middleware.local/api",
  "defaultLang": "es-ES",
  "supportedLangs": ["es-ES", "en-EN"],
  "requestTimeoutMs": 5000
}
```

### API Service
Centralizado en `core/services/api.service.ts`:
```typescript
@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  query(endpoint: string, params?: any) {
    return this.http.get(`${this.baseUrl}/${endpoint}`, { params });
  }
  // ...
}
```

---

## Internacionalization (i18n)

### Languages
- **es-ES** (Spanish, default)
- **en-EN** (English)
- **Archivos**: `assets/i18n/{lang}.json`

### i18n Service
```typescript
@Injectable({ providedIn: 'root' })
export class I18nService {
  currentLang = signal<string>(config.defaultLang);
  translations = signal<Record<string, string>>({});

  setLanguage(lang: string) {
    this.currentLang.set(lang);
    // Load translations from assets/i18n/{lang}.json
  }

  t(key: string): string {
    return this.translations()[key] ?? key;
  }
}
```

### Translation Data Format (JSON)
```json
{
  "form.title": "Título del formulario",
  "buttons.submit": "Enviar",
  "buttons.cancel": "Cancelar",
  "errors.timeout": "La solicitud excedió el tiempo límite"
}
```

### Template Usage
```html
<label>{{ i18n.t('form.title') }}</label>
<button (click)="submit()">{{ i18n.t('buttons.submit') }}</button>
```

### Runtime Configuration (Query Param)
- Optional: `?lang=en-EN` overrides default
- **Important**: NO `localStorage`/`sessionStorage` — stateless

---

## CSS & Styling

### Rules
- **No Bootstrap** ❌
- **No Angular Material** ❌
- **CSS propio** ✅ (minimalista, corporativo)
- **No Tailwind** ❌
- **No Pre-processors (Sass/Less)** unless necessary

### Design System
Definido en [06-ui-design-system.md](06-ui-design-system.md)

### Global Styles
- `styles/main.css` — reset, tokens, utilidades base
- `styles/theme.css` — corporativo (azul/gris)

### Component Styles
- Scoped CSS in component `.css` files
- Use CSS variables from `--root` para temas

---

## Routing

### Angular Router (Lazy Loading)
```typescript
// app.routes.ts
const routes = [
  {
    path: 'queries',
    loadComponent: () => import('./pages/queries/queries.component')
      .then(m => m.QueriesComponent)
  },
  {
    path: 'results',
    loadComponent: () => import('./pages/results/results.component')
      .then(m => m.ResultsComponent)
  }
];
```

- **Lazy load** cada página por ruta
- **No preloading** strategy (stateless SPA)

---

## Testing Stack

### Unit Tests
- **Framework**: Jasmine
- **Runner**: Karma
- **Coverage**: Minimum 80% for new code

### Test File Naming
- `*.spec.ts` for unit tests
- Co-located with component/service

### Example
```typescript
describe('QueryFormComponent', () => {
  it('should submit form with valid data', () => {
    // arrange, act, assert
  });
});
```

---

## Tooling

| Tool | Purpose | Version |
|------|---------|---------|
| **ESLint** | Linting (TypeScript) | latest |
| **Prettier** | Code formatting | latest |
| **Husky** | Git hooks (pre-commit) | latest |
| **Webpack/Vite** | Bundler | 6+ |
| **Sourcemaps** | Debug | enabled in dev |

### ESLint Config
- Angular recommended rules
- Strict TypeScript rules
- No `any`
- No unused variables

---

## Accessibility (A11y)

### Standards
- **WCAG AA** minimum (colors, contrast, focus, ARIA)
- **AXE** tool validation (all checks must pass)

### Requirements
- Color contrast ≥ 4.5:1 for normal text
- Focus management (Tab navigation)
- ARIA labels/roles where needed
- Semantic HTML (buttons, forms, links)

---

## Build & Deployment

### Development
```bash
npm run dev          # Vite dev server + hot reload
npm run build        # Production bundle
npm run test         # Jasmine + Karma
npm run lint         # ESLint
```

### Production Assets
- Minified JS/CSS
- Tree-shaken (dead code removal)
- Source maps stripped (unless needed)
- Static assets optimized (images, i18n JSON)

---

## Dependencies (Minimal)

```json
{
  "@angular/core": "^20.0.0",
  "@angular/common": "^20.0.0",
  "@angular/platform-browser": "^20.0.0",
  "@angular/router": "^20.0.0",
  "typescript": "^5.x"
}
```

**Principle**: Mantener mínimo de dependencias externas. Evitar librerías de UI, reducir CPM.

---

## References
- [01-service-map.md](01-service-map.md)
- [04-patterns.md](04-patterns.md) — Convenciones de código
- [05-guardrails.md](05-guardrails.md) — Restricciones
- [06-ui-design-system.md](06-ui-design-system.md) — CSS/UI
