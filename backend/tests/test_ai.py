"""AI-Routen und Admin-Einstellungen: Rollen, fehlender Key, Fehlerabbildung, Antwortformat.

OpenAI wird nie aufgerufen: ohne Key bricht jede Route vorher mit 503 ab, der
Happy Path läuft gegen einen Fake-Client.
"""

import httpx
import openai
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.config import settings
from app.routes import ai as ai_routes
from app.schemas.ai import AIRecipe
from app.services.openai_client import translate_openai_error
from app.services.site_settings import SITE_DEFAULTS

pytestmark = pytest.mark.anyio

IMAGE = {"file": ("foto.png", b"PNG-fake", "image/png")}

RECIPE_JSON = {
    "recipe_name": "Pfannkuchen",
    "subtitle": None,
    "author": None,
    "source_url": None,
    "source_book": None,
    "bake_time": None,
    "yields": [{"unit": "Portionen", "value": 4}],
    "ingredients": [
        {"name": "Mehl", "amounts": [{"amount": 250, "unit": "g"}], "section": ""},
        {"name": "Salz", "amounts": [{"amount": None, "unit": ""}], "section": ""},
    ],
    "steps": [{"step": "Verrühren.", "notes": [], "section": ""}],
    "sections": [{"section": ""}],
    "imageurl": None,
    "recalc_exp": 1,
}

REQUEST = httpx.Request("POST", "https://api.openai.com/v1/responses")


def _status_error(cls: type[openai.APIStatusError], code: int, body=None):
    return cls("boom", response=httpx.Response(code, request=REQUEST), body=body)


@pytest.fixture
def no_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "")


@pytest.fixture
def with_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "sk-test-secret")


# --- Rollen ----------------------------------------------------------------


@pytest.mark.parametrize("path", ["/api/v1/ai/import", "/api/v1/ai/import/image"])
async def test_ai_without_token_401(client: httpx.AsyncClient, override_db, path: str) -> None:
    response = await client.post(path, json={"text": "x"})
    assert response.status_code == 401


@pytest.mark.parametrize("role", ["pending", "readonly"])
async def test_ai_below_editor_403(client: httpx.AsyncClient, as_role, with_key, role: str) -> None:
    as_role(role)
    assert (await client.post("/api/v1/ai/import", json={"text": "x"})).status_code == 403
    assert (await client.post("/api/v1/ai/import/image", files=IMAGE)).status_code == 403


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/v1/admin/settings"),
        ("PUT", "/api/v1/admin/settings"),
        ("POST", "/api/v1/admin/ai/test"),
    ],
)
async def test_admin_ai_endpoints_editor_403(
    client: httpx.AsyncClient, as_role, method: str, path: str
) -> None:
    as_role("editor")
    assert (await client.request(method, path, json={})).status_code == 403


# --- Fehlender Key ----------------------------------------------------------


async def test_import_text_without_key_503(client: httpx.AsyncClient, as_role, no_key) -> None:
    as_role("editor")
    response = await client.post("/api/v1/ai/import", json={"text": "Rezept"})
    assert response.status_code == 503
    assert "API-Key" in response.json()["detail"]


async def test_import_image_without_key_503(client: httpx.AsyncClient, as_role, no_key) -> None:
    as_role("editor")
    response = await client.post("/api/v1/ai/import/image", files=IMAGE)
    assert response.status_code == 503


async def test_admin_test_without_key_503(
    client: httpx.AsyncClient, as_role, no_key, monkeypatch: pytest.MonkeyPatch
) -> None:
    as_role("admin")

    async def _settings(_db):
        return dict(SITE_DEFAULTS)

    monkeypatch.setattr("app.routes.admin.get_site_settings", _settings)
    assert (await client.post("/api/v1/admin/ai/test")).status_code == 503


async def test_admin_put_model_without_key_503(client: httpx.AsyncClient, as_role, no_key) -> None:
    as_role("admin")
    response = await client.put("/api/v1/admin/settings", json={"ai_model_text": "gpt-6-luna"})
    assert response.status_code == 503


async def test_admin_put_invalid_model_id_422(client: httpx.AsyncClient, as_role, with_key) -> None:
    as_role("admin")
    response = await client.put("/api/v1/admin/settings", json={"ai_model_text": "../x y"})
    assert response.status_code == 422


# --- Validierung / Antwort ---------------------------------------------------


async def test_import_text_empty_400(client: httpx.AsyncClient, as_role, with_key) -> None:
    as_role("editor")
    assert (await client.post("/api/v1/ai/import", json={"text": "  "})).status_code == 400


async def test_import_image_not_an_image_400(client: httpx.AsyncClient, as_role, with_key) -> None:
    as_role("editor")
    files = {"file": ("a.txt", b"x", "text/plain")}
    assert (await client.post("/api/v1/ai/import/image", files=files)).status_code == 400


async def test_import_image_too_large_413(
    client: httpx.AsyncClient, as_role, with_key, monkeypatch: pytest.MonkeyPatch
) -> None:
    as_role("editor")
    monkeypatch.setattr(ai_routes, "MAX_IMAGE_MB", 0)
    response = await client.post("/api/v1/ai/import/image", files=IMAGE)
    assert response.status_code == 413
    assert "zu groß" in response.json()["detail"]


class _FakeResponses:
    def __init__(self, parsed, error: Exception | None = None, status: str = "completed") -> None:
        self.parsed = parsed
        self.error = error
        self.status = status
        self.calls: list[dict] = []

    async def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return type(
            "R",
            (),
            {"output_parsed": self.parsed, "status": self.status, "incomplete_details": None},
        )()


def _install_fake(monkeypatch: pytest.MonkeyPatch, responses: _FakeResponses) -> None:
    async def _settings(_db):
        return {**SITE_DEFAULTS, "ai_model_text": "text-model", "ai_model_image": "image-model"}

    monkeypatch.setattr(ai_routes, "get_site_settings", _settings)
    monkeypatch.setattr(ai_routes, "get_client", lambda: type("C", (), {"responses": responses})())


async def test_import_text_uses_admin_model_and_returns_recipe(
    client: httpx.AsyncClient, as_role, with_key, monkeypatch: pytest.MonkeyPatch
) -> None:
    as_role("editor")
    fake = _FakeResponses(AIRecipe.model_validate(RECIPE_JSON))
    _install_fake(monkeypatch, fake)

    response = await client.post(
        "/api/v1/ai/import", json={"text": "Pfannkuchen", "model": "gpt-teuer"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "text-model"
    assert body["recipe"]["ingredients"][0]["amounts"][0]["amount"] == 250
    assert body["recipe"]["ingredients"][1]["amounts"][0]["amount"] is None
    assert fake.calls[0]["model"] == "text-model"  # Modell im Body wird ignoriert
    assert "tools" not in fake.calls[0]
    assert "sk-test-secret" not in response.text


async def test_import_url_uses_web_search(
    client: httpx.AsyncClient, as_role, with_key, monkeypatch: pytest.MonkeyPatch
) -> None:
    as_role("editor")
    fake = _FakeResponses(AIRecipe.model_validate(RECIPE_JSON))
    _install_fake(monkeypatch, fake)
    await client.post("/api/v1/ai/import", json={"text": " https://example.com/r "})
    assert fake.calls[0]["tools"] == [{"type": "web_search"}]


async def test_import_image_uses_image_model(
    client: httpx.AsyncClient, as_role, with_key, monkeypatch: pytest.MonkeyPatch
) -> None:
    as_role("editor")
    fake = _FakeResponses(AIRecipe.model_validate(RECIPE_JSON))
    _install_fake(monkeypatch, fake)
    response = await client.post("/api/v1/ai/import/image", files=IMAGE)
    assert response.status_code == 200
    assert fake.calls[0]["model"] == "image-model"


def _validation_error() -> ValidationError:
    try:
        AIRecipe.model_validate({})
    except ValidationError as exc:
        return exc
    raise AssertionError("leeres Objekt muss ungültig sein")


@pytest.mark.parametrize(
    "fake",
    [
        _FakeResponses(None),  # Modell lieferte nichts Auswertbares
        _FakeResponses(None, _validation_error()),  # parse() validiert selbst und wirft
        _FakeResponses(AIRecipe.model_validate(RECIPE_JSON), status="incomplete"),
    ],
    ids=["leer", "validation-error", "incomplete"],
)
async def test_unusable_answer_502(
    client: httpx.AsyncClient, as_role, with_key, monkeypatch: pytest.MonkeyPatch, fake
) -> None:
    as_role("editor")
    _install_fake(monkeypatch, fake)
    response = await client.post("/api/v1/ai/import", json={"text": "x"})
    assert response.status_code == 502
    assert "unvollständig oder ungültig" in response.json()["detail"]


async def test_auth_error_log_has_no_key_fragment(
    client: httpx.AsyncClient,
    as_role,
    with_key,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    as_role("editor")
    error = openai.AuthenticationError(
        "Incorrect API key provided: sk-proj-****abcd",
        response=httpx.Response(401, request=REQUEST),
        body=None,
    )
    _install_fake(monkeypatch, _FakeResponses(None, error))
    with caplog.at_level("WARNING"):
        response = await client.post("/api/v1/ai/import", json={"text": "x"})
    assert response.status_code == 503
    assert "AuthenticationError" in caplog.text
    assert "abcd" not in caplog.text
    assert "sk-" not in response.text


async def test_openai_error_mapped_in_route(
    client: httpx.AsyncClient, as_role, with_key, monkeypatch: pytest.MonkeyPatch
) -> None:
    as_role("editor")
    _install_fake(monkeypatch, _FakeResponses(None, _status_error(openai.RateLimitError, 429)))
    response = await client.post("/api/v1/ai/import", json={"text": "x"})
    assert response.status_code == 429
    assert "boom" not in response.text


# --- Fehlerabbildung --------------------------------------------------------


@pytest.mark.parametrize(
    ("exc", "expected"),
    [
        (openai.APITimeoutError(request=REQUEST), 504),
        (openai.APIConnectionError(request=REQUEST), 502),
        (_status_error(openai.RateLimitError, 429), 429),
        (
            _status_error(openai.RateLimitError, 429, {"error": {"code": "insufficient_quota"}}),
            503,
        ),
        (_status_error(openai.AuthenticationError, 401), 503),
        (_status_error(openai.PermissionDeniedError, 403), 503),
        (_status_error(openai.NotFoundError, 404), 503),
        (
            _status_error(openai.BadRequestError, 400, {"error": {"code": "model_not_found"}}),
            503,
        ),
        (_status_error(openai.BadRequestError, 400), 502),
        (_status_error(openai.InternalServerError, 500), 502),
    ],
)
def test_translate_openai_error(exc: Exception, expected: int) -> None:
    result = translate_openai_error(exc, "m")
    assert isinstance(result, HTTPException)
    assert result.status_code == expected
    assert "boom" not in result.detail


def test_recipe_schema_is_strict_compatible() -> None:
    """Strict Structured Outputs: Zahlen für Mengen, alle Felder Pflicht."""
    schema = AIRecipe.model_json_schema()
    assert set(schema["required"]) == set(schema["properties"])
    amount = schema["$defs"]["AIAmount"]["properties"]["amount"]
    assert {t["type"] for t in amount["anyOf"]} == {"number", "null"}
    assert schema["$defs"]["AIYield"]["properties"]["value"]["type"] == "number"
