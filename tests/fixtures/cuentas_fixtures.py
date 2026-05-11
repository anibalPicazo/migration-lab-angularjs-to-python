"""Test fixtures and helper data."""

from src.models.consulta import Cuenta, EstadoCuenta


def get_mock_cuentas():
    """Return mock cuenta data for testing."""
    return [
        Cuenta(id="ACC001", estado=None),
        Cuenta(id="ACC002", estado=None),
        Cuenta(id="ACC003", estado=None),
    ]


def get_mock_estados():
    """Return mock estado data for testing."""
    return [
        EstadoCuenta(id="ACC001", estado="ACTIVO"),
        EstadoCuenta(id="ACC002", estado="BLOQUEADO"),
        EstadoCuenta(id="ACC003", estado="INACTIVO"),
    ]
