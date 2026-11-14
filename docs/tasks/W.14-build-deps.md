# Auftrag W.14: Frontend-Lock, Vue-CLI-Altlasten, Base-Images

> Erstellt 2026-11-14 vom Master · Roadmap: `ROADMAP.md` Punkte W.14, W.2, W.7 · Basis: `main@725e78c` · Aufwand: M · Modell: Sonnet

## Ziel
Frontend-Abhängigkeiten auf den neuesten Stand innerhalb der bestehenden Versionsbereiche, `npm audit` ohne high. Tote Vue-CLI-Reste sind entfernt, und die Docker-Base-Images haben feste Tags. Keine Major-Updates und keine Codeänderungen in `frontend/src/`.

## Erst lesen
1. `docs/plans/abhaengigkeiten.md` – Versionsstand; Abschnitt „W.15“ zeigt, was hier **nicht** passiert
2. `frontend/package.json` – `overrides` (vite-plugin-pwa ↔ Vite 8, serialize-javascript)
3. `frontend/Dockerfile`, `backend/Dockerfile`, `docker-compose.yml.example`
4. `frontend/index.html` und `frontend/public/index.html` – unterscheiden sich (Viewport, Favicons)

## Auftrag

### W.14 Lock auffrischen
1. `npm update` im Frontend: nur Patch/Minor innerhalb der Bereiche in `package.json`; die Bereiche selbst nicht anheben.
2. `npm audit --audit-level=high` muss ohne Befund sein. Bleiben low/moderate übrig, die nur ein Major-Update oder Downgrade beheben würde: im Bericht auflisten, nicht erzwingen.
3. `npm ci --legacy-peer-deps` (wie im Dockerfile) muss mit dem neuen Lock fehlerfrei laufen.

### W.2 Vue-CLI-Altlasten entfernen
1. **Vor dem Löschen** `npm run build` und feststellen, welche HTML in `dist/index.html` landet: die verarbeitete Root-`index.html` oder die Kopie aus `public/` (Vite kopiert `public/` nach `dist/`).
2. Unterschiede gezielt in die Root-`index.html` übernehmen, damit nach dem Löschen nichts verloren geht, was heute ausgeliefert wird:
   - Viewport mit gesperrtem Zoom (`f1e20d5`) bleibt.
   - Favicon- und Apple-Touch-Links aus `public/index.html`, falls sie heute im Build stehen.
3. Löschen: `frontend/public/index.html`, `frontend/vue.config.js`, `frontend/jsconfig.json`, die `echo … > vue.config.js`-Zeile samt Kommentar im `frontend/Dockerfile`.
4. Erneut bauen, `dist/index.html` gegen den Stand aus Schritt 1 vergleichen. Die Unterschiede sind im Bericht zu nennen.

### W.7 Base-Images pinnen
1. `node:lts-alpine` → die Major-Linie, auf die `lts` heute zeigt (z. B. `node:24-alpine`). Mit den `engines` von Vite 8 abgleichen.
2. `nginx:stable-alpine` → konkrete stabile Minor-Linie (z. B. `nginx:1.28-alpine`), heutigen Stand prüfen.
3. `python:3.14-slim` und `postgres:16-alpine` bleiben: Python ist die gepinnte Laufzeitlinie. Bei Postgres bestimmt der Major das Datenformat, Patches sollen weiter kommen.
4. `--legacy-peer-deps` bleibt (entfällt mit vite-plugin-pwa 2 in W.15).

## Ablage
- Kein neuer Code. Änderungen nur in `frontend/package-lock.json`, `frontend/index.html`, den Dockerfiles; Löschungen wie oben.
- `docker-compose.yml.example` nur, falls dort ein Image-Tag geändert wird (heute nicht vorgesehen).

## Nicht in diesem Auftrag
- Major-Updates (W.15), Ersetzen von Paketen wie `deep-equal`/`sass` (W.16)
- `README.md`, `.claude/rules/frontend.md`: nur anpassen, falls sie gelöschte Dateien erwähnen
- Backend-Abhängigkeiten (W.4)

## Entscheidungen, die ich treffe
- keine

## Fallstricke
- **Kein `npm audit fix --force`.** Für einige Pakete schlägt npm ein **Downgrade** von `vite-plugin-pwa` auf 1.1.0 vor (Audit vom 2026-11-14).
- `public/index.html` kann den Build-Output überdecken. Deshalb vor dem Löschen messen (W.2 Schritt 1). Der Zoom-Fix steht nur in der Root-`index.html`.
- Windows-Checkout: `.gitattributes` erzwingt LF. Den Lockfile-Diff auf reine Versionsänderungen prüfen, nicht auf Zeilenenden.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `npm audit --audit-level=high` ohne Befund; verbliebene low/moderate im Bericht begründet
- In `package.json` ändern sich keine Versionsbereiche
- `npm ci --legacy-peer-deps` fehlerfrei
- `dist/index.html` enthält den Viewport mit `user-scalable=no` und die heute ausgelieferten Icon-Links
- Die vier Altdateien und die `echo`-Zeile sind weg
- Base-Image-Tags wie oben; `docker compose build` für Frontend und Backend erfolgreich, falls Docker verfügbar (sonst im Bericht vermerken)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend)
