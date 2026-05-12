"""Cuentas service for backend integration."""

import logging
from typing import List

import httpx
from pydantic import ValidationError

from src.config import AppConfig
from src.models.consulta import ConsultarEstadosRequest, Cuenta, EstadoCuenta
from src.services.exceptions import (
    BackendDataError,
    BackendServerError,
    BackendTimeoutError,
    BackendUnavailableError,
    BackendValidationError,
)
from src.services.mock_data_service import MockDataService

logger = logging.getLogger(__name__)


class CuentasService:
    """Service for querying account information from backend."""

    def __init__(self, config: AppConfig):
        """
        Initialize CuentasService.

        Args:
            config: Application configuration
        """
        self.config = config
        self.mock_service = MockDataService()

        # Initialize httpx client for real mode
        if config.mode == "real":
            self.http_client = httpx.Client(
                base_url=config.api_base_url,
                timeout=config.timeout,
            )
        else:
            self.http_client = None

    def buscar_por_dni(self, dni: str) -> List[Cuenta]:
        """
        Search accounts by DNI.

        Args:
            dni: DNI string (validated)

        Returns:
            List of Cuenta objects (empty if not found)

        Raises:
            BackendTimeoutError: Request timed out
            BackendServerError: Backend returned 500
            BackendUnavailableError: Backend returned 503
            BackendDataError: Invalid response data
        """
        if self.config.mode == "demo":
            logger.info(f"Demo mode: buscar_por_dni({dni})")
            return self.mock_service.buscar_por_dni(dni)

        logger.info(f"Real mode: calling /api/cuentas/buscar-por-dni?dni={dni}")

        try:
            response = self.http_client.get(
                "/api/cuentas/buscar-por-dni",
                params={"dni": dni},
            )

            # Handle 404 (DNI not found) - return empty list
            if response.status_code == 404:
                logger.info(f"DNI {dni} not found (404)")
                return []

            # Handle other error codes
            if response.status_code == 503:
                logger.error("Backend unavailable (503)")
                raise BackendUnavailableError("Backend service unavailable")

            if response.status_code >= 500:
                logger.error(f"Backend server error ({response.status_code})")
                raise BackendServerError(f"Backend error: {response.status_code}")

            if response.status_code >= 400:
                logger.error(f"Backend validation error ({response.status_code})")
                raise BackendValidationError(f"Validation error: {response.status_code}")

            # Parse response
            try:
                data = response.json()
                # Backend returns array directly
                cuentas = [Cuenta(**c) for c in data]
                logger.info(f"Successfully fetched {len(cuentas)} accounts for DNI {dni}")
                return cuentas

            except (ValueError, ValidationError) as e:
                logger.error(f"Invalid response data: {e}")
                raise BackendDataError(f"Invalid response format: {e}")

        except httpx.TimeoutException as e:
            logger.error(f"Backend timeout: {e}")
            raise BackendTimeoutError("Backend request timed out")

        except httpx.RequestError as e:
            logger.error(f"Backend request failed: {e}")
            raise BackendUnavailableError(f"Backend unavailable: {e}")

    def consultar_estados(self, account_ids: List[str]) -> List[EstadoCuenta]:
        """
        Query account statuses for multiple accounts.

        Args:
            account_ids: List of account IDs

        Returns:
            List of EstadoCuenta objects

        Raises:
            BackendTimeoutError: Request timed out
            BackendServerError: Backend returned 500
            BackendUnavailableError: Backend returned 503
            BackendDataError: Invalid response data
        """
        if not account_ids:
            return []

        if self.config.mode == "demo":
            logger.info(f"Demo mode: consultar_estados({len(account_ids)} accounts)")
            return self.mock_service.consultar_estados(account_ids)

        logger.info(f"Real mode: calling /api/cuentas/consultar-estados with {len(account_ids)} accounts")

        try:
            request_body = ConsultarEstadosRequest(accountIds=account_ids)

            response = self.http_client.post(
                "/api/cuentas/consultar-estados",
                json=request_body.model_dump(),
            )

            # Handle error codes
            if response.status_code == 503:
                logger.error("Backend unavailable (503)")
                raise BackendUnavailableError("Backend service unavailable")

            if response.status_code >= 500:
                logger.error(f"Backend server error ({response.status_code})")
                raise BackendServerError(f"Backend error: {response.status_code}")

            if response.status_code >= 400:
                logger.error(f"Backend validation error ({response.status_code})")
                raise BackendValidationError(f"Validation error: {response.status_code}")

            # Parse response
            try:
                data = response.json()
                # Backend returns array directly
                estados = [EstadoCuenta(**e) for e in data]
                logger.info(f"Successfully fetched {len(estados)} account statuses")
                return estados

            except (ValueError, ValidationError) as e:
                logger.error(f"Invalid response data: {e}")
                raise BackendDataError(f"Invalid response format: {e}")

        except httpx.TimeoutException as e:
            logger.error(f"Backend timeout: {e}")
            raise BackendTimeoutError("Backend request timed out")

        except httpx.RequestError as e:
            logger.error(f"Backend request failed: {e}")
            raise BackendUnavailableError(f"Backend unavailable: {e}")

    def close(self) -> None:
        """Close HTTP client if in real mode."""
        if self.http_client:
            self.http_client.close()
