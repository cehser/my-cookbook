"""AI proxy routes – keeps OpenAI API key server-side.

Das Modell kommt aus den Site-Einstellungen (Admin), nie vom Client. Die Antwort
wird per Structured Outputs gegen ``AIRecipe`` erzwungen und validiert.
"""

from __future__ import annotations

import base64
import logging
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_editor
from app.database import get_db
from app.models.user import AppUser
from app.schemas.ai import AIImportResponse, AIRecipe
from app.services.openai_client import get_client, openai_errors, require_openai_key
from app.services.site_settings import get_site_settings

router = APIRouter(prefix="/v1/ai", tags=["ai"])

logger = logging.getLogger(__name__)

# Gleiche Grenze wie client_max_body_size für /api/v1/ai/ in prod.conf.
MAX_IMAGE_MB = 10
MAX_OUTPUT_TOKENS = 8000

# ---------------------------------------------------------------------------
# System prompt – Datei im Image (backend/prompts), versioniert mit dem Schema
# ---------------------------------------------------------------------------

_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "system_prompt.md"


def _load_system_prompt() -> str:
    # Fehlt die Datei, ist das Image kaputt: lieber nicht starten als mit
    # einem stillen, schwächeren Ersatz-Prompt zu laufen.
    return _PROMPT_PATH.read_text(encoding="utf-8").strip()


SYSTEM_PROMPT = _load_system_prompt()


# ---------------------------------------------------------------------------
# Shared extraction
# ---------------------------------------------------------------------------


async def _extract_recipe(
    model: str, user_input: str | list[dict[str, Any]], *, web_search: bool = False
) -> AIImportResponse:
    client = get_client()
    kwargs: dict[str, Any] = {}
    if web_search:
        kwargs["tools"] = [{"type": "web_search"}]

    with openai_errors(model):
        response = await client.responses.parse(
            model=model,
            instructions=SYSTEM_PROMPT,
            input=user_input,
            text_format=AIRecipe,
            max_output_tokens=MAX_OUTPUT_TOKENS,
            **kwargs,
        )

    try:
        recipe = response.output_parsed
    except ValidationError:
        logger.warning("Antwort passt nicht zum Rezeptschema (Modell %s)", model, exc_info=True)
        recipe = None
    if recipe is None:
        logger.warning(
            "Keine auswertbare Antwort (Modell %s, Status %s, %s)",
            model,
            response.status,
            response.incomplete_details,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Die AI-Antwort war nicht auswertbar. Bitte erneut versuchen.",
        )
    return AIImportResponse(recipe=recipe, model=model)


# ---------------------------------------------------------------------------
# Text / URL → Recipe
# ---------------------------------------------------------------------------


class AITextRequest(BaseModel):
    text: str


_URL_PATTERN = re.compile(r"^\s*https?://\S+\s*$", re.IGNORECASE)


@router.post("/import", response_model=AIImportResponse)
async def ai_import_text(
    body: AITextRequest,
    _user: AppUser = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    """Extract a recipe from text, or from a web page if the text is a single URL."""
    require_openai_key()
    text = body.text.strip()
    if not text:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Kein Text übergeben.")

    model = (await get_site_settings(db))["ai_model_text"]
    return await _extract_recipe(model, text, web_search=bool(_URL_PATTERN.match(text)))


# ---------------------------------------------------------------------------
# Image → Recipe (Vision)
# ---------------------------------------------------------------------------


@router.post("/import/image", response_model=AIImportResponse)
async def ai_import_image(
    file: UploadFile,
    _user: AppUser = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    """Extract a recipe from a photo."""
    require_openai_key()

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nur Bilddateien erlaubt.",
        )

    content = await file.read()
    if len(content) > MAX_IMAGE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Bild zu groß. Maximum: {MAX_IMAGE_MB} MB",
        )

    b64 = base64.b64encode(content).decode("ascii")
    data_uri = f"data:{file.content_type};base64,{b64}"

    model = (await get_site_settings(db))["ai_model_image"]
    return await _extract_recipe(
        model,
        [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": "Bitte extrahiere das Rezept aus diesem Bild."},
                    {"type": "input_image", "image_url": data_uri},
                ],
            }
        ],
    )
