"""Integration tests for consulta estados cuentas routes."""

import pytest


class TestConsultaEstadosCuentasRoutes:
    """Test suite for consulta estados cuentas endpoints."""

    def test_get_initial_page(self, client):
        """Test GET /consulta-estados-cuentas renders initial form."""
        response = client.get("/consulta-estados-cuentas")

        assert response.status_code == 200
        assert b"Consulta Estados de Cuentas" in response.content
        assert b'name="dni"' in response.content
        assert b"Buscar" in response.content

    def test_get_page_with_error(self, client):
        """Test GET with error query parameter displays error message."""
        response = client.get("/consulta-estados-cuentas?error=errors.dni_invalid_format")

        assert response.status_code == 200
        assert b"8 d" in response.content  # Part of error message

    def test_post_buscar_dni_valid(self, client):
        """Test POST /buscar-dni with valid DNI redirects with results."""
        response = client.post(
            "/consulta-estados-cuentas/buscar-dni",
            data={"dni": "12345678Z"},
            follow_redirects=False,
        )

        assert response.status_code == 303
        assert "cuentas_json" in response.headers["location"]

    def test_post_buscar_dni_invalid_format(self, client):
        """Test POST /buscar-dni with invalid format redirects with error."""
        response = client.post(
            "/consulta-estados-cuentas/buscar-dni",
            data={"dni": "1234"},
            follow_redirects=False,
        )

        assert response.status_code == 303
        assert "error=errors.dni_invalid_format" in response.headers["location"]

    def test_post_buscar_dni_invalid_checksum(self, client):
        """Test POST /buscar-dni with invalid checksum redirects with error."""
        response = client.post(
            "/consulta-estados-cuentas/buscar-dni",
            data={"dni": "12345678A"},  # Wrong letter
            follow_redirects=False,
        )

        assert response.status_code == 303
        assert "error=errors.dni_invalid_checksum" in response.headers["location"]

    def test_post_buscar_dni_not_found(self, client):
        """Test POST /buscar-dni with DNI not found redirects with error."""
        response = client.post(
            "/consulta-estados-cuentas/buscar-dni",
            data={"dni": "99999999R"},  # Not in mock data
            follow_redirects=False,
        )

        assert response.status_code == 303
        assert "error=errors.dni_not_found" in response.headers["location"]

    def test_full_flow_buscar_and_consultar_todos(self, client):
        """Test full flow: search DNI -> consult all statuses."""
        # Step 1: Search DNI
        response1 = client.post(
            "/consulta-estados-cuentas/buscar-dni",
            data={"dni": "12345678Z"},
            follow_redirects=True,
        )

        assert response1.status_code == 200
        assert b"ACC001" in response1.content
        assert b"ACC002" in response1.content

        # Extract cuentas_json from first response (simplified - in real test would parse)
        import json

        cuentas_json = json.dumps(
            [
                {"id": "ACC001", "estado": None},
                {"id": "ACC002", "estado": None},
                {"id": "ACC003", "estado": None},
            ]
        )

        # Step 2: Consult all statuses
        response2 = client.post(
            "/consulta-estados-cuentas/consultar-todos",
            data={"cuentas_json": cuentas_json, "dni": "12345678Z"},
            follow_redirects=True,
        )

        assert response2.status_code == 200
        assert b"ACTIVO" in response2.content or b"BLOQUEADO" in response2.content
        assert b"12345678Z" in response2.content  # DNI should be preserved

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "mode" in data
