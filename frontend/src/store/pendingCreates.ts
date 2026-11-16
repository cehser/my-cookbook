/**
 * Vormerkung lokal angelegter Rezepte und ihre Übertragung zum Backend.
 *
 * Ein Rezept, das beim Anlegen nur auf dem Gerät landet (offline, Timeout,
 * 5xx), steht in `pendingCreates` (IndexedDB), getrennt von der Rezeptliste
 * aus der API, mit dem `sub` des angemeldeten Nutzers. Übertragen und
 * angezeigt werden nur Einträge des angemeldeten Nutzers, und nur ausdrücklich
 * vorgemerkte Rezepte, nie „Rezepte, die in der API-Liste fehlen“ (sonst kämen
 * auf einem anderen Gerät gelöschte Rezepte zurück). Die ID des Clients ist
 * zugleich die Backend-ID; eine Wiederholung legt nichts doppelt an (409,
 * Abgleich per GET über den Ersteller).
 *
 * Ein Eintrag verlässt die Vormerkung erst, wenn der Server seinen aktuellen
 * Stand hat (nach POST bzw. nachgeschobenem PUT). Alle Zugriffe laufen
 * nacheinander (`locked`), die Übertragung als Single-Flight. Lese- und
 * Schreibfehler der IndexedDB werden geworfen; nach einem Lesefehler wird
 * nie geschrieben. Der Store ist dünner Aufrufer.
 */

import { ApiError, isClientError } from "@/api/client";
import { recipeApi, type RecipeDetail } from "@/api/recipes";
import { currentUserSub } from "@/auth/session";
import { deepCopyJSON } from "@/js/deepCopy";
import { isEqualPlain } from "@/js/isEqualPlain";
import {
  readPendingCreates,
  writePendingCreates,
  type PendingCreate,
} from "@/js/offlineCache";
import { detailToRecipe, recipeToPayload } from "@/js/recipeMapping";
import type { Recipe } from "@/types/recipe";

/** Die Vormerkung konnte nicht gespeichert werden (IndexedDB). */
export class LocalSaveError extends Error {
  constructor(public readonly reason: unknown) {
    super("Vormerkung konnte nicht gespeichert werden");
    this.name = "LocalSaveError";
  }
}

/** Gleicher Nutzer? `sub` des Tokens und `created_by` (kanonische UUID). */
function sameSub(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

// --- Vormerkung ---

let chain: Promise<unknown> = Promise.resolve();

/** Lesen-Ändern-Schreiben ohne verlorene Änderung: ein Zugriff zur Zeit. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

// Gelöscht, aber noch nicht geschrieben: Eine vorher begonnene Lesung darf
// das Rezept nicht zurück in die Liste bringen.
const removing = new Set<string>();

/**
 * Vorgemerkte Rezepte des angemeldeten Nutzers (auch abgelehnte, sie bleiben
 * sichtbar). Ein Lesefehler ergibt eine leere Liste, ohne zu schreiben.
 */
export async function listPending(): Promise<PendingCreate[]> {
  const sub = await currentUserSub();
  try {
    const entries = await locked(readPendingCreates);
    return entries.filter(
      (e) => e.sub === sub && !removing.has(e.recipe.recipe_uuid),
    );
  } catch {
    return [];
  }
}

/**
 * Rezept für den angemeldeten Nutzer vormerken (ersetzt einen Eintrag mit
 * derselben ID). Wirft `LocalSaveError`, wenn die IndexedDB scheitert.
 */
export async function addPending(recipe: Recipe): Promise<void> {
  const copy = deepCopyJSON(recipe);
  const sub = await currentUserSub();
  try {
    await locked(async () => {
      const entries = await readPendingCreates();
      const rest = entries.filter(
        (e) => e.recipe.recipe_uuid !== copy.recipe_uuid,
      );
      await writePendingCreates([...rest, { recipe: copy, sub }]);
    });
  } catch (e) {
    throw new LocalSaveError(e);
  }
}

/**
 * Vorgemerktes Rezept ändern. Eine frühere Ablehnung entfällt: Der Nutzer
 * hat das Rezept bearbeitet, die nächste Übertragung versucht es erneut.
 * Liefert `false`, wenn das Rezept nicht vorgemerkt ist; wirft bei
 * IndexedDB-Fehlern.
 */
export function updatePending(recipe: Recipe): Promise<boolean> {
  const copy = deepCopyJSON(recipe);
  return locked(async () => {
    const entries = await readPendingCreates();
    const entry = entries.find(
      (e) => e.recipe.recipe_uuid === copy.recipe_uuid,
    );
    if (!entry) return false;
    entry.recipe = copy;
    delete entry.rejected;
    await writePendingCreates(entries);
    return true;
  });
}

/**
 * Aus der Vormerkung entfernen; `true`, wenn es vorgemerkt war. Wirft bei
 * IndexedDB-Fehlern.
 */
export function removePending(uuid: string): Promise<boolean> {
  removing.add(uuid);
  return locked(async () => {
    const entries = await readPendingCreates();
    const rest = entries.filter((e) => e.recipe.recipe_uuid !== uuid);
    if (rest.length === entries.length) return false;
    await writePendingCreates(rest);
    return true;
  }).finally(() => removing.delete(uuid));
}

/** Übertragung abgelehnt: vorgemerkt lassen, nicht automatisch wiederholen. */
function markRejected(uuid: string, status: number): Promise<void> {
  return locked(async () => {
    const entries = await readPendingCreates();
    const entry = entries.find((e) => e.recipe.recipe_uuid === uuid);
    if (!entry) return;
    entry.rejected = status;
    await writePendingCreates(entries);
  });
}

/**
 * Der Server hat `sent`. Ist der vorgemerkte Stand unverändert, Eintrag
 * entfernen (`done`); wurde er inzwischen bearbeitet, den neueren Stand
 * liefern (bleibt vorgemerkt); `deleted`, wenn er inzwischen gelöscht wurde.
 */
function settle(
  sent: Recipe,
): Promise<
  | { status: "done" }
  | { status: "deleted" }
  | { status: "changed"; recipe: Recipe }
> {
  return locked(async () => {
    const entries = await readPendingCreates();
    const entry = entries.find(
      (e) => e.recipe.recipe_uuid === sent.recipe_uuid,
    );
    if (!entry) return { status: "deleted" as const };
    if (!isEqualPlain(entry.recipe, sent)) {
      return { status: "changed" as const, recipe: entry.recipe };
    }
    await writePendingCreates(entries.filter((e) => e !== entry));
    return { status: "done" as const };
  });
}

// --- Anlegen mit Client-ID ---

export type CreateOutcome =
  | { status: "created"; detail: RecipeDetail }
  | { status: "rejected"; error: unknown };

/** 4xx (außer 401/408/429) als Ablehnung, alles andere als Ausfall werfen. */
function rejectedOrThrow(e: unknown): CreateOutcome {
  if (isClientError(e)) return { status: "rejected", error: e };
  throw e;
}

/** Vorgemerkten Stand per PUT auf den Server bringen. */
async function pushUpdate(recipe: Recipe): Promise<CreateOutcome> {
  try {
    const detail = await recipeApi.update(
      recipe.recipe_uuid,
      recipeToPayload(recipe),
    );
    return { status: "created", detail };
  } catch (e) {
    return rejectedOrThrow(e);
  }
}

/**
 * Legt das Rezept mit seiner `recipe_uuid` an. Bei 409 gleicht ein GET über
 * den Ersteller ab: Hat der angemeldete Nutzer es angelegt, ist es eine
 * Wiederholung derselben Anlage (Antwort ging verloren). Weicht der
 * Serverstand vom übergebenen ab (inzwischen bearbeitet), wird der
 * übergebene per PUT nachgeschoben. Ein fremdes Rezept wird weder
 * überschrieben noch übernommen (`rejected`). Weitere 4xx: `rejected`.
 * Ausfälle (offline, Timeout, 5xx, 401) wirft die Funktion weiter.
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
    if (!(e instanceof ApiError && e.status === 409)) return rejectedOrThrow(e);
    const existing = await recipeApi.get(recipe.recipe_uuid);
    if (!sameSub(existing.created_by, await currentUserSub())) {
      return { status: "rejected", error: e };
    }
    // JSON-Kopien: `undefined`-Felder zählen nicht als Unterschied
    const unchanged = isEqualPlain(
      deepCopyJSON(recipeToPayload(detailToRecipe(existing))),
      deepCopyJSON(recipeToPayload(recipe)),
    );
    return unchanged
      ? { status: "created", detail: existing }
      : pushUpdate(recipe);
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
 * Überträgt die vorgemerkten Rezepte des angemeldeten Nutzers nacheinander.
 * Nur mit gültiger Sitzung aufrufen. Single-Flight: Ein zweiter Aufruf
 * während eines Laufs bekommt dessen Ergebnis, seine Handler werden nicht
 * genutzt.
 * - angelegt (201 oder eigenes 409): erst entfernen, wenn der Server den
 *   vorgemerkten Stand hat (sonst PUT des neueren Stands)
 * - während der Anfrage gelöscht: auf dem Server wieder löschen
 * - Ausfall (auch IndexedDB): vorgemerkt lassen, Lauf beenden, später erneut
 * - abgelehnt (4xx, fremdes 409): vorgemerkt lassen und markieren
 */
export function transferPending(
  handlers: TransferHandlers,
): Promise<TransferReport> {
  transferInFlight ??= doTransfer(handlers).finally(() => {
    transferInFlight = null;
  });
  return transferInFlight;
}

/** Höchstens so viele PUTs je Rezept und Lauf, falls weiter bearbeitet wird. */
const MAX_UPDATES = 3;

async function doTransfer({
  onCreated,
}: TransferHandlers): Promise<TransferReport> {
  const report: TransferReport = { transferred: 0, rejected: [] };
  const open = (await listPending()).filter((e) => e.rejected === undefined);
  try {
    for (const { recipe } of open) {
      const outcome = await transferOne(recipe, onCreated);
      if (outcome === "transferred") report.transferred++;
      else if (outcome !== "skipped") report.rejected.push(outcome);
    }
  } catch (e) {
    console.warn("Transfer of pending recipes interrupted", e);
  }
  return report;
}

/** Ein Rezept übertragen; wirft bei Ausfall (Netz, Server, IndexedDB). */
async function transferOne(
  recipe: Recipe,
  onCreated: (detail: RecipeDetail) => void,
): Promise<"transferred" | "skipped" | TransferReport["rejected"][number]> {
  let sent = recipe;
  let outcome = await createWithClientId(sent);
  for (let updates = 0; ; updates++) {
    if (outcome.status === "rejected") {
      const status =
        outcome.error instanceof ApiError ? outcome.error.status : 400;
      await markRejected(recipe.recipe_uuid, status);
      return { recipe_name: sent.recipe_name, error: outcome.error };
    }
    const settled = await settle(sent);
    if (settled.status === "done") {
      onCreated(outcome.detail);
      return "transferred";
    }
    if (settled.status === "deleted") {
      // Während der Anfrage gelöscht: Der Server hat es trotzdem angelegt
      try {
        await recipeApi.delete(recipe.recipe_uuid);
      } catch (e) {
        console.warn("Delete after transfer failed", e);
      }
      return "skipped";
    }
    // Während der Anfrage bearbeitet: neueren Stand nachschieben; bleibt
    // vorgemerkt, bis der PUT gelingt
    if (updates >= MAX_UPDATES) return "skipped";
    sent = settled.recipe;
    outcome = await pushUpdate(sent);
  }
}
