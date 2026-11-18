---
paths:
  - backend/alembic/**
  - backend/app/models/**
  - backend/app/routes/recipes.py
  - backend/app/schemas/recipe.py
  - backend/app/services/images.py
  - backend/app/services/export.py
---

# Datenbank und Migrationen

- Das Backend führt `alembic upgrade head` beim Start aus (`backend/app/main.py`, `run_migrations`). Eine fehlerhafte Migration verhindert den Start des Containers, also Migrationen vor dem Deploy gegen eine lokale DB laufen lassen.
- Dateinamen fortlaufend `NNN_<name>.py`; `revision` = Dateiname ohne `.py` (z. B. `006_add_pending_role`), `down_revision` = Vorgänger.
- Rollen stehen zusätzlich in einem CHECK-Constraint der Tabelle `app_users`, in der DB `ck_app_users_ck_app_users_valid_role` (Präfix doppelt: Namenskonvention + expliziter Name). Neue Rolle = Code in `app/auth/dependencies.py` **und** Migration für den Constraint (vgl. `006_add_pending_role.py`).
- Rezeptinhalt liegt als JSONB in `recipes`; abgeleitete Felder (z. B. `first_image_id`) dürfen nicht in das JSONB geraten.
- **Rezept-ID vom Client:** `POST /v1/recipes` nimmt optional `id` (UUID) an; ohne `id` vergibt die DB sie (`gen_random_uuid()`). Existiert die ID schon, antwortet der Endpunkt mit **409** (Detail nennt die ID, in der OpenAPI unter `responses`), das bestehende Rezept bleibt unverändert, kein Upsert. 409 heißt nur „existiert“: Der Client gleicht per `GET /recipes/{id}` ab (Frontend: `created_by` = eigener `sub` heißt Wiederholung, sonst Fehler; `created_by` ist der `sub` des Access-Tokens), statt 409 blind als Erfolg zu werten. Die Nil-UUID lehnt `RecipeCreate` mit 422 ab. Erkannt wird die Kollision über den `IntegrityError` (SQLSTATE `23505`) beim ersten `flush`, nicht per Vorab-`SELECT` (sicher bei gleichzeitigen Anfragen) und vor dem Download der `imageurl`. Gelöschte Rezepte hinterlassen keinen Grabstein, ihre ID ist wieder frei.
- **Löschrecht** (`DELETE /v1/recipes/{id}`): `admin` alle Rezepte, `editor` nur eigene (`created_by` = eigener `sub`), Rezepte ohne `created_by` (Altbestand) nur `admin`; sonst 403, `readonly` schon an `require_editor`. Regel an einer Stelle: `can_delete_recipe` in `app/auth/dependencies.py`, das Frontend spiegelt sie in `src/auth/role.ts` (`canDeleteRecipe`). Ein unbekanntes Rezept ergibt für Editoren 404 vor 403. Bearbeiten bleibt für Editoren bei allen Rezepten erlaubt.
- **Bilddateien:** `recipe_images.mime_type` ist immer `image/webp` und `file_path` zeigt auf die optimierte Fassung `originals/<id>.webp`. Das Original liegt daneben als `originals/<id>.<ext>`, die Endung stammt aus dem Dateinamen des Uploads (nicht aus der DB); auffindbar nur per Glob `<id>.*` (`delete_image_files`, `export.find_image_source`). Bei einem WebP-Upload überschreibt die Verarbeitung das Original.
