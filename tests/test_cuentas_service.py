"""Unit and integration tests for CuentasService."""

import pytest
import respx
from httpx import Response

from src.models.consulta import Cuenta, EstadoCuenta
from src.services.exceptions import (
    BackendDataError,
    BackendServerError,
    BackendTimeoutError,
    BackendUnavailableError,
    BackendValidationError,
)


class TestCuentasServiceDemo:
    """Test suite for CuentasService in demo mode."""

    def test_buscar_por_dni_found(self, cuentas_service_demo):
        """Test buscar_por_dni returns mock data for known DNI."""
        cuentas = cuentas_service_demo.buscar_por_dni("12345678Z")

        assert len(cuentas) == 3
        assert cuentas[0].id == "ACC001"
        assert cuentas[0].estado is None

    def test_buscar_por_dni_not_found(self, cuentas_service_demo):
        """Test buscar_por_dni returns empty list for unknown DNI."""
        cuentas = cuentas_service_demo.buscar_por_dni("99999999R")

        assert len(cuentas) == 0

    def test_consultar_estados(self, cuentas_service_demo):
        """Test consultar_estados returns mock statuses."""
        estados = cuentas_service_demo.consultar_estados(["ACC001", "ACC003"])

        assert len(estados) == 2
        assert estados[0].id == "ACC001"
        assert estados[0].estado == "ACTIVO"
        assert estados[1].id == "ACC003"
        assert estados[1].estado == "INACTIVO"

    def test_consultar_estados_empty_list(self, cuentas_service_demo):
        """Test consultar_estados with empty list returns empty list."""
        estados = cuentas_service_demo.consultar_estados([])

        assert len(estados) == 0


class TestCuentasServiceReal:
    """Test suite for CuentasService in real mode with httpx mocking."""

    @respx.mock
    def test_buscar_por_dni_success(self, cuentas_service_real):
        """Test successful account retrieval from backend."""
        mock_response = [
            {"id": "ACC001", "estado": None},
            {"id": "ACC002", "estado": None},
        ]

        respx.get("http://testserver:8080/api/cuentas/buscar-por-dni").mock(
            return_value=Response(200, json=mock_response)
        )

        cuentas = cuentas_service_real.buscar_por_dni("12345678Z")

        assert len(cuentas) == 2
        assert cuentas[0].id == "ACC001"
        assert cuentas[1].id == "ACC002"

    @respx.mock
    def test_buscar_por_dni_not_found_404(self, cuentas_service_real):
        """Test 404 response returns empty list."""
        respx.get("http://testserver:8080/api/cuentas/buscar-por-dni").mock(
            return_value=Response(404)
        )

        cuentas = cuentas_service_real.buscar_por_dni("99999999R")

        assert len(cuentas) == 0

    @respx.mock
    def test_buscar_por_dni_timeout(self, cuentas_service_real):
        """Test timeout raises BackendTimeoutError."""
        import httpx

        respx.get("http://testserver:8080/api/cuentas/buscar-por-dni").mock(
            side_effect=httpx.TimeoutException("Timeout")
        )

        with pytest.raises(BackendTimeoutError):
            cuentas_service_real.buscar_por_dni("12345678Z")

    @respx.mock
    def test_buscar_por_dni_server_error_500(self, cuentas_service_real):
        """Test 500 response raises BackendServerError."""
        respx.get("http://testserver:8080/api/cuentas/buscar-por-dni").mock(
            return_value=Response(500)
        )

        with pytest.raises(BackendServerError):
            cuentas_service_real.buscar_por_dni("12345678Z")

    @respx.mock
    def test_buscar_por_dni_unavailable_503(self, cuentas_service_real):
        """Test 503 response raises BackendUnavailableError."""
        respx.get("http://testserver:8080/api/cuentas/buscar-por-dni").mock(
            return_value=Response(503)
        )

        with pytest.raises(BackendUnavailableError):
            cuentas_service_real.buscar_por_dni("12345678Z")

    @respx.mock
    def test_buscar_por_dni_validation_error_400(self, cuentas_service_real):
        """Test 400 response raises BackendValidationError."""
        respx.get("http://testserver:8080/api/cuentas/buscar-por-dni").mock(
            return_value=Response(400)
        )

        with pytest.raises(BackendValidationError):
            cuentas_service_real.buscar_por_dni("invalid")

    @respx.mock
    def test_buscar_por_dni_invalid_json(self, cuentas_service_real):
        """Test invalid JSON response raises BackendDataError."""
        respx.get("http://testserver:8080/api/cuentas/buscar-por-dni").mock(
            return_value=Response(200, text="not json")
        )

        with pytest.raises(BackendDataError):
            cuentas_service_real.buscar_por_dni("12345678Z")

    @respx.mock
    def test_consultar_estados_success(self, cuentas_service_real):
        """Test successful status query."""
        mock_response = [
            {"id": "ACC001", "estado": "ACTIVO"},
            {"id": "ACC002", "estado": "BLOQUEADO"},
        ]

        respx.post("http://testserver:8080/api/cuentas/consultar-estados").mock(
            return_value=Response(200, json=mock_response)
        )

        estados = cuentas_service_real.consultar_estados(["ACC001", "ACC002"])

        assert len(estados) == 2
        assert estados[0].id == "ACC001"
        assert estados[0].estado == "ACTIVO"

    @respx.mock
    def test_consultar_estados_timeout(self, cuentas_service_real):
        """Test timeout during status query."""
        import httpx

        respx.post("http://testserver:8080/api/cuentas/consultar-estados").mock(
            side_effect=httpx.TimeoutException("Timeout")
        )

        with pytest.raises(BackendTimeoutError):
            cuentas_service_real.consultar_estados(["ACC001"])

    @respx.mock
    def test_consultar_estados_server_error(self, cuentas_service_real):
        """Test server error during status query."""
        respx.post("http://testserver:8080/api/cuentas/consultar-estados").mock(
            return_value=Response(500)
        )

        with pytest.raises(BackendServerError):
            cuentas_service_real.consultar_estados(["ACC001"])
