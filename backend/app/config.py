from pydantic import Field
from pydantic_settings import BaseSettings
from sqlalchemy import URL


class Settings(BaseSettings):
    # Database
    db_host: str = "db"
    db_port: int = 5432
    db_name: str = "cookbook"
    db_user: str = "cookbook"
    # Pflicht, kein Default und nicht leer: ohne DB_PASSWORD startet das Backend nicht
    db_password: str = Field(min_length=1)

    @property
    def database_url(self) -> URL:
        # URL.create kodiert Sonderzeichen (@ / : # %) in Benutzer und Passwort;
        # ein f-String würde die URL bei solchen Passwörtern zerbrechen.
        return URL.create(
            "postgresql+asyncpg",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )

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

    # Build-Commit (Image-ENV COMMIT_HASH aus der CI bzw. docker-compose.build.yml)
    commit_hash: str = "dev"

    # CORS
    cors_origins: list[str] = ["http://localhost:8080"]

    model_config = {"env_file_encoding": "utf-8"}


settings = Settings()
