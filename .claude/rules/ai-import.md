---
paths:
  - backend/app/routes/ai.py
  - backend/app/services/openai_client.py
  - backend/app/schemas/ai.py
  - backend/prompts/**
  - frontend/src/api/ai.ts
  - frontend/src/js/imageResize.ts
  - frontend/src/components/features/AIRecipeImport.vue
  - frontend/src/components/features/ImportPageList.vue
  - frontend/.docker/nginx/prod.conf
---

# AI-Import

- **Modell** steht in `site_settings` (`ai_model_text`, `ai_model_image`, Default `gpt-6-luna`), Admin-Seite setzt es. Der Client schickt kein Modell. Der Key bleibt in `OPENAI_API_KEY`.
- **Antwortformat:** Responses API mit `text_format=AIRecipe` (`schemas/ai.py`, strict: alle Felder Pflicht, fehlende Werte `null`/leer). UUID und `lastUpdated` setzt das Frontend, `haccp` fehlt absichtlich. Websuche (`{"type": "web_search"}`) und Bildeingabe funktionieren zusammen mit dem Schema (geprüft 2026-11-15).
- **Prompt** `backend/prompts/system_prompt.md` liegt im Image (kein Volume) und wird mit dem Schema in `schemas/ai.py` versioniert; Änderung per Deploy. Fehlt die Datei, startet das Backend nicht.
- **Zeitbudget:** OpenAI-Client 120 s (`OPENAI_TIMEOUT_S`, keine Retries) < Frontend 135 s (`AI_TIMEOUT_MS`) < nginx `proxy_read_timeout` 150 s für `/api/v1/ai/`. Der äußere Reverse-Proxy muss mindestens 150 s und **20 MB** für `/api/v1/ai/` erlauben.
- **Foto-Import mehrseitig:** 1–10 Seiten in einem Modellaufruf (`POST /ai/import/image`, Feld `files`, Reihenfolge = Seitenreihenfolge), jede Seite als `input_image` mit `detail: "high"` ausdrücklich (nicht `auto`). Der Prompt hat dazu den Abschnitt „MEHRERE BILDER“. Der Client (`ImportPageList.vue`, `AIRecipeImport.vue`) verkleinert jede Seite beim Hinzufügen in `src/js/imageResize.ts` (lange Kante 2000 px, JPEG 0,85, immer JPEG, Seiten nacheinander wegen iOS-Speicher) und hält die Blobs, nicht Data-URIs. Natives `<input type="file" accept="image/*" multiple>` ohne `capture` (iOS bietet dann Kamera und Mediathek); das Feld wird nach jeder Auswahl zurückgesetzt.
- **Bildgrenzen** je Bild 10 MB, gesamt 20 MB, 10 Seiten: `MAX_IMAGE_MB`/`MAX_TOTAL_MB`/`MAX_PAGES` im Backend (`routes/ai.py`) und in `api/ai.ts` gleich; die Gesamtgrenze entspricht `client_max_body_size 20M` in `prod.conf` (nur `/api/v1/ai/`, sonst `/api/` 10M). Backend: 413 (Bild bzw. gesamt zu groß), 422 (kein Bild, zu viele Seiten), 400 (kein Bild-Typ).
- **Fehler:** `translate_openai_error` bildet OpenAI-Fehler auf 429/502/503/504 ab, Details nur im Log. `aiErrorMessage` (`api/ai.ts`) macht daraus die Meldung im Dialog.
- **Modell-IDs prüfen:** `gpt-4o`/`gpt-4o-mini` sind laut OpenAI-Doku für 2027-01-14 als deprecated gelistet; `web_search_preview` ist Legacy.
- `UserSettings` ignoriert unbekannte Felder (`extra: ignore`): PWA-Clients im Cache senden noch das entfernte `gpt_model`.
