"""FastAPI application main entry point."""

import logging

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.config import config
from src.routes import consulta_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not config.debug else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=config.app_title,
    version=config.app_version,
    debug=config.debug,
)

# Mount static files
# app.mount("/static", StaticFiles(directory="src/static"), name="static")

# Register routes
app.include_router(consulta_router)


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
