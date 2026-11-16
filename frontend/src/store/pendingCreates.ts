/**
 * Vormerkung lokal angelegter Rezepte und ihre Übertragung zum Backend.
 *
 * Ein Rezept, das beim Anlegen nur auf dem Gerät landet (offline, Timeout,
 * 5xx), steht in `pendingCreates` (IndexedDB), getrennt von der Rezeptliste
 * aus der API. Übertragen werden nur ausdrücklich vorgemerkte Rezepte, nie
 * „Rezepte, die in der API-Liste fehlen“ (sonst kämen auf einem anderen Gerät
 * gelöschte Rezepte zurück). Die ID des Clients ist zugleich die Backend-ID;
 * eine Wiederholung legt nichts doppelt an (409, Abgleich per GET).
 *
 * Alle Zugriffe auf die Vormerkung laufen nacheinander (`locked`), die
 * Übertragung als Single-Flight. Der Store ist dünner Aufrufer.
 */

import { ApiError, isClientError } from "@/api/client";
import { recipeApi, type RecipeDetail } from "@/api/recipes";
import { deepCopyJSON } from "@/js/deepCopy";
import { isEqualPlain } from "@/js/isEqualPlain";
import {
  readPendingCreates,
  writePendingCreates,
  type PendingCreate,
} from "@/js/offlineCache";
import { recipeToPayload } from "@/js/recipeMapping";
import type { Recipe } from "@/types/recipe";

// --- Vormerkung ---

let chain: Promise<unknown> = Promise.resolve();

/** Lesen-Ändern-Schreiben ohne verlorene Änderung: ein Zugriff zur Zeit. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<PendingCreate[]> {
  return (await readPendingCreates()) ?? [];
}

// Gelöscht, aber noch nicht geschrieben: Eine vorher begonnene Lesung darf
// das Rezept nicht zurück in die Liste bringen.
const removing = new Set<string>();

/** Vorgemerkte Rezepte (auch abgelehnte, sie bleiben sichtbar). */
export async function listPending(): Promise<PendingCreate[]> {
  const entries = await locked(readAll);
  return entries.filter((e) => !removing.has(e.recipe.recipe_uuid));
}

/** Rezept vormerken (ersetzt einen Eintrag mit derselben ID). */
export function addPending(recipe: Recipe): Promise<void> {
  const copy = deepCopyJSON(recipe);
  return locked(async () => {
    const entries = await readAll();
    const rest = entries.filter(
      (e) => e.recipe.recipe_uuid !== copy.recipe_uuid,
    );
    await writePendingCreates([...rest, { recipe: copy }]);
  });
}

/**
 * Vorgemerktes Rezept ändern. Eine frühere Ablehnung entfällt: Der Nutzer
 * hat das Rezept bearbeitet, die nächste Übertragung versucht es erneut.
 * Liefert `false`, wenn das Rezept nicht vorgemerkt ist.
 */
export function updatePending(recipe: Recipe): Promise<boolean> {
  const copy = deepCopyJSON(recipe);
  return locked(async () => {
    const entries = await readAll();
    const index = entries.findIndex(
      (e) => e.recipe.recipe_uuid === copy.recipe_uuid,
    );
    if (index < 0) return false;
    entries[index] = { recipe: copy };
    await writePendingCreates(entries);
    return true;
  });
}

/** Aus der Vormerkung entfernen; `true`, wenn es vorgemerkt war. */
export function removePending(uuid: string): Promise<boolean> {
  removing.add(uuid);
  return locked(async () => {
    const entries = await readAll();
    const rest = entries.filter((e) => e.recipe.recipe_uuid !== uuid);
    if (rest.length === entries.length) return false;
    await writePendingCreates(rest);
    return true;
  }).finally(() => removing.delete(uuid));
}

/** Übertragung abgelehnt: vorgemerkt lassen, nicht automatisch wiederholen. */
function markRejected(uuid: string, status: number): Promise<void> {
  return locked(async () => {
    const entries = await readAll();
    const entry = entries.find((e) => e.recipe.recipe_uuid === uuid);
    if (!entry) return;
    entry.rejected = status;
    await writePendingCreates(entries);
  });
}

/**
 * Nach erfolgreichem Anlegen entfernen. Liefert den vorgemerkten Stand, falls
 * er sich während der Anfrage geändert hat, `null` bei unverändertem Stand
 * und `undefined`, wenn das Rezept inzwischen gelöscht wurde.
 */
function takeAfterCreate(sent: Recipe): Promise<Recipe | null | undefined> {
  return locked(async () => {
    const entries = await readAll();
    const entry = entries.find(
      (e) => e.recipe.recipe_uuid === sent.recipe_uuid,
    );
    if (!entry) return undefined;
    await writePendingCreates(entries.filter((e) => e !== entry));
    return isEqualPlain(entry.recipe, sent) ? null : entry.recipe;
  });
}

// --- Anlegen mit Client-ID ---

export type CreateOutcome =
  | { status: "created"; detail: RecipeDetail }
  | { status: "rejected"; error: unknown };

/**
 * Legt das Rezept mit seiner `recipe_uuid` an. Bei 409 gleicht ein GET ab:
 * Gleicher Name heißt Wiederholung derselben Anlage (`created`), sonst ist
 * es eine fremde Kollision und wird weder überschrieben noch übernommen
 * (`rejected`). Weitere 4xx: `rejected`. Ausfälle (offline, Timeout, 5xx,
 * 401) wirft die Funktion weiter.
 */
export async function createWithClientId(
  recipe: Recipe,
): Promise<CreateOutcome> {
  try {
    const detail = await recipeApi.create(
      recipe.recipe_uuid,
      recipeToPayload(recipe),
    );
    return { status: "created", detail };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      const existing = await recipeApi.get(recipe.recipe_uuid);
      if (existing.recipe_name === recipe.recipe_name) {
        return { status: "created", detail: existing };
      }
      return { status: "rejected", error: e };
    }
    if (isClientError(e)) return { status: "rejected", error: e };
    throw e;
  }
}

// --- Übertragung ---

export interface TransferReport {
  /** Übertragene Rezepte */
  transferred: number;
  /** In diesem Lauf abgelehnt (vorgemerkt, nicht automatisch wiederholt) */
  rejected: { recipe_name: string; error: unknown }[];
}

export interface TransferHandlers {
  /** Rezept ist angelegt: in Liste und Cache übernehmen. */
  onCreated: (detail: RecipeDetail) => void;
}

let transferInFlight: Promise<TransferReport> | null = null;

/**
 * Überträgt die vorgemerkten Rezepte nacheinander. Nur mit gültiger Sitzung
 * aufrufen. Single-Flight: Ein zweiter Aufruf während eines Laufs bekommt
 * dessen Ergebnis, seine Handler werden nicht genutzt.
 * - angelegt (201 oder 409 mit Abgleich): aus der Vormerkung entfernen
 * - Ausfall: vorgemerkt lassen, Lauf beenden, beim nächsten Laden erneut
 * - abgelehnt (4xx): vorgemerkt lassen und markieren, nicht wiederholen
 */
export function transferPending(
  handlers: TransferHandlers,
): Promise<TransferReport> {
  transferInFlight ??= doTransfer(handlers).finally(() => {
    transferInFlight = null;
  });
  return transferInFlight;
}

async function doTransfer({
  onCreated,
}: TransferHandlers): Promise<TransferReport> {
  const report: TransferReport = { transferred: 0, rejected: [] };
  const open = (await listPending()).filter((e) => e.rejected === undefined);
  for (const { recipe } of open) {
    let outcome: CreateOutcome;
    try {
      outcome = await createWithClientId(recipe);
    } catch (e) {
      console.warn("Transfer of pending recipes interrupted", e);
      break;
    }
    if (outcome.status === "rejected") {
      const status =
        outcome.error instanceof ApiError ? outcome.error.status : 400;
      await markRejected(recipe.recipe_uuid, status);
      report.rejected.push({
        recipe_name: recipe.recipe_name,
        error: outcome.error,
      });
      continue;
    }
    const changed = await takeAfterCreate(recipe);
    // Während der Anfrage gelöscht: nicht wieder in die Liste bringen
    if (changed === undefined) continue;
    report.transferred++;
    if (changed === null) {
      onCreated(outcome.detail);
      continue;
    }
    // Während der Anfrage bearbeitet: den neueren Stand nachschieben
    try {
      onCreated(
        await recipeApi.update(recipe.recipe_uuid, recipeToPayload(changed)),
      );
    } catch (e) {
      console.warn("Update after transfer failed, edit stays local", e);
    }
  }
  return report;
}
