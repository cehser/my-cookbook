"""AI proxy routes – keeps OpenAI API key server-side."""

from __future__ import annotations

import logging
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.auth.dependencies import require_editor
from app.config import settings
from app.models.user import AppUser

router = APIRouter(prefix="/v1/ai", tags=["ai"])

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt – loaded from external file (editable without rebuild)
# ---------------------------------------------------------------------------

_PROMPT_PATH = Path(settings.prompt_dir) / "system_prompt.md"


def _load_system_prompt() -> str:
    try:
        return _PROMPT_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        logger.warning("System prompt not found at %s, using built-in fallback", _PROMPT_PATH)
        return "Du bist ein Rezept-Extraktions-Agent. Extrahiere Rezepte als YAML."


SYSTEM_PROMPT = _load_system_prompt()


def _require_openai_key() -> str:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API-Key nicht konfiguriert. Bitte Server-Admin kontaktieren.",
        )
    return settings.openai_api_key


# ---------------------------------------------------------------------------
# Text → Recipe
# ---------------------------------------------------------------------------

class AITextRequest(BaseModel):
    text: str
    model: str = "gpt-4o"


_URL_PATTERN = re.compile(r"^\s*https?://\S+\s*$", re.IGNORECASE)


@router.post("/import")
async def ai_import_text(
    body: AITextRequest,
    _user: AppUser = Depends(require_editor),
):
    """Send recipe text to OpenAI and return the raw YAML response."""
    api_key = _require_openai_key()

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    text = body.text.strip()

    # If input looks like a URL, use Responses API with web search
    if _URL_PATTERN.match(text):
        response = await client.responses.create(
            model=body.model,
            tools=[{"type": "web_search_preview"}],
            instructions=SYSTEM_PROMPT,
            input=text,
        )
        yaml_content = response.output_text or ""
    else:
        response = await client.chat.completions.create(
            model=body.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            max_completion_tokens=4000,
        )
        yaml_content = response.choices[0].message.content or ""

    return {"yaml": yaml_content, "model": body.model}


# ---------------------------------------------------------------------------
# Image → Recipe (Vision)
# ---------------------------------------------------------------------------

@router.post("/import/image")
async def ai_import_image(
    file: UploadFile,
    model: str = Query("gpt-4o", description="OpenAI model to use"),
    _user: AppUser = Depends(require_editor),
):
    """Send a photo to OpenAI Vision and return the raw YAML response."""
    api_key = _require_openai_key()

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nur Bilddateien erlaubt.",
        )

    import base64

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20 MB limit for vision
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Bild zu groß. Maximum: 20 MB",
        )

    b64 = base64.b64encode(content).decode("ascii")
    data_uri = f"data:{file.content_type};base64,{b64}"

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Bitte extrahiere das Rezept aus diesem Bild."},
                    {"type": "image_url", "image_url": {"url": data_uri}},
                ],
            },
        ],
        max_completion_tokens=4000,
    )

    yaml_content = response.choices[0].message.content or ""
    return {"yaml": yaml_content, "model": model}
