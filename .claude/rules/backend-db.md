---
paths:
  - backend/alembic/**
  - backend/app/models/**
---

# Datenbank und Migrationen

- Das Backend führt `alembic upgrade head` beim Start aus (`backend/app/main.py`, `run_migrations`). Eine fehlerhafte Migration verhindert den Start des Containers, also Migrationen vor dem Deploy gegen eine lokale DB laufen lassen.
- Dateinamen fortlaufend `NNN_<name>.py`; `revision` = Dateiname ohne `.py` (z. B. `006_add_pending_role`), `down_revision` = Vorgänger.
- Rollen stehen zusätzlich in einem CHECK-Constraint `ck_app_users_valid_role` der Tabelle `app_users`. Neue Rolle = Code in `app/auth/dependencies.py` **und** Migration für den Constraint (vgl. `006_add_pending_role.py`).
- Rezeptinhalt liegt als JSONB in `recipes`; abgeleitete Felder (z. B. `first_image_id`) dürfen nicht in das JSONB geraten.
