from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    db_host: str = "db"
    db_port: int = 5432
    db_name: str = "cookbook"
    db_user: str = "cookbook"
    db_password: str = "changeme"

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    # OIDC
    oidc_authority: str = "https://auth.cehser.de/realms/cehser"
    oidc_client_id: str = "cookbook.cehser.de"

    # OpenAI
    openai_api_key: str = ""

    # Prompts
    prompt_dir: str = "/app/prompts"

    # Uploads
    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 5

    # CORS
    cors_origins: list[str] = ["http://localhost:8080"]

    model_config = {"env_file_encoding": "utf-8"}


settings = Settings()
