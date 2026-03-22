from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://cookbook:changeme@db:5432/cookbook"

    # OIDC
    oidc_issuer_url: str = "https://auth.cehser.de/realms/cehser"
    oidc_audience: str = "cookbook.cehser.de"

    # OpenAI
    openai_api_key: str = ""

    # Uploads
    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 5

    # CORS
    cors_origins: list[str] = ["http://localhost:8080"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
