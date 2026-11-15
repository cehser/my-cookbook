# Auftrag W.13: Foto-Import über native Auswahl, mehrseitig, verkleinert

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkt W.13 · Basis: `main@624c418` · Aufwand: M · Modell: Sonnet

## Ziel
Der Foto-Import nimmt 1–10 Seiten eines Rezepts über die native Kamera bzw. Fotoauswahl auf, verkleinert sie im Client und erkennt daraus in einem Modellaufruf ein Rezept. Die eigene Kamera-Komponente (`getUserMedia`) entfällt. Das Speichern der Seiten am Rezept ist nicht Teil (W.28).

## Erst lesen
1. `docs/plans/zuverlaessigkeit-login-ai-import.md` – Abschnitte „W.13 Foto-Aufnahme im AI-Import“ (Befunde K1–K7, Entscheidung, Richtung, „Entschieden (2026-11-15): mehrseitige Vorlagen“) und „W.28“ (was danach auf dieser Arbeit aufbaut)
2. `frontend/src/components/features/AIRecipeImport.vue`, `frontend/src/api/ai.ts`
3. `backend/app/routes/ai.py` (`ai_import_image`, `MAX_IMAGE_MB`), `backend/prompts/system_prompt.md`
4. `frontend/.docker/nginx/prod.conf` (Location `/api/v1/ai/`)
5. `.claude/rules/ai-import.md`, `.claude/rules/frontend.md`

## Auftrag
1. **Aufnahme:** Kamera-Tab mit Video, Canvas und Stream-Verwaltung ersetzen durch einen Tab „Foto aufnehmen oder wählen“ mit `<input type="file" accept="image/*" multiple>` und einem Button „Seite hinzufügen“, der weitere Seiten anhängt. Vorschau aller Seiten mit Seitennummer, einzelne Seiten entfernen. Höchstens 10 Seiten; darüber eine Meldung, keine stille Kürzung. Die Seitenliste hält die **verkleinerten Blobs** (nicht Data-URIs), damit W.28 sie nach dem Import hochladen kann.
2. **Verkleinern** in einem eigenen Modul `src/js/imageResize.ts` ohne neue Abhängigkeit: lange Kante 2000 px, JPEG ~0,85, kleinere Bilder nicht vergrößern. Jede Seite beim Hinzufügen verkleinern, nicht erst beim Absenden.
3. **API:** `aiApi.importImages(pages: Blob[])` statt `importImage`; Prüfung der Grenzen im Client (je Bild, gesamt, Anzahl) mit Meldung vor dem Upload. Meldung bei 413 an die neuen Grenzen anpassen.
4. **Backend** `/ai/import/image`: 1–10 Dateien (`files: list[UploadFile]`), je Bild ≤ 10 MB, gesamt ≤ 20 MB, sonst 413 bzw. 422 mit deutscher Meldung. Ein Aufruf mit allen Seiten als `input_image` in Reihenfolge, jeweils `detail: "high"`; Begleittext nennt die Seitenzahl. Im Prompt einen kurzen Hinweis zu mehrseitigen Vorlagen ergänzen (Seiten gehören zu einem Rezept, in Reihenfolge lesen).
5. **nginx:** `client_max_body_size` für `/api/v1/ai/` auf 20M, Kommentar anpassen. `/api/` bleibt bei 10M.
6. **Messen** mit echten Rezeptseiten: Dateigröße je Seite vor/nach dem Verkleinern, Gesamtgröße und Dauer bei 1, 3 und 10 Seiten; Lesbarkeit kleiner Schrift (Zutatenmengen) bei 2000 px.
7. **Doku:** `.claude/rules/ai-import.md` (Grenzen, `detail`, Mehrseitigkeit), README dort, wo es die Upload-Grenze und den Proxy nennt.

## Ablage
- Neu: `frontend/src/js/imageResize.ts`
- Geändert: `AIRecipeImport.vue` (schrumpft durch den Wegfall der Kamera; Seitenliste bei Bedarf als eigene Komponente unter `components/features/`), `api/ai.ts`, `backend/app/routes/ai.py`, `backend/prompts/system_prompt.md`, `prod.conf`, Backend-Smoke-Tests

## Nicht in diesem Auftrag
- Seiten am Rezept speichern, Abschnitt „Vorlage“, Sprung in die Bearbeitung (W.28)
- Text- und URL-Import, Admin-Einstellungen
- Vitest (W.10); die Größenberechnung in `imageResize.ts` aber als reine Funktion, damit W.10 sie testen kann

## Entscheidungen, die ich treffe
- Nur falls die Messung es verlangt (siehe Checkpoint): Zeitbudget anheben oder Seitenzahl begrenzen; `detail: "original"` statt `high`.

## Fallstricke
- **Speicher auf iOS:** 10 Fotos à 12–48 MP gleichzeitig dekodiert können Safari zum Absturz bringen. Seiten nacheinander verkleinern, `ImageBitmap.close()` aufrufen, Canvas danach freigeben (Breite/Höhe 0).
- **Ausrichtung und Format** (unbestätigt, prüfen und im Bericht festhalten): EXIF-Ausrichtung beim Zeichnen (`createImageBitmap` mit `imageOrientation: "from-image"` bzw. Safari-Verhalten); ob iOS bei `<input type="file">` HEIC oder JPEG liefert; Verhalten bei HEIC in Browsern ohne HEIC-Dekodierung (verständliche Meldung statt stillem Fehler).
- **`capture`:** Mit `capture="environment"` öffnet iOS direkt die Kamera ohne Mediathek. Für „aufnehmen oder wählen“ ohne Attribut; der Button „Seite hinzufügen“ nutzt dasselbe Feld. Die Wahl im Bericht begründen.
- **BFormFile:** Das `change`-Ereignis liefert ein nicht dispatchtes `CustomEvent` mit `target` null (Ursache von A8 in W.12). Auf das Model reagieren oder ein natives `<input>` nutzen; bei `multiple` dasselbe Feld nach jeder Auswahl zurücksetzen, damit dieselbe Datei erneut wählbar ist.
- **Seitenwechsel:** Fotoauswahl und Kamera setzen die Seite auf `hidden`; `swUpdate.ts` lädt dort bewusst nicht neu. Nichts daran ändern.
- **Zeitbudget:** Kette Backend 120 s < Frontend 135 s < nginx 150 s (`.claude/rules/ai-import.md`). 10 Seiten verlängern die Modellzeit.
- **Altclient:** Ein noch gecachter alter Client schickt das Feld `file`; keine Kompatibilität nötig, dessen Foto-Import ist ohnehin defekt (A8).
- **Kosten:** Echte OpenAI-Aufrufe mit 10 Seiten kosten mehr; wenige Läufe, Messung bündeln. Eigene Fotos von Rezeptseiten liegen nicht im Repo; bei Bedarf mich um Testfotos bitten.
- **Lokaler Stack:** `docker-compose.yml` und `.env` liegen im Hauptcheckout; `.env` nicht lesen. Für Container-Tests eigenes Compose im Scratchpad oder mich bitten, den Stack zu starten.

## Checkpoints
- Nur falls die Messung zeigt, dass 10 Seiten das Zeitbudget sprengen (Dauer > 100 s) oder kleine Schrift bei 2000 px nicht sicher erkannt wird: Messwerte vorlegen und anhalten. Sonst ohne Halt bis zum Bericht.

## Abnahme
- Kein `getUserMedia`, `MediaStream`, Video- oder Canvas-Aufnahme mehr in `AIRecipeImport.vue` (`grep`)
- Im Browser (Desktop, schmales Fenster): 1 und mehrere Seiten wählen, Seite entfernen, Seite anhängen, dieselbe Datei erneut wählen, 11. Seite abgelehnt; Rezept erkannt
- Messwerte aus Schritt 6 im Bericht
- Backend-Tests: mehrere Dateien → ein Aufruf mit Bildern in Reihenfolge und `detail: "high"` (Client gemockt); zu viele Dateien, Einzelbild zu groß, Gesamt zu groß, kein Bild → jeweils 4xx mit Meldung
- Bericht listet die Geräteszenarien für mich (iPhone und iPad als installierte PWA: Kamera, Mediathek, mehrere Seiten, Hoch- und Querformat, Modal mehrfach öffnen) und nennt die Proxy-Grenze für den Server (≥ 20 MB für `/api/v1/ai/`)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend und Backend, mit Container)

## Nacharbeit (2026-11-15, nach Prüfung)

Ausgangsstand: `e05ffd5`.

- **N1 `createImageBitmap`:** Wirft der Aufruf mit `{ imageOrientation: "from-image" }` einen `TypeError` (Option unbekannt, ältere WebKit-Versionen), ohne Optionen erneut versuchen; nur ein echter Dekodierfehler führt zur HEIC-/Format-Meldung. Beim Zeichnen `imageSmoothingQuality = "high"` setzen.
- **N2 Fehler im Stapel:** Scheitert eine Datei, die übrigen trotzdem verarbeiten; fehlgeschlagene Dateien und die Kürzung über 10 Seiten am Ende gesammelt melden (beide Meldungen sichtbar).
- **N3 Ladeanzeige und Vorschau:** Eigene Anzeige „Seiten werden vorbereitet“ ab der ersten Auswahl, getrennt vom Button „Rezept erkennen“. Beim Verkleinern zusätzlich ein kleines Vorschaubild (z. B. lange Kante 320 px) erzeugen und in `ImportPageList` anzeigen; die 2000-px-Blobs bleiben für Upload und W.28.
- **N4 Zustand im Dialog:** Seiten bleiben beim Schließen und erneuten Öffnen des Modals erhalten (versehentliches Schließen verwirft keine Aufnahmen). `error` und `result` beim Entfernen einer Seite, beim Hinzufügen und bei „Neu“ zurücksetzen.
- **N5 README:** im Betriebsteil (Abschnitt Reverse-Proxy) die Anforderungen an den äußeren Proxy für `/api/v1/ai/`: Body ≥ 20 MB, Timeouts ≥ 150 s.
- **N6 Messung** (Schritt 6 des Auftrags), freigegeben mit wenigen echten Aufrufen (1, 3, 10 Seiten):
  - Testfotos: Ordner mit echten Rezeptseiten nennt der Nutzer in der Sitzung.
  - Größen vor/nach mit der echten `imageResize.ts` im Headless-Browser (`playwright-core` wie in W.22).
  - Modelldauer und Ergebnis per Skript im laufenden lokalen Backend-Container (`docker compose exec backend python …` im Hauptcheckout), Request-Form wie im Branch (`detail: "high"`, Begleittext, Prompt aus dem Branch per stdin). Der Key wird dort aus der Umgebung genutzt, weder gelesen noch ausgegeben; `.env` nicht lesen.
  - Lesbarkeit: Zutatenmengen kleiner Schrift mit der Vorlage vergleichen.
  - Checkpoint wie im Auftrag: Dauer > 100 s bei 10 Seiten oder kleine Schrift nicht sicher erkannt → Messwerte vorlegen und anhalten.

### Abnahme Nacharbeit
- Messwerte (Größe je Seite vor/nach, Gesamtgröße, Dauer bei 1/3/10 Seiten, Lesbarkeit) im Bericht
- Komponentenlogik von N1–N4 im Headless-Browser geprüft, soweit ohne Login möglich (z. B. `imageResize.ts` mit JPEG, PNG, gedrehtem JPEG, nicht dekodierbarer Datei); sonst begründet
- Bericht um Abschnitt „Nacharbeit“ fortschreiben; Verifikation gemäß Projekt-CLAUDE.md (Frontend und Backend)
