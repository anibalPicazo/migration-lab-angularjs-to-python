"""Language-related Pydantic models."""

from pydantic import BaseModel, Field


class SetLanguageRequest(BaseModel):
    """Request body for POST /api/set-language."""

    locale: str = Field(
        ...,
        description="Language locale code (es_ES or en_EN)",
        pattern="^(es_ES|en_EN)$",
    )


class LanguageContext(BaseModel):
    """Language detection result used in templates."""

    current_locale: str  # Detected locale (es_ES or en_EN)
    supported_locales: list[str]  # From AppConfig
    locale_labels: dict[str, str]  # {"es_ES": "Español", "en_EN": "English"}
