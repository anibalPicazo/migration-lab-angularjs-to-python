"""Integration tests for language routes."""

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client():
    """Test client for FastAPI app."""
    return TestClient(app)


class TestSetLanguageEndpoint:
    """Tests for POST /api/set-language endpoint."""

    def test_set_language_success(self, client):
        """Successful language switch sets cookie and redirects."""
        response = client.post(
            "/api/set-language",
            data={"locale": "en_EN"},
            follow_redirects=False,
        )

        assert response.status_code == 302
        assert "lang" in response.cookies
        assert response.cookies["lang"] == "en_EN"

    def test_set_language_redirect_to_referer(self, client):
        """Redirects to Referer URL if provided."""
        response = client.post(
            "/api/set-language",
            data={"locale": "en_EN"},
            headers={"referer": "http://testserver/consulta-estados-cuentas"},
            follow_redirects=False,
        )

        assert response.status_code == 302
        assert response.headers["location"] == "http://testserver/consulta-estados-cuentas"

    def test_set_language_redirect_to_root_without_referer(self, client):
        """Redirects to root when no Referer header."""
        response = client.post(
            "/api/set-language",
            data={"locale": "es_ES"},
            follow_redirects=False,
        )

        assert response.status_code == 302
        assert response.headers["location"] == "/"

    def test_set_language_invalid_locale(self, client):
        """Invalid locale returns 422 validation error."""
        response = client.post(
            "/api/set-language",
            data={"locale": "invalid"},
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        assert any("pattern" in str(error) for error in data["detail"])

    def test_set_language_cookie_attributes(self, client):
        """Cookie has correct security attributes."""
        response = client.post(
            "/api/set-language",
            data={"locale": "en_EN"},
            follow_redirects=False,
        )

        # Get cookie from Set-Cookie header
        set_cookie_header = response.headers.get("set-cookie", "")

        assert "lang=en_EN" in set_cookie_header
        assert "Max-Age=604800" in set_cookie_header  # 7 days
        assert "HttpOnly" in set_cookie_header
        assert "SameSite=lax" in set_cookie_header or "samesite=lax" in set_cookie_header.lower()

    def test_set_language_switch_from_es_to_en(self, client):
        """Can switch from Spanish to English."""
        # Set Spanish first
        response1 = client.post(
            "/api/set-language",
            data={"locale": "es_ES"},
            follow_redirects=False,
        )
        assert response1.status_code == 302
        assert response1.cookies["lang"] == "es_ES"

        # Switch to English
        response2 = client.post(
            "/api/set-language",
            data={"locale": "en_EN"},
            follow_redirects=False,
        )
        assert response2.status_code == 302
        assert response2.cookies["lang"] == "en_EN"

    def test_set_language_missing_locale_field(self, client):
        """Missing locale field returns validation error."""
        response = client.post(
            "/api/set-language",
            data={},
        )

        assert response.status_code == 422

    def test_set_language_wrong_http_method(self, client):
        """GET method not allowed on language endpoint."""
        response = client.get("/api/set-language")

        assert response.status_code == 405  # Method Not Allowed
