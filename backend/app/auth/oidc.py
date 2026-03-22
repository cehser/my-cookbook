"""OIDC Token verification via JWKS (IdP-agnostic, offline validation)."""

import httpx
import jwt
from jwt import PyJWKClient

from app.config import settings

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.oidc_issuer_url.rstrip('/')}/.well-known/openid-configuration"
        # PyJWKClient resolves jwks_uri from OIDC discovery automatically when using
        # the jwks_uri directly. We fetch it manually for clarity.
        resp = httpx.get(jwks_url, timeout=10)
        resp.raise_for_status()
        oidc_config = resp.json()
        _jwks_client = PyJWKClient(oidc_config["jwks_uri"], cache_keys=True)
    return _jwks_client


def verify_oidc_token(token: str) -> dict:
    """Decode and verify a JWT against the IdP's JWKS endpoint.

    Returns the decoded token payload with at least 'sub' and optionally
    'preferred_username', 'email', etc.

    Raises jwt.exceptions.PyJWTError on invalid/expired tokens.
    """
    client = _get_jwks_client()
    signing_key = client.get_signing_key_from_jwt(token)

    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256", "ES256"],
        issuer=settings.oidc_issuer_url,
        options={
            "require": ["sub", "exp", "iss"],
            "verify_aud": False,  # Keycloak sets azp, not always aud
        },
    )

    # Verify audience: accept if aud or azp matches our expected audience
    expected = settings.oidc_audience
    if expected:
        aud = payload.get("aud", [])
        azp = payload.get("azp", "")
        if isinstance(aud, str):
            aud = [aud]
        if expected not in aud and azp != expected:
            raise jwt.InvalidAudienceError(
                f"Token audience ({aud}, azp={azp}) does not match {expected}"
            )

    return payload


def reset_jwks_client() -> None:
    """Reset cached JWKS client (useful for testing or key rotation)."""
    global _jwks_client
    _jwks_client = None
