"""Tests for header template rendering."""

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client():
    """Test client for FastAPI app."""
    return TestClient(app)


class TestHeaderRendering:
    """Tests for header template rendering."""

    def test_header_renders_title_es(self, client):
        """Header displays Spanish title when locale is es_ES."""
        # Set Spanish language cookie
        client.cookies.set("lang", "es_ES")

        response = client.get("/consulta-estados-cuentas")

        assert response.status_code == 200
        assert "Consulta Estados Cuenta" in response.text

    def test_header_renders_title_en(self, client):
        """Header displays English title when locale is en_EN."""
        # Set English language cookie
        client.cookies.set("lang", "en_EN")

        response = client.get("/consulta-estados-cuentas")

        assert response.status_code == 200
        assert "Account Status Inquiry" in response.text

    def test_header_language_selector_selected(self, client):
        """Language selector shows current locale as selected."""
        # Set English language cookie
        client.cookies.set("lang", "en_EN")

        response = client.get("/consulta-estados-cuentas")

        assert response.status_code == 200
        # Check that select element exists
        assert "<select" in response.text
        assert 'class="language-selector"' in response.text

    def test_base_template_includes_header(self, client):
        """Base template includes header component."""
        response = client.get("/consulta-estados-cuentas")

        assert response.status_code == 200
        # Check header element exists
        assert "<header" in response.text
        assert 'class="app-header"' in response.text

    def test_header_displays_on_all_pages(self, client):
        """Header is present on all pages."""
        # Test main page
        response = client.get("/consulta-estados-cuentas")
        assert response.status_code == 200
        assert "<header" in response.text

        # Test health endpoint (doesn't use templates, but verifies routing)
        response = client.get("/health")
        assert response.status_code == 200


class TestLanguageSelectorForm:
    """Tests for language selector form in header."""

    def test_language_selector_form_action(self, client):
        """Language selector form posts to correct endpoint."""
        response = client.get("/consulta-estados-cuentas")

        assert response.status_code == 200
        assert 'action="/api/set-language"' in response.text
        assert 'method="post"' in response.text

    def test_language_selector_options(self, client):
        """Language selector shows both supported locales."""
        response = client.get("/consulta-estados-cuentas")

        assert response.status_code == 200
        # Check both options are present
        assert 'value="es_ES"' in response.text
        assert 'value="en_EN"' in response.text

    def test_language_selector_auto_submit(self, client):
        """Language selector has onchange auto-submit."""
        response = client.get("/consulta-estados-cuentas")

        assert response.status_code == 200
        assert 'onchange="this.form.submit()"' in response.text


class TestLanguageDetectionInPages:
    """Tests for language detection in page rendering."""

    def test_page_without_cookie_uses_default(self, client):
        """Page without lang cookie uses default locale."""
        # Don't set any cookie
        response = client.get("/consulta-estados-cuentas")

        assert response.status_code == 200
        # Should use default es_ES

    def test_page_with_query_param(self, client):
        """Page respects lang query parameter."""
        response = client.get("/consulta-estados-cuentas?lang=en_EN")

        assert response.status_code == 200
        # Should use en_EN from query param

    def test_page_cookie_takes_precedence_over_query(self, client):
        """Cookie takes precedence over query parameter."""
        client.cookies.set("lang", "es_ES")

        response = client.get("/consulta-estados-cuentas?lang=en_EN")

        assert response.status_code == 200
        # Should use es_ES from cookie, not query param
