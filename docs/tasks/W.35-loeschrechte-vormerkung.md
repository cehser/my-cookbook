# Auftrag W.35: Löschrechte, Favoriten für `readonly`, Randfälle der Vormerkung

> Erstellt 2026-11-18 vom Master · Roadmap: `ROADMAP.md` Punkt W.35 · Basis: `main@b98024f` · Aufwand: M · Modell: Opus

## Ziel
Löschen ist in Backend und Oberfläche konsistent: Admins löschen alle Rezepte, Editoren ihre eigenen. Wer nicht löschen darf, sieht keinen Lösch-Knopf. Scheitert ein Löschen, erscheint eine Meldung, das Rezept verschwindet nicht nur scheinbar. Nutzer mit Rolle `readonly` können Favoriten setzen. Die Randfälle der Vormerkung aus dem Prüfbericht von W.33 sind behoben.

## Erst lesen
1. `docs/tasks/W.33.bericht.md` und den Prüfbericht in diesem Auftrag (Abschnitt „Randfälle“ unten)
2. `docs/plans/ux-audit.md` – Befunde H-01, H-02, V-01
3. `.claude/rules/frontend.md` (Anlegen, Vormerkung, `loginFollows`), `.claude/rules/backend-db.md` (Client-ID, 409)
4. Backend: `app/routes/recipes.py` (`delete_recipe` mit `require_admin`), `app/auth/dependencies.py` (Rollen), `app/routes/favorites.py`, `app/routes/me.py` (`read_only` für `readonly`)
5. Frontend: `store/recipeStore.ts` (`deleteRecipe`), `store/pendingCreates.ts`, `components/recipe/RecipeCard.vue`, `views/Recipe.vue` (Löschen, Stern), `components/admin/AdminRecipes.vue`

## Auftrag
1. **Backend, Löschrecht:** `DELETE /v1/recipes/{id}` erlaubt `admin` für alle Rezepte, `editor` nur für eigene (`created_by` = eigener `sub`). Sonst 403. Fehlt `created_by`, z. B. bei Altbestand, darf nur `admin` löschen. DB-Tests: Admin löscht fremdes Rezept; Editor löscht eigenes; Editor löscht fremdes → 403; `readonly` → 403.
2. **Frontend, Sichtbarkeit (H-02):** Den Lösch-Knopf in Karte und Rezeptansicht nur zeigen, wenn die Regel aus Schritt 1 erfüllt ist. `created_by` steht in der Liste; den eigenen `sub` aus `session.ts`. Vorgemerkte Rezepte darf ihr Ersteller immer löschen.
3. **Frontend, Ehrlichkeit (H-02):** `deleteRecipe` entfernt ein Rezept aus der Liste erst nach Erfolg bzw. stellt es bei Fehler wieder her und meldet den Fehler (Toast). Alle Aufrufer warten das Ergebnis ab, heute fängt `Recipe.vue` nichts, weil nicht gewartet wird. Offline-Löschen bestehender Rezepte bleibt wie heute nicht möglich (12.1); dann Meldung statt stillem Fehlschlag.
4. **Favoriten für `readonly` (H-01):** Der Stern hängt nicht mehr an `read_only`. Das Backend erlaubt Favoriten schon ab `readonly`. Der Schalter „Nur lesen“ im Profil blendet weiterhin nur Bearbeiten-Funktionen aus.
5. **Verwaltung (V-01):** Das × in der Rezeptliste von `AdminRecipes.vue` löscht erst nach Rückfrage mit Rezeptname, dazu ein `aria-label`. Die Liste baut 11.2 ohnehin um, hier nur die Rückfrage.
6. **Randfälle der Vormerkung** (aus der Prüfung von W.33):
   - Ein vorgemerktes, aber schon übertragenes Rezept löschen: mit gültiger Sitzung trotzdem `DELETE` senden, 404 ignorieren.
   - Ohne `sub` nicht vormerken; Ergebnis `failed` mit „Bitte anmelden“.
   - Ersteller-Abgleich `sub`/`created_by` als UUID normalisiert vergleichen: klein geschrieben, ohne Bindestriche und Klammern.
   - Wird der PUT nach erfolgter Anlage abgelehnt, nicht „nicht angelegt“ melden, sondern „angelegt, letzte Änderung nicht übertragen“.
   - IDB-Lesefehler bei einem vorgemerkten Rezept: Bearbeiten und Löschen melden den Fehler, statt zur API zu gehen.
   - Löschen während `settle`: Das Rezept darf nicht als Geist in der Liste zurückkommen.
   - Fehler aus `currentUserSub()` abfangen: in `listPending` leere Liste, in `addPending` `LocalSaveError`.
7. **Tests:** Vitest je Punkt aus 2–6, DB-Tests aus 1.

## Ablage
- Geändert: `backend/app/routes/recipes.py`, ggf. `app/auth/dependencies.py` (Hilfsfunktion „darf löschen“), `tests/db/test_api.py`; Frontend `recipeStore.ts`, `pendingCreates.ts`, `RecipeCard.vue`, `Recipe.vue`, `AdminRecipes.vue`, Specs; `.claude/rules/backend-db.md` (Löschrecht)
- Die Regel „darf löschen“ im Frontend an einer Stelle, z. B. in `auth/role.ts` oder einem kleinen Helfer, nicht je Komponente

## Nicht in diesem Auftrag
- Rechte zum Bearbeiten fremder Rezepte (bleibt: Editor darf alle bearbeiten)
- Offline-Löschen bestehender Rezepte (12.1)
- Umbau der Rezeptliste in der Verwaltung (11.2), Dialog-Komponente statt `confirm()` (U.11)
- Kennzeichnung vorgemerkter Rezepte an der Karte (W.34)

## Entscheidungen, die ich treffe
- keine. Der Master hat am 2026-11-17 entschieden: Editoren löschen eigene Rezepte, Admins alle.

## Fallstricke
- **Altbestand ohne `created_by`:** Rezepte aus der Zeit vor der Nutzerverwaltung bzw. aus Importen haben möglicherweise kein `created_by`. Nur Admin darf sie löschen. Die Zahl solcher Rezepte lokal per SQL zählen und im Bericht nennen, ohne Produktivzugriff.
- **`sub` vs. `created_by`:** Das Backend speichert `uuid.UUID(payload["sub"])`. Der Client vergleicht mit `profile.sub` aus dem ID-Token. Beide normalisieren (Schritt 6).
- **Bestätigung:** Bis U.11 eine eigene Dialog-Komponente liefert, `confirm()` wie an den übrigen Stellen verwenden. Keine eigene Komponente bauen.
- **W.36 läuft evtl. parallel** und ändert `HomeView.vue` (`no-footer`). Eigene Änderungen dort klein halten.
- **DB-Tests lokal** nur mit `postgres:16-alpine`; Attrappen plattformneutral (Rule `backend-tooling.md`).

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- Backend: Löschrecht wie in Schritt 1, DB-Tests grün; Anzahl Rezepte ohne `created_by` im lokalen Bestand genannt
- Frontend: Lösch-Knopf nur bei Recht; Fehler beim Löschen gemeldet, Rezept bleibt; Stern für `readonly`; Rückfrage in der Verwaltung; Randfälle aus Schritt 6 mit Tests
- Szenarien für meine Sichtprüfung im Bericht: als Editor eigenes/fremdes Rezept, als `readonly` Favorit setzen, als Admin in der Verwaltung löschen
- Verifikation gemäß Projekt-CLAUDE.md (Frontend, Backend inkl. DB-Tests)
