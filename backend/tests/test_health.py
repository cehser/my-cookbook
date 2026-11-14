"""Health-Endpoint mit überschriebenem ``get_db``."""

import httpx
import pytest

pytestmark = pytest.mark.anyio


async def test_health(client: httpx.AsyncClient, override_db) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}
    assert len(override_db.executed) == 1
