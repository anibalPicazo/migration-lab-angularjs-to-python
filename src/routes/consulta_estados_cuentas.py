"""FastAPI routes for consulta estados cuentas."""

import logging
from typing import List

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from src.config import config
from src.models.consulta import Cuenta
from src.services.cuentas_service import CuentasService
from src.services.exceptions import BackendError
from src.utils.validators import validate_dni

logger = logging.getLogger(__name__)

router = APIRouter()
templates = Jinja2Templates(directory="src/templates")

# Initialize service
cuentas_service = CuentasService(config)


@router.get("/consulta-estados-cuentas", response_class=HTMLResponse)
async def consulta_estados_cuentas_get(
    request: Request,
    dni: str = "",
    error: str = "",
    cuentas_json: str = "",
):
    """
    Render the consulta estados cuentas page.

    Args:
        request: FastAPI request object
        dni: DNI value (from redirect)
        error: Error message key (from redirect)
        cuentas_json: JSON string of cuentas (from redirect)

    Returns:
        Rendered HTML template
    """
    # Parse cuentas if provided
    cuentas: List[Cuenta] = []
    cuentas_list = []  # For JSON serialization in template
    if cuentas_json:
        import json

        try:
            cuentas_data = json.loads(cuentas_json)
            cuentas = [Cuenta(**c) for c in cuentas_data]
            cuentas_list = cuentas_data  # Keep original dict format for template
        except (ValueError, KeyError):
            logger.error(f"Failed to parse cuentas_json: {cuentas_json}")

    return templates.TemplateResponse(
        request=request,
        name="consulta_estados_cuentas.html",
        context={
            "dni": dni,
            "error": error,
            "cuentas": cuentas,
            "cuentas_list": cuentas_list,
        },
    )


@router.post("/consulta-estados-cuentas/buscar-dni")
async def buscar_dni_post(dni: str = Form(...)):
    """
    Handle DNI search form submission.

    Args:
        dni: DNI from form input

    Returns:
        Redirect to GET with results or error
    """
    # Validate DNI format and checksum
    validation_result = validate_dni(dni)

    if not validation_result["valid"]:
        error_key = validation_result["error"]
        logger.info(f"DNI validation failed: {error_key}")
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&error={error_key}",
            status_code=303,
        )

    # Search accounts by DNI
    try:
        cuentas = cuentas_service.buscar_por_dni(dni)

        if not cuentas:
            logger.info(f"No accounts found for DNI: {dni}")
            return RedirectResponse(
                url=f"/consulta-estados-cuentas?dni={dni}&error=errors.dni_not_found",
                status_code=303,
            )

        # Serialize cuentas to JSON for redirect
        import json

        cuentas_json = json.dumps([c.model_dump() for c in cuentas])

        logger.info(f"Found {len(cuentas)} accounts for DNI: {dni}")
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&cuentas_json={cuentas_json}",
            status_code=303,
        )

    except BackendError as e:
        logger.error(f"Backend error during buscar_por_dni: {e}")
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&error=errors.backend_error",
            status_code=303,
        )


@router.post("/consulta-estados-cuentas/consultar-todos")
async def consultar_todos_post(
    cuentas_json: str = Form(...),
    dni: str = Form(""),
):
    """
    Query status for all accounts.

    Args:
        cuentas_json: JSON string of current cuentas
        dni: DNI value to preserve in redirect

    Returns:
        Redirect to GET with updated results
    """
    import json
    from urllib.parse import quote

    try:
        # Parse cuentas
        cuentas_data = json.loads(cuentas_json)
        account_ids = [c["id"] for c in cuentas_data]

        # Query statuses
        estados = cuentas_service.consultar_estados(account_ids)

        # Update cuentas with estados
        estado_map = {e.id: e.estado for e in estados}
        for cuenta in cuentas_data:
            cuenta["estado"] = estado_map.get(cuenta["id"], "DESCONOCIDO")

        # Serialize updated cuentas
        updated_cuentas_json = json.dumps(cuentas_data)
        # URL-encode the JSON to handle special characters
        encoded_cuentas = quote(updated_cuentas_json)

        logger.info(f"Queried status for {len(account_ids)} accounts")
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&cuentas_json={encoded_cuentas}",
            status_code=303,
        )

    except BackendError as e:
        logger.error(f"Backend error during consultar_todos: {e}")
        from urllib.parse import quote
        encoded_cuentas = quote(cuentas_json)
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&cuentas_json={encoded_cuentas}&error=errors.backend_error",
            status_code=303,
        )
    except (ValueError, KeyError) as e:
        logger.error(f"Invalid cuentas_json: {e}")
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&error=errors.invalid_data",
            status_code=303,
        )
    except Exception as e:
        logger.exception(f"Unexpected error during consultar_todos: {e}")
        from urllib.parse import quote
        encoded_cuentas = quote(cuentas_json) if cuentas_json else ""
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&cuentas_json={encoded_cuentas}&error=errors.backend_error",
            status_code=303,
        )


@router.post("/consulta-estados-cuentas/consultar-seleccionados")
async def consultar_seleccionados_post(
    cuentas_json: str = Form(...),
    account_id: List[str] = Form([]),
    dni: str = Form(""),
):
    """
    Query status for selected accounts only.

    Args:
        cuentas_json: JSON string of current cuentas
        account_id: List of selected account IDs from checkboxes
        dni: DNI value to preserve in redirect

    Returns:
        Redirect to GET with updated results
    """
    import json
    from urllib.parse import quote

    try:
        # Parse cuentas
        cuentas_data = json.loads(cuentas_json)

        if not account_id:
            logger.info("No accounts selected")
            encoded_cuentas = quote(cuentas_json)
            return RedirectResponse(
                url=f"/consulta-estados-cuentas?dni={dni}&cuentas_json={encoded_cuentas}&error=errors.no_selection",
                status_code=303,
            )

        # Query statuses for selected accounts only
        estados = cuentas_service.consultar_estados(account_id)

        # Update only selected cuentas
        estado_map = {e.id: e.estado for e in estados}
        for cuenta in cuentas_data:
            if cuenta["id"] in account_id:
                cuenta["estado"] = estado_map.get(cuenta["id"], "DESCONOCIDO")

        # Serialize updated cuentas
        updated_cuentas_json = json.dumps(cuentas_data)
        encoded_cuentas = quote(updated_cuentas_json)

        logger.info(f"Queried status for {len(account_id)} selected accounts")
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&cuentas_json={encoded_cuentas}",
            status_code=303,
        )

    except BackendError as e:
        logger.error(f"Backend error during consultar_seleccionados: {e}")
        encoded_cuentas = quote(cuentas_json)
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&cuentas_json={encoded_cuentas}&error=errors.backend_error",
            status_code=303,
        )
    except (ValueError, KeyError) as e:
        logger.error(f"Invalid data: {e}")
        return RedirectResponse(
            url=f"/consulta-estados-cuentas?dni={dni}&error=errors.invalid_data",
            status_code=303,
        )
