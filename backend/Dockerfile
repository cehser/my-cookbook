FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

# Abhängigkeiten zuerst, damit dieser Layer bei Codeänderungen gecacht bleibt
COPY pyproject.toml uv.lock .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY prompts/ ./prompts/

ENV PATH="/app/.venv/bin:$PATH"

# Commit des Builds (CI bzw. docker-compose.build.yml), erscheint im Export als app_commit.
# Spät gesetzt, damit ein neuer Hash die Layer davor nicht invalidiert.
ARG COMMIT_HASH=dev
ENV COMMIT_HASH=$COMMIT_HASH

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
