"""Pydantic models for consulta estados cuentas."""

from typing import List

from pydantic import BaseModel, field_validator


class Cuenta(BaseModel):
    """Account model."""

    id: str
    estado: str | None = None


class DniBuscarForm(BaseModel):
    """DNI search form model."""

    dni: str

    @field_validator("dni")
    @classmethod
    def dni_not_empty(cls, v: str) -> str:
        """Validate DNI is not empty."""
        if not v or not v.strip():
            raise ValueError("errors.dni_required")
        return v.strip()


class EstadoCuenta(BaseModel):
    """Account status model."""

    id: str
    estado: str


class CuentasResponse(BaseModel):
    """Response from buscar-por-dni endpoint."""

    cuentas: List[Cuenta]


class ConsultarEstadosRequest(BaseModel):
    """Request for consultar-estados endpoint."""

    accountIds: List[str]

    @field_validator("accountIds")
    @classmethod
    def account_ids_not_empty(cls, v: List[str]) -> List[str]:
        """Validate account IDs list is not empty."""
        if not v:
            raise ValueError("errors.account_ids_required")
        return v


class ConsultarEstadosResponse(BaseModel):
    """Response from consultar-estados endpoint."""

    estados: List[EstadoCuenta]
