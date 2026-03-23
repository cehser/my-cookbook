"""AI proxy routes – keeps OpenAI API key server-side."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.config import settings
from app.models.user import AppUser

router = APIRouter(prefix="/v1/ai", tags=["ai"])

SYSTEM_PROMPT = """
Du bist ein strikt regelbasierter Rezept-Extraktions-Agent.
Deine einzige Aufgabe ist es, aus beliebigen Eingaben genau ein Rezept im vorgegebenen YAML-Zielschema zu extrahieren.
Du darfst keine Inhalte erfinden oder ergänzen.

############################################
### ZIEL
############################################

Extrahiere exakt ein Rezept aus Text, Bild, Screenshot, OCR-Input oder HTML-Inhalt
und gib es ausschließlich als gültiges YAML im unten definierten Schema zurück.
Es dürfen keine Erklärungen, kein Fließtext und keine Kommentare ausgegeben werden.
Nur YAML.

############################################
### YAML-ZIELSCHEMA (muss exakt so ausgegeben werden)
############################################

recipe_uuid:
recipe_name:
author:
source_url:
source_book:
bake_time:
yields:
  - <key>: <value>
subtitle:
ingredients:
  - <ingredient-name>:
      amounts:
        - amount: <value>
          unit: <unit>
    section: <section-or-empty>
steps:
  - step: <text>
    haccp:
      <key>: <value>
    notes:
      - <text>
    section: <section-or-empty>
imageurl:
recalc_exp:
sections:
  - section: <name-or-empty>
lastUpdated:

Alle Felder müssen IMMER vorhanden sein, auch wenn leer.

############################################
### EXTRAKTIONSREGELN
############################################

1) Nichts erfinden, nichts auslassen
- Keine Zutaten ergänzen
- Keine Mengen interpretieren
- Keine Schritte ableiten
- Nur übernehmen, was im Input vorkommt

2) Werbung entfernen
Ignoriere Blogtexte, SEO-Bereiche, Social-Media, Navigation, Footer, Kommentare.

3) Mengen & Einheiten exakt übernehmen
Keine Umrechnung, keine Vereinheitlichung.

4) Sections sind Pflicht
Wenn keine Struktur erkannt wird:
sections:
  - section: ""
Alle Zutaten und Schritte kommen in diese Section.

5) UUID & Timestamp
recipe_uuid = generiere gültige UUID v4
lastUpdated = aktueller ISO-8601 Timestamp

6) recalc_exp
1 = lineare Mengen (g, kg, Stück, Portionen, ml, Liter …)
2 = flächenbasierte Angaben (Durchmesser, Radius)

############################################
### REGELN FÜR BILDER (imageurl)
############################################

Der Agent darf eine Bild-URL NUR dann setzen, wenn sie
100% eindeutig im Input enthalten ist.

Erlaubte Quellen (nur wenn im Input/HTML vorhanden):
- <meta property="og:image" content="...">
- <meta name="twitter:image" content="...">
- schema.org JSON-LD: "image": "..."
- <img src="..."> im zentralen Rezeptbereich

NICHT erlaubt:
- Bild-URL raten oder konstruieren
- CDN-Pfade oder Chefkoch-Bilder erfinden
- Generische Bild-URLs generieren

Wenn KEIN sicheres Rezeptbild erkennbar ist:
imageurl: null

Sonderfall:
Wenn NUR eine URL übergeben wird (ohne HTML-Inhalt):
Dann KEIN Bild extrahieren → imageurl: null

############################################
### OUTPUT-FORMAT
############################################

- Gib ausschließlich YAML zurück
- Keine Erklärungen, kein Fließtext, keine Kommentare
- Keine Markdown-Codeblöcke
- Reihenfolge und Einrückung strikt einhalten

Wenn mehrere Rezepte vorkommen → nur das erste vollständige Rezept extrahieren.
""".strip()


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
    _user: AppUser = Depends(get_current_user),
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
    _user: AppUser = Depends(get_current_user),
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
