"""OpenAI-Zugang: Client, Key-Prüfung und Abbildung von Fehlern auf HTTP-Antworten.

Details der OpenAI-Fehler gehen nur ins Log, nie in die Antwort.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

import openai
from fastapi import HTTPException, status
from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

# Gesamtdauer eines OpenAI-Aufrufs. Muss unter dem proxy_read_timeout von nginx
# (frontend/.docker/nginx/prod.conf, 150 s) liegen, damit der Nutzer die
# Meldung des Backends sieht statt eines 504 von nginx.
OPENAI_TIMEOUT_S = 120.0


def openai_key_configured() -> bool:
    return bool(settings.openai_api_key)


def require_openai_key() -> str:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API-Key nicht konfiguriert. Bitte Server-Admin kontaktieren.",
        )
    return settings.openai_api_key


def get_client() -> AsyncOpenAI:
    # Keine automatischen Wiederholungen: sie würden das Zeitbudget sprengen.
    return AsyncOpenAI(api_key=require_openai_key(), timeout=OPENAI_TIMEOUT_S, max_retries=0)


def _error_code(exc: openai.APIStatusError) -> str | None:
    body = exc.body
    if isinstance(body, dict):
        inner = body.get("error", body)
        if isinstance(inner, dict):
            code = inner.get("code")
            return code if isinstance(code, str) else None
    return None


def translate_openai_error(exc: Exception, model: str | None = None) -> HTTPException:
    """Bildet eine OpenAI-Ausnahme auf eine HTTPException mit deutscher Meldung ab."""
    model_hint = f" '{model}'" if model else ""

    if isinstance(exc, openai.APITimeoutError):
        return HTTPException(
            status.HTTP_504_GATEWAY_TIMEOUT,
            "OpenAI hat nicht rechtzeitig geantwortet. Bitte erneut versuchen.",
        )
    if isinstance(exc, openai.APIConnectionError):
        return HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Keine Verbindung zu OpenAI. Bitte später erneut versuchen.",
        )
    if isinstance(exc, openai.RateLimitError):
        if _error_code(exc) == "insufficient_quota":
            return HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Das OpenAI-Guthaben ist aufgebraucht. Bitte Server-Admin kontaktieren.",
            )
        return HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "OpenAI-Limit erreicht. Bitte in einer Minute erneut versuchen.",
        )
    if isinstance(exc, (openai.AuthenticationError, openai.PermissionDeniedError)):
        return HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Der OpenAI-Zugang wurde abgelehnt (API-Key ungültig oder ohne Berechtigung)."
            " Bitte Server-Admin kontaktieren.",
        )
    if isinstance(exc, openai.NotFoundError) or (
        isinstance(exc, openai.APIStatusError) and _error_code(exc) == "model_not_found"
    ):
        return HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            f"Das konfigurierte Modell{model_hint} ist nicht verfügbar."
            " Bitte Server-Admin kontaktieren.",
        )
    if isinstance(exc, openai.BadRequestError):
        return HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "OpenAI hat die Anfrage abgelehnt (z. B. Bild nicht lesbar).",
        )
    return HTTPException(
        status.HTTP_502_BAD_GATEWAY,
        "Unerwarteter Fehler bei OpenAI. Bitte später erneut versuchen.",
    )


@contextmanager
def openai_errors(model: str | None = None) -> Iterator[None]:
    """Wandelt OpenAI-Fehler im ``with``-Block in HTTPExceptions um (Details ins Log)."""
    try:
        yield
    except openai.OpenAIError as exc:
        logger.warning("OpenAI-Fehler (Modell %s): %s: %s", model, type(exc).__name__, exc)
        raise translate_openai_error(exc, model) from exc
