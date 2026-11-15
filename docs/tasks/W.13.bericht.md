# Bericht W.13: Foto-Import über native Auswahl, mehrseitig, verkleinert

> Branch `worktree-W.13-foto-import` · Basis `5f52d25` (Auftrag: `5f52d25`; Nacharbeit ab `e05ffd5`) · Stand `da46b78` (+ dieser Bericht) · 2026-11-15 · Dauer: 20:20 – 20:33 (Erstumsetzung, 13 min) und 21:15 – 21:35 (Nacharbeit, ca. 20 min, davon Warten auf Rückmeldung ca. 5 min; Halte nicht einzeln mit `date` erfasst) · Status: teilweise (Messung nur mit synthetischen Seiten; Gerätetest und Komponenten-Browsertest offen)

## Ergebnis
Der Foto-Import nimmt 1–10 Seiten über ein natives `<input type="file" accept="image/*" multiple>` auf, verkleinert jede Seite beim Hinzufügen im Client (lange Kante 2000 px, JPEG 0,85, dazu ein 320-px-Vorschaubild) und schickt alle Seiten in einem Aufruf an `/ai/import/image` (je Bild ≤ 10 MB, gesamt ≤ 20 MB, `detail: "high"`, Reihenfolge erhalten). Die `getUserMedia`-Kamera ist entfernt, nginx erlaubt für `/api/v1/ai/` 20 MB. Die Nacharbeit N1–N5 ist umgesetzt, N6 (Messung) mit **synthetischen** Rezeptseiten, weil keine echten Testfotos vorliegen: Zutaten 18/18 korrekt, 10 Seiten in 28,8 s.

## Commits
- `8f170e4` feat(ai): Bildimport mit bis zu 10 Seiten in einem Aufruf
- `c169bc0` feat(frontend): Foto-Import mit nativer Auswahl, mehrseitig und verkleinert
- `e05ffd5` docs(ai): Regeln zum mehrseitigen Foto-Import und neuen Grenzen
- `3843c40` docs(ai): Abschlussbericht W.13
- `da46b78` feat(frontend): Foto-Import robuster, Vorschau und Zustand im Dialog (N1–N5)

## Verifikation
- Frontend `npm run lint:check`, `npm run typecheck`, `npm run build` → grün (nach der Nacharbeit).
- Backend `uv sync --frozen` (x86_64-Python) + `ruff check` + `ruff format --check` + `pytest` → grün, 120 passed, 5 skipped (DB-Tests); neue Tests in `tests/test_ai.py`: mehrere Dateien → ein Aufruf, Reihenfolge, `detail: "high"`, Seitenzahl im Begleittext (Client gemockt); kein Bild → 422; 11 Dateien → 422; Einzelbild zu groß → 413; gesamt zu groß → 413.
- Container (Erstumsetzung, Scratch-Compose Port 18081, danach `down -v`): Build und Start, Migrationen 001–006, `/api/health` ok. Über nginx: 19 MB an `/api/v1/ai/import/image` → 401 (erreicht das Backend), 21 MB → 413; 11 MB an `/api/` → 413. Die Nacharbeit ändert nur Frontend-Quellen und README (keine Abhängigkeiten, kein Dockerfile, keine Migration), der Container wurde danach nicht erneut gebaut.
- `grep` auf `getUserMedia|MediaStream|video|canvas` in `AIRecipeImport.vue` → keine Treffer.
- **Browsertest `imageResize.ts`** (Chrome headless, `playwright-core` im Scratchpad, Modul per esbuild gebündelt):
  - JPEG 4000×3000 → 2000×1500, 79 → 21 KB, Vorschau 320×240 (2 KB), 154 ms
  - PNG 800×600 mit Transparenz → nicht vergrößert, JPEG, Grund weiß
  - JPEG mit EXIF-Ausrichtung 6 → 1500×2000, Marker an der erwarteten Stelle (Ausrichtung angewendet)
  - nicht dekodierbare Datei → `ImageResizeError` mit HEIC-/Format-Meldung
  - N1: `TypeError` bei `imageOrientation` → Retry ohne Option klappt; `InvalidStateError` → Meldung, kein Retry
- **Messung (N6), synthetische Seiten** (Chrome rendert Rezeptseiten 3024×4032, Serifenschrift 34 px, leicht gedreht, Rauschen; Wahrheit bekannt: 18 Zutaten mit Mengen wie `1/2 TL`, `0,2 l`, `1,2 kg`, `1 Prise`, 27 Schritte). Request-Form wie im Branch (Begleittext, `detail: "high"`, Prompt aus dem Branch), über `docker exec` im laufenden lokalen Backend-Container, Modell `gpt-6-luna`, Key aus der Umgebung (nicht gelesen), 4 Aufrufe:

  | Seiten | vor Verkleinern | nach Verkleinern | Verkleinern (Browser) | Modelldauer | Ergebnis |
  |---|---|---|---|---|---|
  | 1 | 1,8 MB | 183 KB | 0,2 s | 12,4 s | 18/18 Zutaten korrekt |
  | 3 | 5,5 MB | 0,5 MB | 0,4 s | 17,7 s | 18/18 Zutaten, 6/6 Schritte |
  | 10 | 18,6 MB | 1,8 MB | 1,1 s | 28,8 s | 18/18 Zutaten, 27/27 Schritte in Reihenfolge |

  Seiten nach dem Verkleinern 1500×2000 (aus 3024×4032), je ca. 150–180 KB. Gesamtgröße bei 10 Seiten 1,8 MB: weit unter 20 MB; die Gesamtgrenze ist für rauscharme Seiten reichlich bemessen. Dauer 10 Seiten 28,8 s: weit unter dem Zeitbudget (Checkpoint-Schwelle 100 s). Lesbarkeit: Mengen bei 34-px-Schrift (auf 1500×2000 ca. 17 px) fehlerfrei erkannt.
  - **Grenzen der Messung:** Synthetische Seiten ohne Perspektive, Schatten, Unschärfe, Handschrift, Glanz; Rauschen im Verkleinerten weitgehend verloren, daher sind die Dateigrößen **zu klein** gegenüber echten Fotos (zu erwarten eher 300–800 KB je Seite, Annahme). Die Aussage „kleine Schrift bei 2000 px sicher erkannt“ ist damit **nicht** für echte Fotos belegt. Ein erster 10-Seiten-Lauf mit sich wiederholenden Schritttexten lieferte nur 6 Schritte (Modell fasste identische Sätze zusammen, Präfix „Schritt n:“ entfiel); mit eindeutigen Schritten vollständig. Echte Rezepte wiederholen Sätze selten; der Prompt-Satz „Nichts doppelt übernehmen“ (mehrere Bilder) sollte bei echten Vorlagen beobachtet werden.
- Sichtprüfung der Komponente: keine. Dialog (Hinweise, Fortschrittsanzeige, Zustand beim Schließen/Öffnen, Seite entfernen) nicht im Browser gesehen, es fehlt der Login; N2–N4 sind per `typecheck` und `lint` abgesichert.
- Prüfzeit: Nacharbeit ca. 3 min (Frontend ~2 min, Backend ~10 s); größter Posten: `lint:check`/`typecheck`/`build`.
- Prüfskripte: nur Scratchpad unter `C:/Users/ce/AppData/Local/Temp/claude/beb48852c7fd70f3/c367018e-1cdf-419a-9311-ad89cad149f5/scratchpad/pw/` (`test.mjs`, `gen.mjs`, `resize.mjs`, `measure.py`, `pages/`, `resized/`); Scratch-Compose unter `…/scratchpad/stack/compose.yml`.

## Struktur und Doku
- Neu: `src/js/imageResize.ts` (`computeTargetSize` als reine Funktion für W.10, `resizeImage` liefert Blob und Vorschau), `components/features/ImportPageList.vue`, `composables/useImportPages.ts` (Seitenzustand auf Modulebene, bleibt beim Schließen des Dialogs erhalten). `AIRecipeImport.vue` 361 → ca. 330 Zeilen.
- Bewusstes Verhalten: Der Seitenzustand lebt auf Modulebene (nicht in der Komponente), weil unbestätigt ist, ob `BModal` den Inhalt beim Schließen abbaut. Object-URLs der Vorschauen werden erst bei Import oder „Neu“ freigegeben.
- Berührte Aussagen: `.claude/rules/ai-import.md` nachgetragen (Mehrseitigkeit, `detail`, Grenzen, Proxy ≥ 20 MB, `paths:` erweitert) (auch Vorschaubild, `useImportPages`, Retry bei `TypeError`). README: Abschnitt „Starten“ nennt jetzt die Proxy-Anforderungen (≥ 20 MB, ≥ 150 s). CLAUDE.md stimmt noch.

## Abweichungen vom Auftrag
- Messung mit synthetischen statt echten Seiten (keine Testfotos), siehe Grenzen oben.
- Über der Seitengrenze übernimmt der Client die ersten Bilder und meldet die übrigen ausdrücklich (keine stille Kürzung, aber auch kein Komplettabbruch).
- Immer JPEG, auch bei kleinen Bildern; kleinere Bilder werden nicht vergrößert.
- Natives `<input>` statt `BFormFile` (A8); kein `capture`-Attribut (iOS bietet sonst keine Mediathek).
- EXIF-Ausrichtung und HEIC: im Chrome-Test bestätigt (Ausrichtung), auf iOS/Safari **unbestätigt** (ob iOS beim `<input>` HEIC oder JPEG liefert).
- Nacharbeit N5: Der README-Absatz steht im Schnellstart unter „Starten“ (dort steht der Reverse-Proxy-Hinweis), nicht in einem eigenen Abschnitt.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Gerätetest für dich** (iPhone und iPad, installierte PWA): Kamera aufnehmen; Mediathek wählen; mehrere Seiten nacheinander und mehrere auf einmal; Hoch- und Querformat (Ausrichtung in Vorschau und Ergebnis); HEIC-Fotos; 11. Seite abgelehnt; Seite entfernen; Dialog schließen und wieder öffnen (Seiten bleiben); eine Datei defekt/nicht lesbar in einer Mehrfachauswahl (übrige werden übernommen); 10 Seiten erkennen. Dabei bitte auf echte Fotos achten: kleine Schrift, Schatten, Dateigrößen.
- **Messung mit echten Fotos** (Aufwand S), falls die synthetische Messung nicht genügt: vor allem Lesbarkeit kleiner Schrift bei 2000 px und echte Dateigrößen.
- **Server:** Äußerer Reverse-Proxy: Body ≥ 20 MB und Timeouts ≥ 150 s für `/api/v1/ai/` (Werte dort unbekannt).

## Status je Roadmap-Punkt
- `W.13` teilweise (Gerätetest, echte Fotos, Komponenten-Browsertest offen)

## Vorschlag Roadmap-Zeilen
`- [ ] W.13 Foto-Import über native Auswahl, mehrseitig, verkleinert · teilweise 2026-11-15 · da46b78 (Gerätetest offen)`
