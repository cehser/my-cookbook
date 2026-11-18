/**
 * Typen des Screenshot-Harness: Szenario = Route + Seed + Mock-Antworten + Geräte.
 */

import type { Recipe } from "../../src/types/recipe.ts";

/** Rezept, wie es der Server hat (Liste und Detail-GET). */
export interface ServerRecipe {
  id: string;
  recipe_name: string;
  /** JSONB-Inhalt wie im Backend (`ingredients`, `steps`, `subtitle` …) */
  data?: Record<string, unknown>;
  tags?: string[];
  /** Vorgabe: der `sub` des Seed-Nutzers */
  created_by?: string | null;
}

/** Eintrag der Vormerkung (IndexedDB `pendingCreates`), vgl. `PendingCreate`. */
export interface PendingSeed {
  recipe: Recipe;
  /** Vorgabe: der `sub` des Seed-Nutzers */
  sub?: string | null;
  rejected?: number;
  foreign?: true;
  deleted?: true;
}

export interface Seed {
  /** Angemeldeter Nutzer; `null` = ohne Sitzung */
  user?: { sub: string; name: string; role: string } | null;
  /** Rezepte auf dem Server (Liste, Detail-GET), nicht im Cache */
  serverRecipes?: ServerRecipe[];
  /** Vormerkung lokal angelegter Rezepte */
  pending?: PendingSeed[];
  /** Weitere Schlüssel in IndexedDB `keyval-store`/`keyval` (z. B. `recipe:<id>`) */
  idb?: Record<string, unknown>;
  /** Weitere localStorage-Einträge (Werte als String) */
  localStorage?: Record<string, string>;
}

/** Antwort der Mock-API; `body` fehlt → Vorgabe des Endpunkts. */
export interface MockResponse {
  status: number;
  body?: unknown;
  delayMs?: number;
}

/**
 * Antworten je Endpunkt, Schlüssel `"<METHODE> <Pfad>"` unter `/api/v1`,
 * Platzhalter `:name` für ein Segment, z. B. `"GET /recipes/:id"`,
 * `"POST /recipes"`. Überschreibt die Vorgaben des Mock-Servers.
 */
export type MockResponses = Record<string, MockResponse>;

export type DeviceName = "iphone" | "desktop";
export type Theme = "hell" | "dunkel";

export interface Scenario {
  /** Dateiname: `<gerät>-<thema>-<name>.png` */
  name: string;
  description: string;
  /** Route der App, z. B. `/recipe/<id>` */
  route: string;
  seed: Seed;
  responses?: MockResponses;
  /** Vorgabe: `["iphone"]` */
  devices?: DeviceName[];
  /** Vorgabe: hell und dunkel */
  themes?: Theme[];
  /** Erst fotografieren, wenn dieser Text sichtbar ist */
  waitForText?: string;
  /** Danach diese Elemente der Reihe nach anklicken (CSS-Selektoren), z. B. ein Menü öffnen */
  clicks?: string[];
  /** Ganze Seite statt nur Viewport */
  fullPage?: boolean;
}
