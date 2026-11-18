# Bericht U.15: Rolle statt Schalter

> Branch `worktree-U.15-rolle-statt-schalter` · Basis `dffd720` (= `8aaeb1b` + 2 `docs(roadmap)`) · Stand `6501d52` · 2026-11-18 · Dauer: 20:55 – 21:15 (20 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Ob jemand bearbeiten darf, entscheidet nur noch die Rolle. Im Frontend kommt das Recht aus `canEdit` (`editor`/`admin`, `auth/role.ts`), lesbar als `store.canEdit`. Die Schalter „Nur lesen“ und „Experten-Modus“ sowie das Speichern im Profil gibt es nicht mehr. Das ⋮-Menü der Rezeptansicht sehen alle Rollen. `/me/settings` leitet `read_only` immer aus der Rolle ab und meldet `expert_mode` immer als `false`; `PUT` ignoriert gesendete Werte. Damit ist der Fehler behoben, dass ein gespeicherter Wert die Rolle schlägt.

**Rollenquelle:** allein `store.settings.role` (aus `/me/settings`). Gründe: Die Antwort wird im IDB-Cache gehalten und von `showCachedData`/`loadSettings` auch offline nach einem Kaltstart geladen. Der Wert ist reaktiv im Store, und `canDelete` (W.35) nutzt ihn bereits, die Oberfläche hat also eine einzige Quelle. Vor dem ersten Laden gilt `readonly`: keine Bearbeiten-Elemente, das ⋮-Menü mit „Bildschirm anlassen“ ist trotzdem da. Die localStorage-Rolle aus `role.ts` bleibt den Guards vorbehalten; die Oberfläche fragt sie nicht ab. Beide werden einmal je Seitenaufruf aufgefrischt.

## Commits
- `39df04c` feat(frontend): Rolle statt Schalter „Nur lesen“ und Experten-Modus
- `bff167c` fix(backend): read_only in /me/settings immer aus der Rolle ableiten
- `ab14414` test(frontend): Screenshot-Szenarien für das ⋮-Menü nach Rolle
- `6501d52` docs(frontend): Rolle steuert Bearbeiten, read_only nur Kompatibilität

**Ersetzte Stellen** (vorher `settings.read_only` / `settings.expert_mode`):
- `HomeView.vue`: KI-Import-Dialog, FAB → `canEdit`; Props an RecipeCard/RecipeGrid entfallen; FAB-Eintrag „YAML Import“ samt Datei-Input und `js-yaml`-Import entfernt
- `RecipeCard.vue`: Kartenmenü, Tag-Editor → `store.canEdit` (Prop `read_only` entfällt); `RecipeGrid.vue`: Prop `readOnly` entfällt
- `FavoritesView.vue`, `SearchView.vue`: Prop-Weitergabe entfällt
- `Recipe.vue`: Kopfaktionen und ⋮-Menü immer; Bearbeiten, Duplizieren, Teilen und „Als Datei exportieren“ (ehemals „YAML Export“) nur mit `canEdit`; Löschen weiter nach `canDelete`; Stern unverändert
- `Administration.vue`/`AdminRecipes.vue`: Neues Rezept, Beispiel, ⧉ → `store.canEdit`; × nur nach `canDelete`; YAML-Import und -Export je Rezept → `isAdmin`; Wartung → `isAdmin`
- `AIRecipeImport.vue`: Rohantwort (JSON) → nur `admin`
- `Edit.vue`: „YAML anzeigen“ entfernt
- `ProfileView.vue`: beide Schalter, lokale Kopie und „Speichern“ entfernt
- `types/settings.ts`: nur noch `role`; `recipeStore.ts`: `default_settings` nur `role`, `saveSettings` entfällt, `loadSettings` übernimmt nur die Rolle (760 → 748 Zeilen)

`git grep -n "read_only\|expert_mode" frontend/src` trifft danach nur den Kommentar in `types/settings.ts` und den Test, der prüft, dass Altfelder der Antwort nicht übernommen werden.

## Verifikation
- `npm run lint:check && npm run typecheck && npm test && npm run build` (aus `C:/…/frontend`) → grün; 40 Testdateien, 406 Tests (14,7 s); Build in 1,4 s
- `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest` → grün, 164 bestanden, 30 übersprungen (DB). Lokal mit `--python cpython-3.14-windows-x86_64-none` (ARM-Falle aus `backend-tooling.md`)
- DB-Tests gegen `postgres:16-alpine` (temporärer Container `u15-test-db`, danach gestoppt): `uv run pytest -m db` → 30 bestanden (11,2 s), darunter die neuen Tests `test_settings_downgraded_user_is_read_only`, `test_settings_promoted_user_may_edit` und `test_settings_put_from_old_client_is_ignored`
- Neue Tests: `canEdit` je Rolle einschließlich unbekannter, leerer und fehlender Rolle (`role.spec.ts`); Store-Getter, Übernahme nur der Rolle, Cache offline (`recipeStore.spec.ts`); Rezeptansicht als `readonly`: Menü mit „Bildschirm anlassen“, ohne Bearbeiten-Einträge, als Editor mit Datei-Export (`Recipe.spec.ts`); FAB nur für `editor`/`admin`, ohne YAML-Import (neu `HomeView.spec.ts`); Kartenmenü nur mit Recht (`RecipeCard.spec.ts`); Backend ohne DB (`tests/test_me_settings.py`)
- Sichtprüfung: Screenshots per `npm run shots`, iPhone hell: `docs/plans/u15-rolle-statt-schalter/iphone-hell-rezept-menue-readonly.png` (Menü zeigt nur „Bildschirm anlassen“) und `…-editor.png` (Bearbeiten, Duplizieren, Teilen, Als Datei exportieren, Bildschirm anlassen, Löschen). Angesehen, wie erwartet.
- Nicht gebaut: Container lokal (keine Änderung an Abhängigkeiten, Dockerfile oder Migrationen)
- Prüfzeit: ~3 min; größter Posten: `npm ci` und Vitest
- Prüfskripte: wiederholbar abgelegt unter `frontend/scripts/shots/scenarios.ts` (`rezept-menue-readonly`, `rezept-menue-editor`)

**Szenarien für deine Sichtprüfung:**
1. Als Editor: FAB mit Neues Rezept / AI-Import / Beispiel (kein YAML-Import); Kartenmenü mit Tags/Bearbeiten; ⋮-Menü wie im Screenshot; Editor ohne „YAML anzeigen“; KI-Import ohne Rohantwort; Profil ohne Schalter und ohne Speichern.
2. Als `readonly`: kein FAB, kein Kartenmenü, Stern vorhanden; ⋮-Menü nur mit „Bildschirm anlassen“.
3. Als Admin: Verwaltung mit Neues Rezept, Beispiel, YAML Import, Gesamtexport, Wartung; je Rezept ×, ⧉ und ⬇ (YAML-Export); KI-Import zeigt „Rohantwort (JSON) anzeigen“.
4. Herabstufung: Editor in der Verwaltung zu `readonly` setzen, App neu laden → keine Bearbeiten-Elemente mehr (vorher blieben sie).

## Struktur und Doku
- Neue Dateien: `frontend/src/views/HomeView.spec.ts`, `backend/tests/test_me_settings.py`. Gewachsen ist nichts; Store, Profil und HomeView sind kleiner geworden.
- Screenshot-Harness: Szenario-Feld `clicks` (Selektoren, die vor dem Foto angeklickt werden), nötig für das geöffnete Menü. Die Mock-API leitet `read_only` jetzt wie das Backend aus der Rolle ab.
- Rules: `frontend.md` (Rechte nur aus der Rolle, eine Rollenquelle) und `backend-db.md` (`/me/settings` nur zur Kompatibilität, `paths` um `routes/me.py` ergänzt) nachgetragen, ebenso `screenshots.md` (`clicks`). Die README-Tabelle (`GET/PUT /v1/me/settings`) stimmt noch.

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- **Teilen nur mit `canEdit`:** Der Auftrag sah Teilen für alle vor, sofern es heute nicht an einer Rolle hängt. Es hängt daran: `POST /recipes/{id}/shares` und `DELETE /shares/{id}` verlangen `require_editor`. Für `readonly` wäre der Eintrag also ein toter Knopf.
- **`PUT /me/settings` speichert nichts mehr:** „Gesendete Werte werden ignoriert“ ist wörtlich umgesetzt, es gibt keinen DB-Schreibzugriff mehr. Altwerte in `app_users.settings` bleiben liegen und werden nicht gelesen.
- **RecipeCard/AdminRecipes lesen das Recht selbst aus dem Store**, statt es als Prop zu bekommen. Das passt zu `canDelete`, das sie schon so lesen, und ergibt eine einzige Quelle; die Props `read_only`/`readOnly`/`expertMode` entfallen.

## Nachgetragen in Specs/Plänen
- `docs/plans/konzept-profil-verwaltung.md`: Abschnitt 2 „Umgesetzt mit U.15“, mit Hinweis zu Teilen

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- Die IDB-Settings sind nicht je Nutzer abgelegt. Meldet sich auf einem Gerät ein anderer Nutzer an, gilt bis zur ersten `/me/settings`-Antwort offline dessen alte Rolle. Das war schon vorher so (auch für `canDelete`). Prüfen, ob der Logout den IDB-Cache leert; falls nicht, ein XS-Folgepunkt.
- `EnterWorktree` scheiterte zunächst am kleinen Laufwerksbuchstaben `c:` (VS Code); der Einstieg über den Pfad mit `C:` ging. Passt zum Befund in W.43.

## Status je Roadmap-Punkt
- `U.15` fertig

## Vorschlag Roadmap-Zeilen
`- [x] U.15 Rolle statt Schalter: canEdit aus der Rolle statt read_only, Experten-Modus gestrichen (YAML-Export im ⋮-Menü für Bearbeiter, YAML in der Verwaltung für Admins, Rohantwort nur Admin), /me/settings leitet read_only immer aus der Rolle ab · 2026-11-18 · <sha>`
