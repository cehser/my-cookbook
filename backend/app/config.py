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

    # OIDC (Pflicht, kein Default: ohne OIDC_AUTHORITY und OIDC_CLIENT_ID startet das Backend nicht)
    oidc_authority: str
    oidc_client_id: str

    # E-Mail des ersten Admins (optional). Stimmt sie mit der verifizierten E-Mail
    # aus dem Token überein, wird der User beim Login zum Admin heraufgestuft.
    admin_email: str | None = None

    # OpenAI
    openai_api_key: str = ""

    # Uploads
    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 5

    # CORS
    cors_origins: list[str] = ["http://localhost:8080"]

    model_config = {"env_file_encoding": "utf-8"}


settings = Settings()
