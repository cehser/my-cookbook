"""DB-URL mit Sonderzeichen im Passwort (ohne Datenbank)."""

import pytest
from alembic import command
from sqlalchemy.engine import make_url

from app.config import settings
from tests.db.conftest import alembic_config

PASSWORD = "p@ss:w/rd#%?&=+ äö"


@pytest.fixture
def special_password(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setattr(settings, "db_password", PASSWORD)
    monkeypatch.setattr(settings, "db_user", "koch@buch")
    return PASSWORD


def test_database_url_keeps_special_characters(special_password: str) -> None:
    url = settings.database_url
    assert url.password == special_password
    assert url.username == "koch@buch"
    assert url.host == settings.db_host
    assert url.database == settings.db_name

    # Als String gerendert und wieder geparst bleibt alles erhalten (kodiert)
    rendered = url.render_as_string(hide_password=False)
    parsed = make_url(rendered)
    assert parsed.password == special_password
    assert parsed.username == "koch@buch"
    assert parsed.host == settings.db_host
    assert parsed.port == settings.db_port


def test_alembic_offline_accepts_special_password(
    special_password: str, capsys: pytest.CaptureFixture[str]
) -> None:
    # Offline-Modus (--sql) läuft durch env.py, ohne zu verbinden. Mit dem alten
    # set_main_option scheiterte configparser am %-Zeichen der kodierten URL.
    command.upgrade(alembic_config(), "head", sql=True)
    assert "CREATE TABLE" in capsys.readouterr().out
