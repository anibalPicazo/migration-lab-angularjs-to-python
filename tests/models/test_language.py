"""Unit tests for language models."""

import pytest
from pydantic import ValidationError

from src.models.language import LanguageContext, SetLanguageRequest


class TestSetLanguageRequest:
    """Tests for SetLanguageRequest model."""

    def test_set_language_request_valid_es(self):
        """Valid Spanish locale passes validation."""
        request = SetLanguageRequest(locale="es_ES")
        assert request.locale == "es_ES"

    def test_set_language_request_valid_en(self):
        """Valid English locale passes validation."""
        request = SetLanguageRequest(locale="en_EN")
        assert request.locale == "en_EN"

    def test_set_language_request_invalid(self):
        """Invalid locale fails validation."""
        with pytest.raises(ValidationError) as exc_info:
            SetLanguageRequest(locale="fr_FR")

        errors = exc_info.value.errors()
        assert len(errors) > 0
        assert "pattern" in str(errors[0])

    def test_set_language_request_invalid_format(self):
        """Locale with invalid format fails validation."""
        with pytest.raises(ValidationError):
            SetLanguageRequest(locale="invalid")

        with pytest.raises(ValidationError):
            SetLanguageRequest(locale="es-ES")  # Wrong separator

        with pytest.raises(ValidationError):
            SetLanguageRequest(locale="")


class TestLanguageContext:
    """Tests for LanguageContext model."""

    def test_language_context_creation(self):
        """Language context can be created with all fields."""
        context = LanguageContext(
            current_locale="es_ES",
            supported_locales=["es_ES", "en_EN"],
            locale_labels={"es_ES": "Español", "en_EN": "English"},
        )

        assert context.current_locale == "es_ES"
        assert context.supported_locales == ["es_ES", "en_EN"]
        assert context.locale_labels == {"es_ES": "Español", "en_EN": "English"}

    def test_language_context_minimal(self):
        """Language context requires all fields."""
        with pytest.raises(ValidationError):
            LanguageContext()
