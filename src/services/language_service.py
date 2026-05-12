"""Language detection and preference management service."""

import logging
from typing import Optional

from src.config import AppConfig

logger = logging.getLogger(__name__)


class LanguageService:
    """Service for detecting and managing user language preferences."""

    def __init__(self, config: AppConfig):
        """Initialize language service with configuration.

        Args:
            config: Application configuration with locale settings
        """
        self.config = config

    def detect_language(
        self,
        cookie: Optional[str] = None,
        query_param: Optional[str] = None,
        accept_language_header: Optional[str] = None,
    ) -> str:
        """Detect user's preferred language using priority order.

        Priority: cookie → query param → Accept-Language header → default

        Args:
            cookie: Value from 'lang' cookie
            query_param: Value from '?lang=' query parameter
            accept_language_header: Value from 'Accept-Language' HTTP header

        Returns:
            Detected locale code (es_ES or en_EN)
        """
        # Priority 1: Cookie
        if cookie and cookie in self.config.supported_locales:
            logger.debug(f"Language detected: {cookie} (source: cookie)")
            return cookie

        # Priority 2: Query parameter
        if query_param and query_param in self.config.supported_locales:
            logger.debug(f"Language detected: {query_param} (source: query)")
            return query_param

        # Priority 3: Accept-Language header
        if accept_language_header:
            try:
                parsed_codes = self.parse_accept_language(accept_language_header)
                for code in parsed_codes:
                    mapped_locale = self.map_locale_code(code)
                    if mapped_locale:
                        logger.debug(f"Language detected: {mapped_locale} (source: header)")
                        return mapped_locale
            except Exception as e:
                logger.warning(
                    f"Failed to parse Accept-Language header: {accept_language_header}",
                    exc_info=e,
                )

        # Priority 4: Default from config
        default_locale = self.config.default_locale
        logger.debug(f"Language detected: {default_locale} (source: default)")
        return default_locale

    def parse_accept_language(self, header: str) -> list[str]:
        """Parse Accept-Language header to extract language codes.

        Example: "en-US,en;q=0.9,es;q=0.8" → ["en-US", "en", "es"]

        Args:
            header: Accept-Language header value

        Returns:
            List of language codes ordered by priority
        """
        if not header:
            return []

        codes = []
        for entry in header.split(","):
            # Split by semicolon to separate language from quality value
            parts = entry.split(";")
            code = parts[0].strip()
            if code:
                codes.append(code)

        return codes

    def map_locale_code(self, code: str) -> Optional[str]:
        """Map language code to supported locale.

        Maps various language code formats to supported locales:
        - "es", "es-ES", "ES" → "es_ES"
        - "en", "en-US", "en-GB", "EN" → "en_EN"

        Args:
            code: Language code from browser or query param

        Returns:
            Mapped locale code (es_ES or en_EN) or None if unsupported
        """
        # Normalize to lowercase
        normalized = code.lower().strip()

        # Extract base language (first 2 characters)
        base_lang = normalized.split("-")[0]

        # Map to supported locales
        if base_lang == "es":
            return "es_ES"
        elif base_lang == "en":
            return "en_EN"
        else:
            return None
