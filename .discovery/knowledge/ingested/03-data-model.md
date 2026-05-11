# Data Model — Modelo de Datos

## Core Entities

### QueryRequest (Entrada del usuario)
Estructura de solicitud que el usuario envía a través del formulario.

```typescript
interface QueryRequest {
  id?: string;              // UUID (generado por frontend)
  operationType: string;    // Tipo de operación: consulta, transacción, etc.
  parameters: Record<string, any>;  // Parámetros dinámicos según operationType
  timestamp?: string;       // ISO 8601 timestamp
  requestedAt: Date;        // Fecha local de solicitud
}
```

### QueryResponse (Respuesta del Middleware)
Estructura de respuesta estándar del Middleware.

```typescript
interface QueryResponse {
  id: string;                    // UUID de la solicitud
  status: 'success' | 'error' | 'pending';
  data?: any;                    // Payload dinámico según operationType
  errors?: ErrorDetail[];        // Errores (si status = 'error')
  metadata?: {
    processingTimeMs: number;
    requestId: string;
    timestamp: string;
  };
}

interface ErrorDetail {
  code: string;        // Error code (e.g., VAL_001)
  message: string;     // Human-readable message
  field?: string;      // Field affected (si aplica)
  details?: any;       // Additional context
}
```

### QueryLog (Registro de operación)
Entrada en el log que rastrea el estado de una operación en el UI.

```typescript
interface QueryLog {
  id: string;                // UUID único del log
  queryId: string;           // FK to QueryRequest.id
  status: 'submitted' | 'processing' | 'completed' | 'failed';
  phase: string;             // Fase de procesamiento (e.g., "validation", "execution")
  message: string;           // Mensaje de estado (localizado)
  timestamp: Date;           // Hora del evento
  details?: any;             // Detalles adicionales
}
```

### AppConfig (Configuración Runtime)
Cargada desde `assets/config.json` en startup.

```typescript
interface AppConfig {
  apiBaseUrl: string;              // Base URL del Middleware
  defaultLang: 'es-ES' | 'en-EN';  // Idioma por defecto
  supportedLangs: string[];        // Idiomas soportados
  requestTimeoutMs: number;        // Timeout global (ms)
  environment?: 'development' | 'staging' | 'production';
}
```

---

## State Model (Signals)

### Global State (App Level)

```typescript
// core/state/app.state.ts
@Injectable({ providedIn: 'root' })
export class AppState {
  // Config
  config = signal<AppConfig | null>(null);
  
  // I18n
  currentLang = signal<string>('es-ES');
  
  // UI State
  isLoading = signal(false);
  error = signal<string | null>(null);
  
  // Operations
  recentQueries = signal<QueryLog[]>([]);
  activeQueryId = signal<string | null>(null);
}
```

### Component Local State

Cada componente gestiona su propio estado via Signals:

```typescript
@Component({
  selector: 'app-query-form',
  template: `...`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QueryFormComponent {
  // Form inputs
  selectedOperation = signal<string>('');
  formData = signal<Record<string, any>>({});
  
  // Derived
  isFormValid = computed(() => {
    return this.selectedOperation() !== '' &&
           Object.keys(this.formData()).length > 0;
  });
  
  // Methods
  submit() {
    if (this.isFormValid()) {
      // Submit to API
    }
  }
}
```

---

## API Contracts

### Endpoint: POST /api/query
**Purpose**: Lanzar una operación de consulta

**Request**:
```json
{
  "operationType": "check_status",
  "parameters": {
    "documentId": "12345",
    "documentType": "DNI"
  }
}
```

**Response (200/201)**:
```json
{
  "id": "req-uuid-1234",
  "status": "success",
  "data": {
    "state": "active",
    "details": {...}
  },
  "metadata": {
    "processingTimeMs": 245,
    "requestId": "backend-id-9999",
    "timestamp": "2025-04-07T14:23:45Z"
  }
}
```

**Error Response (400/500)**:
```json
{
  "id": "req-uuid-1234",
  "status": "error",
  "errors": [
    {
      "code": "VAL_001",
      "message": "Invalid document type",
      "field": "documentType"
    }
  ]
}
```

### Endpoint: GET /api/config
**Purpose**: Obtener configuración (Optional / for verification)

**Response**:
```json
{
  "version": "1.0",
  "features": ["queries", "results", "logs"]
}
```

---

## Storage Strategy

### Session Storage (Memory Only)
- **Queries**: Mantenidos en Signals durante la sesión
- **Logs**: Buffer temporal de operaciones (último 100)
- **Form State**: Estado temporal del formulario activo
- **Selection**: Tabla selectedRow, filtros activos

### Persistent Storage (NOT Supported)
- ❌ NO `localStorage` / `sessionStorage`
- ❌ NO IndexedDB
- ❌ NO Cookies

**Rationale**: Stateless SPA — simplificación, sin sync issues.

---

## Relationships & Invariants

### Query Lifecycle
```
QueryRequest (enviado)
    ↓
QueryLog (submitted)
    ↓
QueryLog (processing)
    ↓
QueryResponse (received)
    ↓
QueryLog (completed/failed)
```

### Invariants
1. Cada `QueryRequest` genera exactamente una `QueryResponse`
2. Un `QueryLog` siempre pertenece a exactamente una `QueryRequest` (FK: queryId)
3. Un `QueryResponse` es inmutable una vez recibida
4. `recentQueries` es FIFO buffer, máximo 100 entradas
5. Error response siempre contiene al menos 1 ErrorDetail

---

## Validation Rules

### QueryRequest Validation (Frontend)
```typescript
// Executed before sending to API
export function validateQueryRequest(req: QueryRequest): string[] {
  const errors: string[] = [];
  
  if (!req.operationType) {
    errors.push('Operation type is required');
  }
  
  if (!req.parameters || Object.keys(req.parameters).length === 0) {
    errors.push('At least one parameter is required');
  }
  
  return errors;
}
```

### QueryResponse Validation (Frontend)
```typescript
// Validate response structure
export function validateQueryResponse(resp: any): resp is QueryResponse {
  return resp.id &&
         (resp.status === 'success' || resp.status === 'error' || resp.status === 'pending') &&
         (resp.data || resp.errors);
}
```

---

## Type Safety (TypeScript)

All entities exported from `core/models/`:

```typescript
// core/models/query.model.ts
export type OperationType = 'check_status' | 'consulta_dni' | 'update_endpoint';

export interface QueryRequest {
  id?: string;
  operationType: OperationType;
  parameters: Record<string, any>;
  timestamp?: string;
  requestedAt: Date;
}

// core/models/api.model.ts
export type ResponseStatus = 'success' | 'error' | 'pending';

export interface QueryResponse {
  id: string;
  status: ResponseStatus;
  data?: any;
  errors?: ErrorDetail[];
  metadata?: ResponseMetadata;
}
```

---

## Error Taxonomy

| Error Code | Category | Description | HTTP Status |
|------------|----------|-------------|-------------|
| `VAL_001` | Validation | Invalid input parameter | 400 |
| `VAL_002` | Validation | Missing required field | 400 |
| `AUTH_001` | Auth | Unauthorized (future) | 401 |
| `PROC_001` | Processing | Middleware processing error | 500 |
| `PROC_002` | Processing | External system unavailable | 503 |
| `TIMEOUT_001` | Network | Request timeout | 408 |

---

## Data Privacy & Security

### PII (Personally Identifiable Information)
- If handling DNI/ID numbers → Document handling in [05-guardrails.md](05-guardrails.md)
- Frontend does NOT store PII in session
- Logs do NOT contain sensitive parameters
- HTTPS only in production

### Audit Trail
- Each `QueryLog` entry includes timestamp
- Request/Response IDs enable traceability
- No deletion of logs during session (append-only)

---

## References
- [02-tech-stack.md](02-tech-stack.md) — TypeScript strict mode
- [04-patterns.md](04-patterns.md) — Convenciones de clase/interfaz
- [05-guardrails.md](05-guardrails.md) — Restricciones
