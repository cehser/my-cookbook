# Auftrag U.15: Rolle statt Schalter

> Erstellt 2026-11-18 vom Master · Roadmap: `ROADMAP.md` Punkt U.15 · Basis: `main@8aaeb1b` · Aufwand: M · Modell: Opus

## Ziel
Ob jemand bearbeiten darf, entscheidet nur noch die Rolle. Die Schalter „Nur lesen“ und „Experten-Modus“ fallen weg, ihre Funktionen sitzen an festen Orten nach Rolle. Damit ist der Fehler behoben, dass ein einmal gespeicherter Wert von `read_only` die Rolle schlägt. Das ⋮-Menü der Rezeptansicht steht allen Rollen offen; nur seine Bearbeiten-Einträge hängen am Recht. Profil- und Verwaltungs-Umbau gehören nicht dazu (U.8, U.9).

## Erst lesen
1. `docs/plans/konzept-profil-verwaltung.md`:
   - Abschnitt 2 (Stellen, Fehlerbild, Optionen; entschieden: E1 C, E2 B, E3 nein)
   - Abschnitt 6.1
2. `frontend/src/auth/role.ts` (`canDeleteRecipe` aus W.35 als Muster, `readStoredRole`), `auth/guards.ts`
3. Aufrufstellen: `git grep -n "read_only\|readOnly\|expert_mode\|expertMode" frontend/src backend/app`. Die Zeilennummern im Konzept stammen von vor W.37/W.38.
4. `backend/app/routes/me.py`, `schemas/user.py`, `tests/db/` (Test für `/me`)

## Auftrag
1. **Frontend `canEdit`:**
   - Ein Helfer leitet aus der Rolle ab, ob jemand bearbeiten darf (`editor`/`admin`), neben `canDeleteRecipe` in `auth/role.ts`.
   - Er ersetzt `settings.read_only` an allen Aufrufstellen: HomeView mit FAB, KI-Import und Grid, RecipeCard/RecipeGrid, Favoriten, Suche, Recipe.vue, Administration/AdminRecipes, AdminMaintenance.
   - Die Rolle kommt aus genau einer Quelle, und die ist auch offline nach einem Kaltstart verfügbar. Die Wahl im Bericht begründen.
2. **⋮-Menü der Rezeptansicht für alle Rollen:**
   - Der Schalter „Bildschirm anlassen“ (U.3) und „Teilen“ sind für alle sichtbar, sofern Teilen heute nicht an einer Rolle hängt.
   - Bearbeiten, Duplizieren und YAML-Export nur mit `canEdit`, Löschen weiter nach `canDeleteRecipe`.
   - Den Stern (Favorit) nicht verändern.
3. **Experten-Modus streichen (E2 B, E3):**
   - YAML-Export im ⋮-Menü für Bearbeiter ohne Schalter, Text „Als Datei exportieren“
   - „YAML anzeigen“ im Editor entfällt
   - „Rohantwort (JSON) anzeigen“ im KI-Import nur für `admin`
   - YAML-Import im FAB entfällt
   - YAML-Import und -Export in der Verwaltung bleiben bis 11.2 für Admins, ohne Schalter
4. **Profil:**
   - Beide Schalter entfernen, sonst nichts umbauen (U.8).
   - Bleibt danach nichts zu speichern, entfällt das Speichern dort.
   - `types/settings.ts` und die Settings-Logik im Store (`default_settings`, Speichern) entsprechend verkleinern.
5. **Backend `me.py`:**
   - `read_only` in der Antwort immer aus der Rolle ableiten; `expert_mode` immer `false`.
   - Beide Felder bleiben in Schema und Antwort für alte PWA-Stände. Gesendete Werte werden ignoriert, nicht mit 422 abgelehnt.
   - Keine Migration; gespeicherte Altwerte in `app_users.settings` stören nicht.
6. **Tests:**
   - Backend: Ein herabgestufter Nutzer mit gespeichertem `read_only=false` bekommt `true`. Ein beförderter Nutzer mit gespeichertem `true` bekommt `false`. Gesendetes `expert_mode=true` ergibt `false`.
   - Frontend: `canEdit` je Rolle einschließlich unbekannter Rolle. Die Rezeptansicht als `readonly` zeigt das ⋮-Menü mit „Bildschirm anlassen“, aber ohne Bearbeiten. FAB und Kartenmenü nur mit Recht.
7. **Doku:** Rule `frontend.md` bzw. `backend-db.md` nachtragen (Rolle steuert Bearbeiten, `read_only` und `expert_mode` nur noch zur Kompatibilität). Im Konzept unter 2 vermerken: umgesetzt mit U.15.

## Ablage
- `auth/role.ts` (Helfer), Views und Komponenten an den Aufrufstellen
- `types/settings.ts`, `store/recipeStore.ts` (nur Settings-Teil; der Store steht bei 760 Zeilen, hier soll er schrumpfen)
- Backend `routes/me.py`, Tests in `tests/db/` bzw. ohne DB, falls ohne DB testbar
- Specs neben den Modulen

## Nicht in diesem Auftrag
- Profil-Umbau, E-Mail in `/me`, Zähler wartender Nutzer (U.8)
- Verwaltung gliedern, Rezeptliste entfernen (U.9)
- Import aus 11.2
- Rechte im Backend ändern (`require_editor`, `can_delete_recipe` bleiben)

## Entscheidungen, die ich treffe
- keine (E1 C, E2 B, E3 sind entschieden)

## Fallstricke
- **Rolle vor der ersten Antwort unbekannt:** Bis die Rolle feststeht, keine Bearbeiten-Elemente zeigen (sicherer Vorgabewert, wie heute `read_only: true`), aber das ⋮-Menü mit „Bildschirm anlassen“ schon.
- **Zwei Rollenquellen:** Es gibt heute die gespeicherte Rolle aus `role.ts` und `settings.role` aus `/me/settings`. Sie können auseinanderlaufen, z. B. nach einer Herabstufung und vor dem Auffrischen. Eine Quelle wählen, die andere nicht zusätzlich abfragen.
- **Alte PWA-Stände** senden weiter `PUT /me/settings` mit beiden Feldern und lesen `read_only` aus der Antwort. Das muss ohne Fehler und mit der Rolle als Wahrheit funktionieren.
- **`pending`** sieht die App heute gar nicht (Guard). Daran nichts ändern.
- **Windows:** `npm test` und `npm run build` nur aus einem Pfad mit großem `C:` (Rule `frontend.md`).

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `git grep -n "read_only\|expert_mode" frontend/src` trifft nur noch Kompatibilitäts- bzw. Typstellen, keine Sichtbarkeitslogik. Liste der ersetzten Stellen im Bericht.
- Backend-Tests für herab- und hochgestufte Nutzer grün
- Rezeptansicht als `readonly`: ⋮-Menü mit „Bildschirm anlassen“, ohne Bearbeiten (Test, Screenshot per `npm run shots`, iPhone hell)
- Szenarien für meine Sichtprüfung: als Editor, als `readonly`, als Admin (YAML-Import und -Export in der Verwaltung, Rohantwort im KI-Import)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend, Backend mit DB-Tests)
