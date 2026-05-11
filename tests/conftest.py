"""Pytest configuration and shared fixtures."""

import pytest
from fastapi.testclient import TestClient

from src.config import AppConfig
from src.main import app
from src.services.cuentas_service import CuentasService


@pytest.fixture
def demo_config():
    """Configuration fixture for demo mode."""
    return AppConfig(
        mode="demo",
        api_base_url="http://localhost:8080",
        timeout=5.0,
    )


@pytest.fixture
def real_config():
    """Configuration fixture for real mode."""
    return AppConfig(
        mode="real",
        api_base_url="http://testserver:8080",
        timeout=5.0,
    )


@pytest.fixture
def cuentas_service_demo(demo_config):
    """CuentasService fixture in demo mode."""
    service = CuentasService(demo_config)
    yield service
    service.close()


@pytest.fixture
def cuentas_service_real(real_config):
    """CuentasService fixture in real mode."""
    service = CuentasService(real_config)
    yield service
    service.close()


@pytest.fixture
def client():
    """FastAPI test client fixture."""
    return TestClient(app)
