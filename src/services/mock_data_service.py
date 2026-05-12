"""Mock data service for demo mode."""

from typing import List

from src.models.consulta import Cuenta, EstadoCuenta


class MockDataService:
    """Provides mock data for demo mode."""

    # Mock account database
    MOCK_ACCOUNTS = {
        "12345678Z": [
            Cuenta(id="ACC001", estado=None),
            Cuenta(id="ACC002", estado=None),
            Cuenta(id="ACC003", estado=None),
        ],
        "00000001R": [
            Cuenta(id="ACC004", estado=None),
        ],
        "87654321X": [
            Cuenta(id="ACC005", estado=None),
            Cuenta(id="ACC006", estado=None),
        ],
    }

    # Mock account statuses
    MOCK_STATUSES = {
        "ACC001": "ACTIVO",
        "ACC002": "BLOQUEADO",
        "ACC003": "INACTIVO",
        "ACC004": "ACTIVO",
        "ACC005": "ACTIVO",
        "ACC006": "CERRADO",
    }

    def buscar_por_dni(self, dni: str) -> List[Cuenta]:
        """
        Return mock accounts for a given DNI.

        Args:
            dni: DNI string

        Returns:
            List of Cuenta objects (empty if DNI not found)
        """
        return self.MOCK_ACCOUNTS.get(dni, [])

    def consultar_estados(self, account_ids: List[str]) -> List[EstadoCuenta]:
        """
        Return mock statuses for given account IDs.

        Args:
            account_ids: List of account IDs

        Returns:
            List of EstadoCuenta objects
        """
        return [EstadoCuenta(id=acc_id, estado=self.MOCK_STATUSES.get(acc_id, "DESCONOCIDO")) for acc_id in account_ids]
