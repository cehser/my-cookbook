/**
 * AI proxy API service – recipe extraction via backend (keeps API key server-side).
 *
 * Läuft über api/client.ts (Token, 401-Retry). Das Modell wählt der Admin im
 * Backend; der Client schickt keins. `aiErrorMessage` macht aus jedem Fehler
 * eine Meldung für den Import-Dialog.
 */

import { api, ApiError, ApiTimeoutError } from "./client";
import type { Recipe } from "@/types/recipe";

/** Gesamtdauer eines AI-Aufrufs. Über dem Backend-Timeout (120 s), unter nginx (150 s). */
const AI_TIMEOUT_MS = 135_000;

/** Wie MAX_IMAGE_MB / MAX_TOTAL_MB / MAX_PAGES im Backend; Gesamtgrenze = client_max_body_size in prod.conf. */
export const MAX_IMAGE_MB = 10;
export const MAX_TOTAL_MB = 20;
export const MAX_PAGES = 10;

export interface AIImportResponse {
  recipe: Partial<Recipe>;
  model: string;
}

/** Fehler mit fertiger, deutscher Meldung für den Nutzer. */
export class AiImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiImportError";
  }
}

/** Liest `detail` aus einer FastAPI-Fehlerantwort (JSON oder Rohtext). */
function extractDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) return "Ungültige Anfrage.";
  } catch {
    // kein JSON (z. B. HTML-Fehlerseite von nginx)
  }
  return "";
}

/** Verständliche Meldung für jeden Fehler beim AI-Import. */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiImportError) return e.message;
  if (e instanceof ApiTimeoutError) {
    return "Die Analyse dauert zu lange. Bitte erneut versuchen oder einen kürzeren Text bzw. weniger Seiten wählen.";
  }
  if (e instanceof ApiError) {
    const detail = extractDetail(e.detail);
    switch (e.status) {
      case 401:
        return "Die Sitzung ist abgelaufen. Bitte neu anmelden.";
      case 403:
        return "Für den AI-Import fehlt die Berechtigung (Rolle Editor nötig).";
      case 413:
        return `Die Bilder sind zu groß. Maximum: ${MAX_IMAGE_MB} MB je Bild, ${MAX_TOTAL_MB} MB gesamt.`;
      case 429:
        return (
          detail || "Zu viele Anfragen. Bitte in einer Minute erneut versuchen."
        );
      case 502:
      case 503:
      case 504:
        // Vom Backend formulierte Meldung; nginx-Fehlerseiten haben keine.
        return (
          detail ||
          "Der Server ist für den AI-Import nicht erreichbar. Bitte später erneut versuchen."
        );
      default:
        return (
          detail || `Der AI-Import ist fehlgeschlagen (Fehler ${e.status}).`
        );
    }
  }
  if (e instanceof TypeError) {
    return "Keine Verbindung zum Server. Bitte Netzwerk prüfen.";
  }
  return e instanceof Error ? e.message : String(e);
}

export const aiApi = {
  /** Extract recipe from text, or from a web page if the text is a single URL. */
  importText: (text: string) =>
    api.post<AIImportResponse>(
      "/ai/import",
      { text },
      { timeoutMs: AI_TIMEOUT_MS },
    ),

  /** Extract one recipe from 1–MAX_PAGES page images (Vision), in reading order. */
  importImages(pages: Blob[]): Promise<AIImportResponse> {
    if (pages.length === 0) {
      return Promise.reject(new AiImportError("Kein Bild ausgewählt."));
    }
    if (pages.length > MAX_PAGES) {
      return Promise.reject(
        new AiImportError(`Zu viele Seiten. Maximum: ${MAX_PAGES}.`),
      );
    }
    if (pages.some((p) => p.size > MAX_IMAGE_MB * 1024 * 1024)) {
      return Promise.reject(
        new AiImportError(`Ein Bild ist zu groß. Maximum: ${MAX_IMAGE_MB} MB.`),
      );
    }
    const total = pages.reduce((sum, p) => sum + p.size, 0);
    if (total > MAX_TOTAL_MB * 1024 * 1024) {
      return Promise.reject(
        new AiImportError(
          `Die Bilder sind zu groß. Maximum: ${MAX_TOTAL_MB} MB gesamt.`,
        ),
      );
    }
    const formData = new FormData();
    pages.forEach((page, i) =>
      formData.append("files", page, `seite-${i + 1}.jpg`),
    );
    return api.post<AIImportResponse>("/ai/import/image", formData, {
      timeoutMs: AI_TIMEOUT_MS,
    });
  },
};
