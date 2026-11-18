"""``/me/settings`` ohne DB: Rolle statt Schalter (U.15)."""

import httpx
import pytest

pytestmark = pytest.mark.anyio


@pytest.mark.parametrize(
    ("role", "stored", "read_only"),
    [
        # herabgestuft, gespeichert „darf bearbeiten“
        ("readonly", {"read_only": False, "expert_mode": True}, True),
        ("pending", {"read_only": False}, True),
        # befördert, gespeichert „nur lesen“
        ("editor", {"read_only": True}, False),
        ("admin", {"read_only": True, "expert_mode": True}, False),
        ("editor", None, False),
    ],
)
async def test_get_follows_role(
    client: httpx.AsyncClient, as_role, role, stored, read_only
) -> None:
    user = as_role(role)
    user.settings = stored

    r = await client.get("/api/v1/me/settings")
    assert r.status_code == 200
    assert r.json() == {"read_only": read_only, "expert_mode": False, "role": role}


async def test_put_ignores_sent_values(client: httpx.AsyncClient, as_role) -> None:
    user = as_role("readonly")

    r = await client.put(
        "/api/v1/me/settings",
        json={"read_only": False, "expert_mode": True, "gpt_model": "alt"},
    )
    assert r.status_code == 200
    assert r.json() == {"read_only": True, "expert_mode": False, "role": "readonly"}
    assert user.settings is None
