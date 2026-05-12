"""FastAPI application main entry point."""

import logging

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import config
from src.routes import consulta_router
from src.routes.language_routes import router as language_router
from src.services.language_service import LanguageService

# Configure logging
logging.basicConfig(
    level=logging.INFO if not config.debug else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

# Initialize services
language_service = LanguageService(config)


# Language detection middleware
class LanguageMiddleware(BaseHTTPMiddleware):
    """Middleware to detect and store user's language preference."""

    async def dispatch(self, request: Request, call_next):
        """Detect language and store in request state."""
        # Get language preference from various sources
        cookie = request.cookies.get("lang")
        query_param = request.query_params.get("lang")
        accept_header = request.headers.get("accept-language")

        # Detect language
        locale = language_service.detect_language(
            cookie=cookie,
            query_param=query_param,
            accept_language_header=accept_header,
        )

        # Store in request state
        request.state.locale = locale

        response = await call_next(request)
        return response


# Initialize FastAPI app
app = FastAPI(
    title=config.app_title,
    version=config.app_version,
    debug=config.debug,
)

# Add language detection middleware
app.add_middleware(LanguageMiddleware)


# Mount static files
# app.mount("/static", StaticFiles(directory="src/static"), name="static")

# Register routes
app.include_router(consulta_router)
app.include_router(language_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": config.app_version,
        "mode": config.mode,
    }


@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info(f"Starting application in {config.mode} mode")
    logger.info(f"API base URL: {config.api_base_url}")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("Shutting down application")
