# Descripción técnica

Crear la aplicación web en Python 3.12, usando un entorno virtual estándar (venv) gestionado mediante uv, con una arquitectura de frontend server-side que consume endpoints (aplicación Spring Boot o mocks).

## 🔹 Entorno

- Python 3.12
- Virtualización con venv, creada y gestionada mediante uv
- Gestión moderna de dependencias con:
  - `pyproject.toml` (dependencias directas)
  - `uv.lock` (versiones bloqueadas y reproducibles)

## 🔹 Dependencias de runtime (aplicación)

| Dependencia | Descripción |
|---|---|
| fastapi | Framework web principal (sirve HTML y actúa como BFF hacia Spring Boot) |
| uvicorn[standard] | Servidor ASGI para ejecutar la aplicación |
| jinja2 | Renderizado de HTML (UI server-side) |
| httpx | Cliente HTTP para consumir endpoints (modo síncrono) |
| pydantic | Modelado y validación de datos provenientes del backend |
| pydantic-settings | Gestión de configuración por entorno (modo demo vs real, URLs, idioma, etc.) |
| Babel | Internacionalización (i18n) de la UI usando gettext |

## 🔹 Dependencias de desarrollo / testing

| Dependencia | Descripción |
|---|---|
| pytest | Framework de testing |
| respx | Mock de llamadas HTTP (mock de httpx en tests) |
| ruff | Linting y formateo de código |

Estas dependencias se gestionan como dependencias de desarrollo mediante uv.

## 🔹 Notas de arquitectura

La aplicación puede ejecutarse en dos modos:

- **Modo demo:** usando mocks/fixtures locales, sin depender de Spring Boot
- **Modo real:** apuntando a una aplicación Spring Boot externa mediante HTTP

### Otras consideraciones:

- La UI es server-side, basada en HTML + CSS simple (sin frameworks JavaScript)
- El multi-idioma se gestiona en el backend mediante Babel/gettext
- FastAPI actúa como intermediario (BFF) entre el navegador y Spring Boot, evitando problemas de CORS desde el navegador
- La selección de modo (demo / real) y de idioma se controla por configuración de entorno