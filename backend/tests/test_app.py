"""App-Import, OpenAPI-Schema und Routen-Inventar."""

from collections import Counter

import pytest
from fastapi.routing import APIRoute, iter_route_contexts

from app.main import app

# API-Tabelle aus README.md, Abschnitt „API-Übersicht“ (Pfade ohne Präfix /api).
README_ROUTES = {
    ("GET", "/health"),
    ("GET", "/v1/recipes"),
    ("GET", "/v1/recipes/{recipe_id}"),
    ("POST", "/v1/recipes"),
    ("PUT", "/v1/recipes/{recipe_id}"),
    ("POST", "/v1/recipes/{recipe_id}/tags"),
    ("DELETE", "/v1/recipes/{recipe_id}"),
    ("GET", "/v1/recipes/{recipe_id}/images"),
    ("POST", "/v1/recipes/{recipe_id}/images"),
    ("DELETE", "/v1/recipes/{recipe_id}/images/{image_id}"),
    ("GET", "/v1/images/{image_id}"),
    ("GET", "/v1/images/{image_id}/thumbnail"),
    ("POST", "/v1/ai/import"),
    ("POST", "/v1/ai/import/image"),
    ("GET", "/v1/favorites"),
    ("POST", "/v1/favorites/{recipe_id}"),
    ("DELETE", "/v1/favorites/{recipe_id}"),
    ("GET", "/v1/tags"),
    ("GET", "/v1/shares/config"),
    ("GET", "/v1/recipes/{recipe_id}/shares"),
    ("POST", "/v1/recipes/{recipe_id}/share"),
    ("DELETE", "/v1/shares/{share_id}"),
    ("GET", "/v1/shared/{token}"),
    ("GET", "/v1/me"),
    ("GET", "/v1/me/settings"),
    ("PUT", "/v1/me/settings"),
    ("GET", "/v1/admin/users"),
    ("PUT", "/v1/admin/users/{user_id}/role"),
    ("GET", "/v1/admin/settings"),
    ("PUT", "/v1/admin/settings"),
    ("GET", "/v1/admin/shares"),
    ("DELETE", "/v1/admin/shares/{share_id}"),
    ("POST", "/v1/admin/migrate-images"),
    ("POST", "/v1/admin/cleanup-images"),
    ("POST", "/v1/admin/strip-image-ids"),
}


def _registered() -> list[tuple[str, str]]:
    # Seit FastAPI 0.137 enthält app.routes eingebundene Router als Baum;
    # iter_route_contexts() liefert die effektiven Routen flach.
    return [
        (method, ctx.path)
        for ctx in iter_route_contexts(app.routes)
        if isinstance(ctx.original_route, APIRoute)
        for method in ctx.methods or ()
    ]


def test_openapi_schema_builds() -> None:
    schema = app.openapi()
    assert schema["info"]["title"] == "My Cookbook API"
    assert "/v1/recipes" in schema["paths"]


@pytest.mark.parametrize(("method", "path"), sorted(README_ROUTES))
def test_readme_route_registered(method: str, path: str) -> None:
    assert (method, path) in set(_registered())


@pytest.mark.xfail(
    strict=True,
    reason="Bekannter Befund W.1: GET /v1/tags ist in recipes.py und tags.py doppelt registriert",
)
def test_no_duplicate_routes() -> None:
    duplicates = [key for key, n in Counter(_registered()).items() if n > 1]
    assert duplicates == []
