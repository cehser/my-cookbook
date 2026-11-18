import asyncio
import logging
import warnings
from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import (
    admin,
    admin_export,
    admin_images,
    ai,
    favorites,
    health,
    images,
    me,
    recipes,
    shares,
    tags,
)
from app.services import export as export_service

# Uvicorn konfiguriert nur seine eigenen Logger; ohne Handler gingen INFO-Meldungen
# aus "app.*" verloren. Handler am Logger "app" (nicht am Root), damit Uvicorns Logging
# unberührt bleibt und nichts doppelt erscheint.
_app_logger = logging.getLogger("app")
if not _app_logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s - %(message)s"))
    _app_logger.addHandler(_handler)
    _app_logger.setLevel(logging.INFO)
    _app_logger.propagate = False

logger = logging.getLogger(__name__)


async def run_migrations() -> None:
    """Run pending Alembic migrations on startup.

    Alembic's async env.py calls asyncio.run(), which cannot run inside
    an already-running event loop. We offload it to a thread so it gets
    its own loop.
    """
    try:
        alembic_cfg = Config("alembic.ini")
        await asyncio.to_thread(command.upgrade, alembic_cfg, "head")
        logger.info("Database migrations applied successfully.")
    except Exception:
        logger.exception("Failed to run database migrations.")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await run_migrations()
    export_service.remove_stale_exports()
    yield
    # Shutdown


# root_path bleibt im Code (W.20.1 verworfen): "uvicorn --root-path /api" erwartet, dass der
# Proxy das Präfix entfernt (App läge dann unter /health), nginx reicht /api/ aber mit Präfix
# durch (prod.conf). Die Deprecation-Warnung wird deshalb gezielt unterdrückt, bis nginx
# das Präfix entfernt.
with warnings.catch_warnings():
    warnings.filterwarnings("ignore", message=".*root_path.*")
    app = FastAPI(
        title="My Cookbook API",
        version="0.1.0",
        lifespan=lifespan,
        root_path="/api",
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(me.router)
app.include_router(admin.router)
app.include_router(recipes.router)
app.include_router(images.router)
app.include_router(admin_images.router)
app.include_router(admin_export.router)
app.include_router(ai.router)
app.include_router(favorites.router)
app.include_router(tags.router)
app.include_router(shares.router)
app.include_router(shares.public_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
