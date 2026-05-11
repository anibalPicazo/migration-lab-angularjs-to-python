"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseSettings):
    """Application configuration loaded from environment or config file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application mode: "demo" or "real"
    mode: str = "demo"

    # Backend API base URL (used in real mode)
    api_base_url: str = "http://localhost:8080"

    # HTTP request timeout in seconds
    timeout: float = 5.0

    # Internationalization
    default_locale: str = "es_ES"
    supported_locales: list[str] = ["es_ES", "en_EN"]

    # FastAPI settings
    app_title: str = "Account Query BFF"
    app_version: str = "0.1.0"
    debug: bool = False


# Global config instance
config = AppConfig()
