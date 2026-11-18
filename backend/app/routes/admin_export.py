"""Gesamtexport aller Rezepte als ZIP (nur ``admin``); Aufbau in ``app/services/export.py``."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.user import AppUser
from app.services import export as export_service

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get(
    "/export",
    response_class=FileResponse,
    responses={200: {"content": {"application/zip": {}}, "description": "ZIP-Export"}},
)
async def export_all(
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Alle Rezepte mit Tags und Bildern (Originale, Vorlagen) als ZIP, Format Version 1."""
    export = await export_service.create_export(db)
    return FileResponse(
        export.path,
        media_type="application/zip",
        filename=export.filename,
        headers={"Cache-Control": "no-store"},
        # Temporäre Datei nach dem Ausliefern entfernen
        background=BackgroundTask(export.path.unlink, missing_ok=True),
    )
