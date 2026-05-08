# Guardrails — Restricciones & Estándares

## Absolute Requirements

### 1. TypeScript Strict Mode (`strict: true`)
**Impact**: BLOCKING — No code merge sin strict mode.

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Violation Check**:
```bash
tsc --project tsconfig.json --noEmit
```

### 2. Change Detection: OnPush OBLIGATORIO
**Impact**: BLOCKING — All `@Component` decorators must include it.

```typescript
@Component({
  selector: 'app-my-component',
  template: '...',
  changeDetection: ChangeDetectionStrategy.OnPush  // ← REQUIRED
})
export class MyComponent {}
```

**Automated Check**:
```bash
grep -r "@Component\|changeDetection: ChangeDetectionStrategy.OnPush" src/
# If a @Component exists without OnPush in next 5 lines → FAIL
```

### 3. NO Optional Chaining Fallback to `console.error()`
**Anti-pattern**: Don't use optional chaining without validation.

```typescript
// ❌ WRONG
this.data?.field?.value?.property;  // Silent failures

// ✅ CORRECT
if (this.data?.field?.value) {
  return this.data.field.value.property;
} else {
  throw new Error('Field mismatch');
}
```

### 4. NO `console.log()` in Production Code
**Impact**: Warning → auto-remove via linter.

**Allowed in**:
- `.spec.ts` test files
- Services for debugging context (wrapped in `if (environment.development)`)

**Rule**:
```typescript
// ✅ CORRECT
if (inject(NgZone).isStable) {
  console.debug('Debug info:', data);  // DEBUG only, not LOG
}

// ❌ INCORRECT
console.log('User clicked button');
```

**Linter Rule** (ESLint):
```json
{
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error", "debug"] }]
  }
}
```

### 5. NO Hardcoded Strings (i18n)
**Impact**: BLOCKING for UI text.

All user-facing text must use i18n keys.

```typescript
// ❌ WRONG
alert('Operación completada');
throw new Error('Invalid input');

// ✅ CORRECT
alert(this.i18n.t('success.operation_completed'));
throw new Error(this.i18n.t('errors.invalid_input'));
```

**Keys**:
- Format: `domain.specific_key` (e.g., `form.submit_button`, `errors.timeout`)
- Always defined in `assets/i18n/{lang}.json`

**Scan for Violations**:
```bash
grep -r "(alert|Error|warn)\(" src/ --include="*.ts" \
  | grep -v "\.spec\.ts" \
  | grep -v "i18n.t(" \
  | wc -l
# Should be 0
```

### 6. NO Blocking Operations on Main Thread
**Impact**: Performance guard.

```typescript
// ❌ WRONG - Blocking parse
const data = JSON.parse(largeJsonString);  // May freeze UI

// ✅ CORRECT - Async parse (Web Worker or timeout)
await new Promise(resolve => {
  setTimeout(() => {
    const data = JSON.parse(jsonString);
    resolve(data);
  }, 0);
});
```

### 7. NO Circular Dependencies
**Impact**: BLOCKING — build will fail.

**Detection**:
```bash
npm run build 2>&1 | grep -i "circular"
# Should return 0 issues
```

**Pattern to avoid**:
```typescript
// ❌ service-a imports service-b imports service-a
// core/services/service-a.ts
import { ServiceB } from './service-b';

// core/services/service-b.ts
import { ServiceA } from './service-a';
```

**Solution**: Extract shared interface to `core/models/`

### 8. API Responses Must Be Validated
**Impact**: BLOCKING for network calls.

Every HTTP response must satisfy validateQueryResponse:

```typescript
// core/validators/response.validator.ts
export function validateQueryResponse(resp: any): resp is QueryResponse {
  return resp &&
    typeof resp.id === 'string' &&
    ['success', 'error', 'pending'].includes(resp.status) &&
    (resp.data !== undefined || Array.isArray(resp.errors));
}

// Usage in service
submitQuery(req: QueryRequest) {
  return this.http.post(`${this.baseUrl}/query`, req).pipe(
    map(resp => {
      if (!validateQueryResponse(resp)) {
        throw new Error('Invalid API response structure');
      }
      return resp;
    })
  );
}
```

---

## Code Quality Gates

### 1. Test Coverage Minimum: 80%
**Command**:
```bash
npm run test -- --code-coverage
```

Coverage report must show:
- Statements: ≥80%
- Branches: ≥75%
- Functions: ≥80%
- Lines: ≥80%

### 2. No Unused Code
**ESLint Rule**: `no-unused-vars`, `no-unused-parameters`

```typescript
// ❌ WRONG
private unusedService = inject(SomeService);  // Not used

// ✅ CORRECT
// Remove if not used
```

### 3. Accessibility: AXE Validation
**Command** (when E2E tests exist):
```bash
npm run e2e -- --with-accessibility-checks
```

**Minimum compliance**: WCAG AA
- Color contrast ≥ 4.5:1
- Focus management (tabindex, keyboard navigation)
- ARIA labels for form inputs
- Semantic HTML (buttons, links, lists)

### 4. Bundle Size
**Limit**: < 150KB (gzipped main.js)

**Check**:
```bash
npm run build
ls -lh dist/app.*.js | head -1
```

If exceeds:
- Review imports (tree-shake unused code)
- Lazy load routes more aggressively
- Remove unused dependencies

### 5. Performance: Lighthouse
**Target Scores** (Production):
- Performance: ≥85
- Accessibility: ≥95
- Best Practices: ≥90
- SEO: ≥90

---

## Forbidden Patterns

### 1. ❌ NgModules
```typescript
// WRONG - No modules
@NgModule({
  declarations: [MyComponent],
  imports: [CommonModule]
})
export class MyModule {}
```

**Correct**: Use standalone components + direct imports in each component.

### 2. ❌ `any` Type
```typescript
// WRONG
const data: any = response;

// CORRECT
const data: unknown = response;
if (typeof data === 'object' && data !== null) {
  // Use type guard
}
```

### 3. ❌ NgIf/NgFor/NgClass/NgStyle
```typescript
// WRONG
<div *ngIf="isActive">...</div>
<div *ngFor="let item of items">...</div>
<div [ngClass]="{ 'active': isActive }"></div>
<div [ngStyle]="{ color: fontColor }"></div>

// CORRECT
@if (isActive()) {
  <div>...</div>
}
@for (item of items(); track item.id) {
  <div>...</div>
}
<div [class.active]="isActive()"></div>
<div [style.color]="fontColor()"></div>
```

### 4. ❌ LocalStorage/SessionStorage
```typescript
// WRONG
localStorage.setItem('lang', lang);

// CORRECT
currentLang = signal<string>(config.defaultLang);  // Memory only
```

### 5. ❌ Template-Driven Forms
```typescript
// WRONG
<input [(ngModel)]="data" />

// CORRECT
<input [formControl]="formControl" />  // Reactive Forms
```

### 6. ❌ Observables in Templates
```typescript
// WRONG
{{ observable$ | async }}

// CORRECT
{{ data() }}  // Signal, no AsyncPipe
```

### 7. ❌ Subscribe in Components (without unsubscribe)
```typescript
// WRONG
this.service.getData().subscribe(data => {
  this.data = data;  // Potential memory leak
});

// CORRECT
firstValueFrom(this.service.getData()).then(data => {
  this.data.set(data);
});
// OR
this.data = toSignal(this.service.getData());
```

### 8. ❌ Direct HTTP Timeout in Component
```typescript
// WRONG
this.http.get(url).subscribe(...);  // No timeout spec

// CORRECT
this.http.get(url).pipe(
  timeout(this.config.requestTimeoutMs),
  catchError(...)
).subscribe(...);
```

### 9. ❌ No Error Handling for API Calls
```typescript
// WRONG
this.apiService.submitQuery(req).subscribe(
  response => { /* ... */ }
  // Missing error handler
);

// CORRECT
this.apiService.submitQuery(req).subscribe({
  next: (response) => { /* ... */ },
  error: (error) => {
    this.appState.error.set(this.i18n.t('errors.api_failed'));
  }
});
```

### 10. ❌ Hardcoded URLs
```typescript
// WRONG
const apiUrl = 'http://middleware.local/api/query';

// CORRECT
const apiUrl = `${this.config.apiBaseUrl}/query`;
```

---

## Security Guidelines

### 1. No Credentials in Code
**Rule**: Never hardcode API keys, tokens, or passwords.

```typescript
// ❌ WRONG
const MIDDLEWARE_KEY = 'secret-key-123';

// ✅ CORRECT
const MIDDLEWARE_KEY = this.config.apiKey;  // From secure config
```

### 2. HTTPS Only (Production)
**Rule**: All API calls use `https://` in production.

```typescript
// Check during build/deploy
const apiUrl = this.config.apiBaseUrl;
if (environment.production && !apiUrl.startsWith('https://')) {
  throw new Error(`[SECURITY] Non-HTTPS URL in production: ${apiUrl}`);
}
```

### 3. CORS Headers (Respect Middleware Config)
**Rule**: Don't add custom CORS headers from frontend; trust Middleware.

### 4. Input Validation (Always)
**Rule**: Validate all user input before sending to API.

```typescript
// Example: Reactive Form validation
form = this.fb.group({
  documentId: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
  operationType: ['', Validators.required]
});
```

### 5. No PII in Logs
**Rule**: Sanitize logs to remove PII (DNI, personal data).

```typescript
// ❌ WRONG
console.debug('Query:', request);  // Might contain DNI

// ✅ CORRECT
console.debug('Query submitted:', { operationType: request.operationType });
```

---

## Linting & Formatting

### ESLint Configuration Location
`.eslintrc.json` (root)

**Rules enforced**:
- No `console.log` (warn)
- No `any` type (error)
- No unused variables (error)
- No circular imports (error)

### Prettier Configuration Location
`.prettierrc` (root)

**Format**: 2-space indentation, semicolons, single quotes

### Pre-commit Hooks
Husky + lint-staged (optional but recommended)

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.ts": "eslint --fix",
    "*.json": "prettier --write"
  }
}
```

---

## Build & Deployment Guardrails

### 1. No `console.log` / `debugger` in Production Build
**Command**:
```bash
npm run build
grep -r "console\.log\|debugger" dist/
# Should return 0 matches
```

### 2. Source Maps Stripped in Production
**webpack.config.js / vite.config.ts**:
```typescript
{
  sourcemap: false,  // Production only
  minify: 'terser'
}
```

### 3. Environment Variables via config.json (No .env in Frontend)
**Rule**: Frontend config is NOT a `.env` file; it's `assets/config.json`.

**Reason**: SPA are static; `.env` is build-time, not runtime.

---

## Rollout Checklist

Before merging any code:

- [ ] TypeScript strict mode passes (`tsc --noEmit`)
- [ ] All components have `changeDetection: ChangeDetectionStrategy.OnPush`
- [ ] No `any` types
- [ ] No hardcoded strings (all use i18n keys)
- [ ] No `console.log()` outside of test/debug context
- [ ] Test coverage ≥ 80%
- [ ] No unused imports/variables
- [ ] Accessibility: AXE passes
- [ ] No forbidden patterns (ngClass, ngStyle, NgModules, etc.)
- [ ] API responses validated via type guard
- [ ] Error handling complete for all async operations
- [ ] No circular dependencies
- [ ] Bundle size < 150KB (gzipped)

---

## References
- [02-tech-stack.md](02-tech-stack.md)
- [04-patterns.md](04-patterns.md)
- ESLint: https://eslint.org/
- Angular Security Guide: https://angular.dev/guide/security
