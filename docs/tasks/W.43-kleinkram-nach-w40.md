# Auftrag W.43: Kleinkram nach W.40, Vitest bei kleinem Laufwerksbuchstaben

> Erstellt 2026-11-18 vom Master · Roadmap: `ROADMAP.md` Punkt W.43 · Basis: `main@9cbbb3c` · Aufwand: S · Modell: Opus

## Ziel
Die Restpunkte aus der Prüfung von W.40 sind erledigt. Vitest läuft unter Windows auch aus einem Arbeitsverzeichnis mit kleinem `c:`, so wie VS Code und Claude-Code-Sitzungen es liefern, ohne den Umweg über `cmd /c "cd /d C:\…"`. Die CI bleibt unverändert.

## Erst lesen
1. `docs/tasks/W.40.bericht.md`: „Abweichungen“ (Ersteller-Abgleich) und „Offen und Folgepunkte“
2. `.claude/rules/frontend.md`: Absatz „Windows: Laufwerksbuchstabe“
3. `frontend/vitest.config.ts`, `frontend/scripts/shots/tsconfig.json`, `frontend/package.json`
4. `store/pendingCreates.ts` (`creatorBeforeDelete`, Kommentar „Fremd: …“), `store/serverCreator.ts`, `store/recipeStore.ts` (`forgetRecipe`)
5. `backend/app/schemas/recipe.py` (`EMPTYING_UPDATE_DETAIL`), `js/appendFeedback.ts` (`serverReason`)

## Auftrag
1. **`@types/node`** als direkte devDependency, in der Version, die heute transitiv im Lock steht, bzw. in der aktuellen passenden Version. Die Abhängigkeit ist freigegeben. Der Harness-Typecheck hängt danach nicht mehr am transitiven Paket.
2. **Test Ersteller-GET mit sonstigem 4xx** (z. B. 403): Der Eintrag ist danach entfernt, und es wurde kein `DELETE` gesendet. Ergänzt den Block „W.41: Ersteller-Abgleich“ in `recipeStore.spec.ts`.
3. **Kommentar korrigieren** in `pendingCreates.ts`: Ein fremdes Rezept verschwindet bis zum nächsten Listenabruf, weil `forgetRecipe` vorher `noteDeleted` aufruft. Den Kommentar an das tatsächliche Verhalten anpassen; das Verhalten bleibt.
4. **422-Text:** Die Meldung soll beide Fälle abdecken:
   - Fassung nicht vollständig geladen: neu laden
   - Nutzer hat bewusst alles geleert: Rezept löschen statt leeren

   Den Text in `EMPTYING_UPDATE_DETAIL` anpassen, die Specs im Frontend nachziehen. Alte PWA-Stände zeigen das `detail` ebenfalls, also kurz halten.
5. **Vitest bei kleinem Laufwerksbuchstaben:**
   - In `vitest.config.ts` unter Windows mit kleinem Laufwerksbuchstaben `pool: 'vmThreads'` setzen, sonst und in CI der Standard. Erkennung: `process.platform === 'win32' && /^[a-z]:/.test(process.cwd())`.
   - Vorher den Fehler aus einem `c:`-Verzeichnis reproduzieren, danach den grünen Lauf belegen. Zum Vergleich auch der Lauf mit `C:`.
   - Ein Kommentar mit Verweis auf vitest#9507 hält fest, dass der Zweig wieder entfällt, sobald das Problem in Vitest behoben ist.
6. **Build-Symptom prüfen:** Läuft `npm run build` aus `c:`, lädt die App Pinia doppelt. Lässt sich das in `vite.config` vergleichbar billig abfangen, z. B. durch Normalisieren von `root`? Nur umsetzen, wenn es belegbar wirkt: Production-Build aus `c:`, App per `npm run shots` starten, kein Pinia-Fehler. Sonst im Bericht begründen.
7. **Rule** `frontend.md` anpassen: Was gilt jetzt für Tests, was gilt weiter für den Build?

## Ablage
- `frontend/package.json`, `package-lock.json`, `frontend/vitest.config.ts` (gegebenenfalls `vite.config.*`)
- `store/pendingCreates.ts` (nur der Kommentar), `store/recipeStore.spec.ts`
- `backend/app/schemas/recipe.py`, `js/appendFeedback.spec.ts`, gegebenenfalls der Backend-Test, der den Text prüft
- `.claude/rules/frontend.md`

## Nicht in diesem Auftrag
- Weitere Abhängigkeits-Updates
- `pendingCreates.ts` aufteilen
- CI-Änderungen, auch nicht am `npm audit`-Schritt

## Entscheidungen, die ich treffe
- keine

## Fallstricke
- **U.15 läuft parallel** und ändert Views, Store-Settings und `frontend.md`. Überschneidung nur in `frontend.md`; eigene Änderungen dort auf den Windows-Absatz und gegebenenfalls Speichern-Meldungen beschränken.
- **vmThreads** hat eigene Isolationseigenheiten (Module je Datei in einer VM). Alle 393 Tests müssen damit grün sein. Sonst nicht einbauen und im Bericht melden.
- **Belegen, aus welchem Verzeichnis der Lauf gestartet ist:** Git Bash und PowerShell normalisieren auf `C:`. Nur `cmd /c "cd /d c:\… && …"` erzeugt das kleine `c:` sicher; mit `node -e "console.log(process.cwd())"` belegen.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `@types/node` direkt deklariert; Typecheck grün
- Test für sonstiges 4xx; Kommentar korrigiert; 422-Text neu, mit grünen Specs und Backend-Tests
- Vitest aus `c:` und aus `C:` grün, Startverzeichnis jeweils belegt; Build-Symptom behoben oder begründet nicht behoben; Rule angepasst
- Verifikation gemäß Projekt-CLAUDE.md (Frontend, Backend)
