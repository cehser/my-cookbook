---
paths:
  - backend/alembic/**
  - backend/app/models/**
  - backend/app/routes/recipes.py
  - backend/app/schemas/recipe.py
---

# Datenbank und Migrationen

- Das Backend führt `alembic upgrade head` beim Start aus (`backend/app/main.py`, `run_migrations`). Eine fehlerhafte Migration verhindert den Start des Containers, also Migrationen vor dem Deploy gegen eine lokale DB laufen lassen.
- Dateinamen fortlaufend `NNN_<name>.py`; `revision` = Dateiname ohne `.py` (z. B. `006_add_pending_role`), `down_revision` = Vorgänger.
- Rollen stehen zusätzlich in einem CHECK-Constraint der Tabelle `app_users`, in der DB `ck_app_users_ck_app_users_valid_role` (Präfix doppelt: Namenskonvention + expliziter Name). Neue Rolle = Code in `app/auth/dependencies.py` **und** Migration für den Constraint (vgl. `006_add_pending_role.py`).
- Rezeptinhalt liegt als JSONB in `recipes`; abgeleitete Felder (z. B. `first_image_id`) dürfen nicht in das JSONB geraten.
- **Rezept-ID vom Client:** `POST /v1/recipes` nimmt optional `id` (UUID) an; ohne `id` vergibt die DB sie (`gen_random_uuid()`). Existiert die ID schon, antwortet der Endpunkt mit **409** (Detail nennt die ID), das bestehende Rezept bleibt unverändert, kein Upsert. Ein Client darf 409 bei einer Wiederholung derselben Anlage als Erfolg werten. Erkannt wird die Kollision über den `IntegrityError` (SQLSTATE `23505`) beim ersten `flush`, nicht per Vorab-`SELECT` (sicher bei gleichzeitigen Anfragen) und vor dem Download der `imageurl`. Gelöschte Rezepte hinterlassen keinen Grabstein, ihre ID ist wieder frei.
