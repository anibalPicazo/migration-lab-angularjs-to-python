# AngularJS to Python/FastAPI Migration

Backend-for-Frontend (BFF) layer implementing server-side rendering for the Angular 1.x account query application.

## Overview

This project migrates the AngularJS 1.x `consulta-estados-cuentas` component to a Python FastAPI application with server-side rendering using Jinja2 templates.

### Features

- **DNI Validation**: Spanish DNI format validation with checksum verification (8 digits + 1 letter)
- **Account Search**: Search accounts by DNI via backend API integration
- **Bulk Operations**: Query status for all accounts or selected accounts
- **Demo Mode**: Built-in mock data for development and testing
- **Server-Side Rendering**: No client-side JavaScript frameworks - pure SSR with Jinja2
- **Backend Integration**: Synchronous HTTP calls to Spring Boot middleware using httpx

## Tech Stack

- Python 3.12+
- FastAPI (web framework)
- Uvicorn (ASGI server)
- Jinja2 (templating)
- httpx (HTTP client)
- Pydantic (data validation)
- pytest (testing)
- respx (HTTP mocking for tests)

## Project Structure

```
src/
  main.py                           # FastAPI app entry point
  config.py                         # Application configuration
  routes/
    consulta_estados_cuentas.py     # Route handlers
  services/
    cuentas_service.py              # Business logic + backend integration
    mock_data_service.py            # Mock data for demo mode
    exceptions.py                   # Custom exceptions
  models/
    consulta.py                     # Pydantic models
  utils/
    validators.py                   # DNI validation
  templates/
    consulta_estados_cuentas.html   # Jinja2 template
tests/
  conftest.py                       # pytest fixtures
  test_validators.py                # DNI validation tests
  test_cuentas_service.py           # Service layer tests
  test_routes.py                    # Integration tests
```

## Setup

### Prerequisites

- Python 3.12+
- uv (Python package manager)

### Installation

1. Create virtual environment with uv:
```bash
uv venv
```

2. Activate virtual environment:
```bash
# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate
```

3. Install dependencies:
```bash
uv sync
```

## Configuration

Create a `.env` file (or set environment variables):

```env
# Application mode: "demo" or "real"
MODE=demo

# Backend API base URL (used in real mode)
API_BASE_URL=http://localhost:8080

# HTTP request timeout (seconds)
TIMEOUT=5.0

# Debug mode
DEBUG=false
```

## Running the Application

### Development Mode (with auto-reload)

```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Access the Application

Open your browser and navigate to:
- Application: http://localhost:8000/consulta-estados-cuentas
- Health Check: http://localhost:8000/health

## Testing

### Run all tests with coverage

```bash
pytest
```

### Run specific test file

```bash
pytest tests/test_validators.py
```

### Run with verbose output

```bash
pytest -v
```

### Generate coverage report

```bash
pytest --cov=src --cov-report=html
```

Coverage report will be generated in `htmlcov/index.html`.

## Demo Mode

The application includes mock data for development:

**Mock DNIs:**
- `12345678Z` - Returns 3 accounts (ACC001, ACC002, ACC003)
- `00000001R` - Returns 1 account (ACC004)
- `87654321X` - Returns 2 accounts (ACC005, ACC006)

**Mock Account Statuses:**
- ACC001: ACTIVO
- ACC002: BLOQUEADO
- ACC003: INACTIVO
- ACC004: ACTIVO
- ACC005: ACTIVO
- ACC006: CERRADO

## API Endpoints

### GET /consulta-estados-cuentas
Render the account query form.

### POST /consulta-estados-cuentas/buscar-dni
Search accounts by DNI.

**Form Data:**
- `dni` (string): Spanish DNI (8 digits + 1 letter)

**Response:** Redirects to GET with results or error

### POST /consulta-estados-cuentas/consultar-todos
Query status for all accounts.

**Form Data:**
- `cuentas_json` (string): JSON array of current accounts

**Response:** Redirects to GET with updated results

### POST /consulta-estados-cuentas/consultar-seleccionados
Query status for selected accounts only.

**Form Data:**
- `cuentas_json` (string): JSON array of current accounts
- `account_id` (array): Selected account IDs

**Response:** Redirects to GET with updated results

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "mode": "demo"
}
```

## DNI Validation

Spanish DNI format: `DDDDDDDDL` (8 digits + 1 letter)

The letter is calculated using modulo 23 algorithm:
```
LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"
expected_letter = LETTERS[digits % 23]
```

**Valid examples:**
- 12345678Z
- 00000001R
- 87654321X

## Development

### Code Quality

```bash
# Run linting
ruff check .

# Run formatting
ruff format .

# Run type checking (via Pydantic models)
# Models are validated automatically at runtime
```

### Project Conventions

- **Naming**: snake_case for files/functions, PascalCase for classes
- **Layer separation**: Routes delegate to Services, Services handle business logic
- **No business logic in routes**: Routes only handle HTTP concerns
- **Type safety**: All data models use Pydantic
- **Synchronous HTTP only**: Use `httpx.Client()`, not `httpx.AsyncClient()`

## License

MIT
