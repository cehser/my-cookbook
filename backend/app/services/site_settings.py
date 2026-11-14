"""Site-weite Einstellungen (Tabelle ``site_settings``, eine Zeile mit JSONB)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.site_settings import SiteSettings

DEFAULT_AI_MODEL = "gpt-6-luna"

SITE_DEFAULTS: dict = {
    "max_share_days": 30,
    "ai_model_text": DEFAULT_AI_MODEL,
    "ai_model_image": DEFAULT_AI_MODEL,
}


async def get_site_settings(db: AsyncSession) -> dict:
    """Return the site settings merged with defaults, creating the row if missing."""
    result = await db.execute(select(SiteSettings).where(SiteSettings.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        row = SiteSettings(id=1, data=SITE_DEFAULTS)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return {**SITE_DEFAULTS, **(row.data or {})}
