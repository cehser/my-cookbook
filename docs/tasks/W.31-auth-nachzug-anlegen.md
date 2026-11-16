# Auftrag W.31: Auth-Nachzug nach W.23/W.28, Rezept anlegen robust, `useRecipeImport`

> Erstellt 2026-11-16 vom Master · Roadmap: `ROADMAP.md` Punkt W.31 · Basis: `main@df7b1e4` · Aufwand: M · Modell: Opus

## Ziel
Die Reste aus W.23 und W.28 werden bereinigt. Netzprüfung und Login-Entscheidung liegen nur noch in `auth/session.ts`. Das Anlegen eines Rezepts meldet ehrlich, was passiert ist: angelegt, nur lokal gespeichert oder abgelehnt. Dabei entstehen keine Duplikate mehr. Der Importablauf liegt testbar in einem Composable. Sichtbares Verhalten ändert sich nur bei den Fehlerfällen unten.

## Erst lesen
1. `docs/tasks/W.23.bericht.md` – „Offen und Folgepunkte“; `docs/tasks/W.28.bericht.md` – Befunde
2. `.claude/rules/frontend.md` (Auth-Abschnitt: „Netz nur in `session.ts`“), `.claude/rules/ai-import.md` (Abschnitt „Vorlage am Rezept“)
3. `frontend/src/auth/session.ts` (`withRenewLock`, Backoff, `onNavigation`), `auth/oidc.ts` (Re-Export), `api/images.ts`, `api/client.ts` (`ApiError`, `ApiTimeoutError`, `isClientError`, Kopfkommentar)
4. `frontend/src/store/recipeStore.ts` (`loadAllOnce`, `showCachedData`, `appendRecipe`), Aufrufer von `appendRecipe`: `AIRecipeImport.vue`, `HomeView.vue`, `Recipe.vue` (Kopieren), `components/admin/AdminRecipes.vue`

## Auftrag
1. **Auth-Reste:**
   - `api/images.ts` importiert `getAccessToken` aus `@/auth/session`; den Re-Export in `auth/oidc.ts` entfernen.
   - `recipeStore.ts:96` prüft nicht mehr selbst `navigator.onLine`. Ob nach `rejected` ein Login folgt, liefert `session.ts`, z. B. als Funktion oder als zusätzlicher Zustand. Die Form wählst du, die Zustandstabelle in `docs/tasks/W.23-auth-feinschliff.md` bleibt gültig.
   - `session.ts`: Nach einem Lock-Timeout wird der Backoff gesetzt, damit nicht jeder weitere Aufruf erneut 15 s wartet. Dazu ein Test.
   - Veraltete Kommentare berichtigen: Kopf von `api/client.ts`, `recipeStore.ts`, Docstring `onNavigation` (bis zu 15 s Lock plus 10 s Erneuerung).
2. **`dataSource`:** `"cache"` nur, wenn tatsächlich Daten aus dem Cache gelesen wurden. Ein leerer Cache bleibt `"none"`, dann zeigt die Anzeige nicht „Offline-Daten“ ohne Daten. Mit Test.
3. **`appendRecipe` mit eindeutigem Ergebnis**, z. B. `{ status: "created", detail } | { status: "local" } | { status: "failed", error }`:
   - **Angelegt:** Klappt `recipeApi.create`, ist das Ergebnis `created`, auch wenn das anschließende Neuladen der Liste scheitert. Das Neuladen gehört nicht in denselben `try`. Statt Neuladen genügt, das Rezept aus der Antwort in die Liste einzufügen, wenn das einfacher ist.
   - **Nur lokal:** offline, Timeout oder 5xx speichern lokal wie bisher. Die Meldung sagt dann „nur auf diesem Gerät gespeichert“.
   - **Abgelehnt:** 4xx (`isClientError`) speichert nicht lokal. Der Aufrufer zeigt eine Fehlermeldung, etwa bei fehlender Rolle oder 422.
   - Alle Aufrufer werten das Ergebnis aus: Navigation nur bei `created` oder `local`, Toast bei `failed`. Heute ignorieren `AdminRecipes.vue` und zwei Stellen in `HomeView.vue` das Ergebnis.
4. **`useRecipeImport`:** Den Ablauf Anlegen → Vorlagen hochladen → Zurücksetzen → Navigation aus `AIRecipeImport.vue` in `composables/useRecipeImport.ts` ziehen. Die Komponente behält Eingabe, Anzeige und Seitenauswahl.
5. **Tests (Vitest, API, Store und Router gemockt):**
   - `appendRecipe`: Anlegen ok mit Fehler beim Neuladen ergibt kein Duplikat und das Ergebnis `created`; offline ergibt `local`; 4xx ergibt `failed`, nichts lokal.
   - `useRecipeImport`: Foto-Weg lädt in Reihenfolge hoch; ein Upload-Fehler einzelner Seiten wird gemeldet, das Rezept bleibt; bei `local` kein Upload und ein Hinweis; bei `failed` keine Navigation, Seiten bleiben erhalten.
   - Session: der Backoff nach Lock-Timeout und die `rejected`-Entscheidung, die vorher im Store lag.

## Ablage
- Neu: `src/composables/useRecipeImport.ts` (+ Spec)
- Geändert: `auth/session.ts` (+ Spec), `auth/oidc.ts`, `api/images.ts`, `api/client.ts` (Kommentar), `store/recipeStore.ts` (+ Spec), `AIRecipeImport.vue` (schrumpft), `HomeView.vue`, `Recipe.vue`, `components/admin/AdminRecipes.vue`, `.claude/rules/frontend.md` bzw. `ai-import.md`, soweit Regeln sich ändern

## Nicht in diesem Auftrag
- Client-UUID beim Anlegen, also gleiche ID in Client und Backend und idempotente Wiederholung (W.33)
- Nachträgliches Hochladen lokal gespeicherter Rezepte, Offline-Synchronisation (12.1)
- Weitere Umbauten an `session.ts` jenseits der genannten Punkte; Backend

## Entscheidungen, die ich treffe
- keine. Der Master hat entschieden: 4xx speichert nicht lokal; offline, Timeout und 5xx speichern lokal wie bisher, mit klarer Meldung.

## Fallstricke
- **Lokal gespeicherte Rezepte** werden heute nie zum Backend übertragen, eine Synchronisation gibt es nicht. Deshalb bei 4xx nicht lokal speichern, sonst bleibt eine Kopie liegen, die nie ankommt. Bei `local` darf die Meldung kein späteres Hochladen versprechen.
- **ID nach dem Anlegen:** Das Backend vergibt eine neue ID und verwirft die Client-UUID (W.33 ändert das später). Navigation und Upload nutzen bei `created` die Backend-ID, bei `local` die lokale UUID.
- **Netz nur in `session.ts`** (W.23): Store und Composables fragen `navigator.onLine` nicht für Login- oder Banner-Entscheidungen ab. `useRecipeHelper` und `swUpdate` sind ausgenommen, siehe Rule.
- **Zustand von `useImportPages`** liegt auf Modulebene und überlebt Routenwechsel. Im Spec vor jedem Test zurücksetzen. Bei `failed` die Seiten nicht leeren, damit der Nutzer es erneut versuchen kann.
- **`loadAll` und `loadAllRerun`:** Fügt `appendRecipe` das Rezept direkt in die Liste ein, darf ein parallel laufendes `loadAll` es nicht wieder entfernen, und es darf nicht doppelt erscheinen.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `navigator.onLine` und Re-Export wie oben entfernt; Kommentare aktuell
- Anlegen: kein Duplikat und keine Meldung „offline“ bei Fehler nach dem Anlegen; 4xx ohne lokale Kopie mit Fehlermeldung; alle Aufrufer werten das Ergebnis aus
- `AIRecipeImport.vue` ohne Ablauflogik; `useRecipeImport` getestet
- Szenarien für meine Sichtprüfung im Bericht: Import mit Vorlage, Import offline, Neues Rezept als `readonly`, Duplizieren, Start offline ohne Cache
- Verifikation gemäß Projekt-CLAUDE.md (Frontend inkl. `npm test`)
