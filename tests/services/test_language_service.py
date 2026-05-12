"""Unit tests for language service."""

import pytest

from src.config import AppConfig
from src.services.language_service import LanguageService


@pytest.fixture
def config():
    """Test configuration with locale settings."""
    return AppConfig(
        default_locale="es_ES",
        supported_locales=["es_ES", "en_EN"],
    )


@pytest.fixture
def language_service(config):
    """Language service instance for testing."""
    return LanguageService(config)


class TestDetectLanguage:
    """Tests for detect_language method."""

    def test_detect_language_from_cookie(self, language_service):
        """Cookie takes priority."""
        result = language_service.detect_language(
            cookie="en_EN",
            query_param="es_ES",
            accept_language_header="es-ES,es;q=0.9",
        )
        assert result == "en_EN"

    def test_detect_language_from_query_param(self, language_service):
        """Query parameter is used when no cookie."""
        result = language_service.detect_language(
            cookie=None,
            query_param="es_ES",
            accept_language_header="en-US,en;q=0.9",
        )
        assert result == "es_ES"

    def test_detect_language_from_header(self, language_service):
        """Accept-Language header is used when no cookie or query."""
        result = language_service.detect_language(
            cookie=None,
            query_param=None,
            accept_language_header="en-US,en;q=0.9,es;q=0.8",
        )
        assert result == "en_EN"

    def test_detect_language_default(self, language_service):
        """Default locale is used when no other source."""
        result = language_service.detect_language(
            cookie=None,
            query_param=None,
            accept_language_header=None,
        )
        assert result == "es_ES"

    def test_detect_language_invalid_cookie(self, language_service):
        """Invalid cookie falls through to next priority."""
        result = language_service.detect_language(
            cookie="invalid",
            query_param="en_EN",
            accept_language_header=None,
        )
        assert result == "en_EN"

    def test_detect_language_unsupported_locale(self, language_service):
        """Unsupported locale in cookie falls through."""
        result = language_service.detect_language(
            cookie="fr_FR",
            query_param=None,
            accept_language_header="en-US",
        )
        assert result == "en_EN"


class TestParseAcceptLanguage:
    """Tests for parse_accept_language helper."""

    def test_parse_accept_language_header(self, language_service):
        """Parse complex Accept-Language header."""
        result = language_service.parse_accept_language(
            "en-US,en;q=0.9,es;q=0.8"
        )
        assert result == ["en-US", "en", "es"]

    def test_parse_accept_language_single(self, language_service):
        """Parse single language code."""
        result = language_service.parse_accept_language("en-US")
        assert result == ["en-US"]

    def test_parse_accept_language_with_spaces(self, language_service):
        """Parse header with extra spaces."""
        result = language_service.parse_accept_language(
            "en-US , en;q=0.9 , es;q=0.8"
        )
        assert result == ["en-US", "en", "es"]

    def test_parse_accept_language_empty(self, language_service):
        """Empty header returns empty list."""
        result = language_service.parse_accept_language("")
        assert result == []

    def test_parse_accept_language_none(self, language_service):
        """None header returns empty list."""
        result = language_service.parse_accept_language(None)
        assert result == []


class TestMapLocaleCode:
    """Tests for map_locale_code helper."""

    def test_map_locale_code_es(self, language_service):
        """Spanish code maps to es_ES."""
        assert language_service.map_locale_code("es") == "es_ES"
        assert language_service.map_locale_code("es-ES") == "es_ES"
        assert language_service.map_locale_code("ES") == "es_ES"
        assert language_service.map_locale_code("es-MX") == "es_ES"

    def test_map_locale_code_en(self, language_service):
        """English code maps to en_EN."""
        assert language_service.map_locale_code("en") == "en_EN"
        assert language_service.map_locale_code("en-US") == "en_EN"
        assert language_service.map_locale_code("en-GB") == "en_EN"
        assert language_service.map_locale_code("EN") == "en_EN"

    def test_map_locale_code_unsupported(self, language_service):
        """Unsupported code returns None."""
        assert language_service.map_locale_code("fr") is None
        assert language_service.map_locale_code("de") is None
        assert language_service.map_locale_code("fr-FR") is None

    def test_map_locale_code_invalid(self, language_service):
        """Invalid code returns None."""
        assert language_service.map_locale_code("") is None
        assert language_service.map_locale_code("invalid") is None
