# Patterns — Patrones & Arquitectura Interna

## Component Architecture

### Standalone Components (NO NgModules)
```typescript
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-query-form',
  templateUrl: './query-form.component.html',
  styleUrls: ['./query-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QueryFormComponent {
  // Inputs & Outputs using Signals API
  operationType = input<string>('');
  onSubmit = output<QueryRequest>();
  
  submit() {
    this.onSubmit.emit({
      operationType: this.operationType(),
      parameters: {}
    });
  }
}
```

**Rules**:
- ❌ NO `standalone: true` in decorator (default in Angular 17+)
- ✅ Use `input()` signal instead of `@Input()`
- ✅ Use `output()` instead of `@Output()`
- ✅ Use `inject()` in constructor instead of parameter injection

### Component Organization

```
src/app/
├── core/
│   ├── services/
│   │   ├── api.service.ts          // HTTP calls
│   │   ├── config.service.ts       // Runtime config
│   │   └── i18n.service.ts         // i18n state
│   ├── interceptors/
│   │   └── error.interceptor.ts    // Global error handling + timeout
│   ├── models/
│   │   ├── query.model.ts
│   │   ├── response.model.ts
│   │   └── config.model.ts
│   └── state/
│       └── app.state.ts            // Global signals
├── shared/
│   └── components/
│       ├── header/
│       ├── footer/
│       ├── loading-spinner/
│       └── error-banner/
├── pages/
│   ├── query-form-page/
│   │   ├── query-form.component.ts
│   │   ├── query-form.component.html
│   │   └── query-form.component.css
│   ├── results-page/
│   └── logs-page/
├── app.routes.ts                   (lazy loading)
├── app.config.ts                   (providers)
└── app.component.ts                (shell)

assets/
├── config.json                     (runtime config)
└── i18n/
    ├── es-ES.json
    └── en-EN.json
```

---

## Common Patterns

### 1. Reactive Forms
```typescript
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-query-form',
  template: `<form [formGroup]="form" (ngSubmit)="onSubmit()">...</form>`,
  imports: [ReactiveFormsModule]
})
export class QueryFormComponent {
  form = this.fb.group({
    operationType: ['', Validators.required],
    documentId: ['', Validators.required],
    documentType: ['']
  });

  constructor(private fb: FormBuilder) {}

  onSubmit() {
    if (this.form.valid) {
      this.apiService.submitQuery(this.form.value).subscribe(/* ... */);
    }
  }
}
```

**Rules**:
- ✅ Always use Reactive Forms
- ❌ NO Template-driven forms
- ✅ Validators at FormControl level

### 2. HTTP Calls & Interceptors
```typescript
// core/interceptors/error.interceptor.ts
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const timeout = inject(ConfigService).config().requestTimeoutMs;
  
  return next(req).pipe(
    timeout(timeout),
    catchError(error => {
      console.error('HTTP Error:', error);
      // Emit to global error state
      inject(AppState).error.set(error.message);
      return throwError(() => error);
    })
  );
};
```

### 3. Signals for State
```typescript
// Use signals, NEVER subscribe() in templates (push AsyncPipe)
@Component({
  template: `
    <div>{{ queryLogs().length }} logs</div>
    @for (log of queryLogs(); track log.id) {
      <div>{{ log.message }}</div>
    }
  `
})
export class LogsComponent {
  queryLogs = computed(() => {
    return inject(AppState).recentQueries();
  });
}
```

### 4. New Control Flow (No *ngIf, *ngFor)
```html
<!-- ✅ CORRECT -->
@if (isLoading()) {
  <app-loading-spinner />
} @else {
  <div>{{ data().results }}</div>
}

@for (item of items(); track item.id) {
  <app-result-row [item]="item" />
}

@switch (status()) {
  @case ('success') {
    <p>Success!</p>
  }
  @case ('error') {
    <p>Error occurred</p>
  }
  @default {
    <p>Unknown status</p>
  }
}

<!-- ❌ INCORRECT -->
<div *ngIf="isLoading()">...</div>
<div *ngFor="let item of items">...</div>
```

### 5. Computed Derived State
```typescript
// Good pattern for computed values
dropdownOptions = computed(() => {
  return this.operationTypes()
    .filter(op => op.enabled)
    .map(op => ({ label: op.name, value: op.id }));
});

isFormValid = computed(() => {
  return this.form.valid() && this.selectedOption() !== null;
});
```

### 6. Dependency Injection (inject() function)
```typescript
import { inject } from '@angular/core';

export class QueryFormComponent {
  private apiService = inject(ApiService);
  private appState = inject(AppState);
  private i18n = inject(I18nService);

  async submitQuery() {
    this.appState.isLoading.set(true);
    try {
      const result = await firstValueFrom(
        this.apiService.submitQuery(this.formData())
      );
      // Process result
    } catch (error) {
      this.appState.error.set(this.i18n.t('errors.api_failure'));
    } finally {
      this.appState.isLoading.set(false);
    }
  }
}
```

### 7. Lazy-Loaded Routes
```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: 'queries',
        loadComponent: () => import('./pages/queries/queries.component')
          .then(m => m.QueriesComponent)
      },
      {
        path: 'results',
        loadComponent: () => import('./pages/results/results.component')
          .then(m => m.ResultsComponent)
      },
      {
        path: 'logs',
        loadComponent: () => import('./pages/logs/logs.component')
          .then(m => m.LogsComponent)
      }
    ]
  }
];
```

---

## Template Binding Patterns

### Class & Style Bindings (NOT ngClass/ngStyle)
```html
<!-- ✅ CORRECT -->
<button
  [class.btn-primary]="isPrimary()"
  [class.btn-disabled]="isDisabled()"
  [style.opacity]="opacity()"
>
  Click me
</button>

<!-- ❌ INCORRECT -->
<button [ngClass]="{ 'btn-primary': isPrimary() }" [ngStyle]="{ opacity: opacity() }">
  Click me
</button>
```

### Event Binding & Output
```html
<!-- ✅ CORRECT -->
<button (click)="submit()">Submit</button>
<app-form (onSubmit)="handleSubmit($event)"></app-form>

<!-- Template expression minimal logic -->
<p>{{ formatDate(createdAt()) }}</p>
```

### Attribute Binding for Images
```html
<!-- ✅ CORRECT - use NgOptimizedImage -->
<img
  ngSrc="assets/images/logo.png"
  [alt]="logoAlt()"
  width="100"
  height="100"
  priority
/>

<!-- ❌ INCORRECT -->
<img src="assets/images/logo.png" />
```

---

## Service Pattern

### Centralized API Service
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  private get baseUrl() {
    return this.config.config().apiBaseUrl;
  }

  submitQuery(request: QueryRequest) {
    return this.http.post<QueryResponse>(
      `${this.baseUrl}/query`,
      request
    );
  }

  getQueryStatus(queryId: string) {
    return this.http.get<QueryResponse>(
      `${this.baseUrl}/query/${queryId}`
    );
  }
}
```

### Service with Signals (Observable-less)
```typescript
@Injectable({ providedIn: 'root' })
export class AppState {
  private apiService = inject(ApiService);

  queries = signal<QueryLog[]>([]);
  isLoading = signal(false);

  async loadQueries() {
    this.isLoading.set(true);
    try {
      const data = await firstValueFrom(this.apiService.getQueries());
      this.queries.set(data);
    } finally {
      this.isLoading.set(false);
    }
  }
}
```

---

## TypeScript Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Class** | PascalCase | `QueryFormComponent` |
| **Interface** | PascalCase | `QueryRequest` |
| **Type** | PascalCase | `OperationType` |
| **Enum** | PascalCase | `QueryStatus` |
| **Function** | camelCase | `submitQuery()` |
| **Variable** | camelCase | `queryLogs` |
| **Constant** | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT_MS` |
| **Private member** | `#` or no prefix (convention) | `#apiService` or `private apiService` |
| **Signal** | camelCase + `signal()` | `isLoading = signal(false)` |

---

## Error Handling Pattern

```typescript
// Global error handling via interceptor
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError(error => {
      let userMessage = 'An error occurred';

      if (error.status === 0) {
        userMessage = 'Network error or CORS issue';
      } else if (error.status === 400) {
        userMessage = error.error?.errors?.[0]?.message || 'Invalid request';
      } else if (error.status === 500) {
        userMessage = 'Server error';
      }

      inject(AppState).error.set(userMessage);
      return throwError(() => new Error(userMessage));
    })
  );
};
```

---

## Best Practices Summary

| Practice | ✅ DO | ❌ DON'T |
|----------|--------|-----------|
| **Components** | Standalone, small, focused | NgModules, mega-components |
| **State** | Signals, computed() | Observables in templates |
| **Forms** | ReactiveFormsModule | Template-driven |
| **Binding** | `[class]`, `[style]`, direct property | `ngClass`, `ngStyle` |
| **Control Flow** | `@if`, `@for`, `@switch` | `*ngIf`, `*ngFor`, `*ngSwitch` |
| **DI** | `inject()` function | Constructor parameters |
| **Types** | Strict TypeScript, no `any` | `any` type |
| **Images** | `NgOptimizedImage` (ngSrc) | `<img src>` |

---

## References
- [02-tech-stack.md](02-tech-stack.md) — Stack detallado
- [05-guardrails.md](05-guardrails.md) — Guardrails y restricciones
- Angular Docs: https://angular.dev/
