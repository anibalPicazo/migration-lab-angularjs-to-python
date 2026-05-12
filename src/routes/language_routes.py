"""Language switching routes."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from src.config import AppConfig, config
from src.models.language import SetLanguageRequest

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/set-language")
def set_language(
    request: Request,
    language_request: SetLanguageRequest,
    app_config: AppConfig = Depends(lambda: config),
) -> RedirectResponse:
    """Set user's language preference via cookie.

    Args:
        request: FastAPI request object
        language_request: Validated language preference request
        app_config: Application configuration

    Returns:
        RedirectResponse with updated language cookie
    """
    locale = language_request.locale

    # Determine redirect URL (Referer or fallback to root)
    referer: Optional[str] = request.headers.get("referer")
    redirect_url = referer if referer else "/"

    # Log language change
    current_locale = request.cookies.get("lang", app_config.default_locale)
    logger.info(f"User switched language: {current_locale} → {locale}")

    # Create redirect response
    response = RedirectResponse(url=redirect_url, status_code=302)

    # Set cookie with secure attributes
    response.set_cookie(
        key="lang",
        value=locale,
        max_age=604800,  # 7 days in seconds
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
    )

    return response
