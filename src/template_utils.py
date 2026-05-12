"""Shared template utilities for Jinja2 rendering with Babel translations."""

import gettext
import logging
from pathlib import Path
from typing import Optional

from fastapi import Request
from fastapi.templating import Jinja2Templates

from src.config import config

logger = logging.getLogger(__name__)

# Initialize Jinja2 templates
templates = Jinja2Templates(directory="src/templates")

# Initialize gettext translations
LOCALES_DIR = Path(__file__).parent / "locales"

# Load all available translations
translations = {}
for locale in config.supported_locales:
    try:
        translations[locale] = gettext.translation(
            "messages",
            localedir=str(LOCALES_DIR),
            languages=[locale],
        )
    except FileNotFoundError:
        logger.warning(f"Translation file not found for locale: {locale}")
        translations[locale] = gettext.NullTranslations()


def get_translation(locale: str) -> gettext.NullTranslations:
    """Get translation function for a specific locale."""
    return translations.get(locale, translations.get(config.default_locale))


def get_locale_labels() -> dict[str, str]:
    """Get human-readable labels for locales."""
    return {
        "es_ES": "Español",
        "en_EN": "English",
    }


def get_template_context(request: Request, extra_context: Optional[dict] = None) -> dict:
    """Get template context with locale-aware translations.

    Args:
        request: FastAPI request object
        extra_context: Additional context to merge

    Returns:
        Template context dict with locale and translation function
    """
    locale = getattr(request.state, "locale", config.default_locale)
    trans = get_translation(locale)

    context = {
        "current_locale": locale,
        "_": trans.gettext,
    }

    if extra_context:
        context.update(extra_context)

    return context


# Configure Jinja2 environment with static globals
templates.env.globals["supported_locales"] = config.supported_locales
templates.env.globals["locale_labels"] = get_locale_labels()
