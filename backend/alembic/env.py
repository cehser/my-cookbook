from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.models.base import Base

# Import all models so Alembic can detect them
from app.models.favorite import Favorite  # noqa: F401
from app.models.image import RecipeImage  # noqa: F401
from app.models.recipe import Recipe  # noqa: F401
from app.models.tag import RecipeShare, RecipeTag, Tag  # noqa: F401
from app.models.user import AppUser  # noqa: F401

config = context.config
if config.config_file_name is not None:
    # False: sonst deaktiviert fileConfig die Logger der App (und von Uvicorn)
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# URL aus den App-Settings (DB_HOST, DB_PORT, …) direkt als URL-Objekt verwenden,
# nicht per config.set_main_option: configparser würde das %-Zeichen eines
# kodierten Passworts als Interpolation auswerten.

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(settings.database_url, poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    import asyncio

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
