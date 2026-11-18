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
 * Stand hat (nach POST bzw. nachgeschobenem PUT). Gelöschte Einträge bleiben
 * als Löschung vorgemerkt (`deleted`), bis der Server das `DELETE`
 * bestätigt; bis dahin blenden Listenabrufe sie aus. Alle Zugriffe laufen
 * nacheinander (`locked`), die Übertragung als Single-Flight. Lese- und
 * Schreibfehler der IndexedDB werden geworfen; nach einem Lesefehler wird
 * nie geschrieben. Der Store ist dünner Aufrufer.
 */

import { ApiError, isClientError } from "@/api/client";
import { recipeApi, type RecipeDetail } from "@/api/recipes";
import { sameUser } from "@/auth/role";
import { currentUserSub } from "@/auth/session";
import { deepCopyJSON } from "@/js/deepCopy";
import { isEqualPlain } from "@/js/isEqualPlain";
import {
  readPendingCreates,
  writePendingCreates,
  type PendingCreate,
} from "@/js/offlineCache";
import { detailToRecipe, recipeToPayload } from "@/js/recipeMapping";
import { noteDeleted } from "@/store/listSync";
import type { Recipe } from "@/types/recipe";

/** Die Vormerkung konnte nicht gespeichert werden (IndexedDB). */
export class LocalSaveError extends Error {
  constructor(public readonly reason: unknown) {
    super("Vormerkung konnte nicht gespeichert werden");
    this.name = "LocalSaveError";
  }
}

/** Die Vormerkung war nicht lesbar (IndexedDB). */
export class LocalReadError extends Error {
  constructor(public readonly reason: unknown) {
    super("Vormerkung nicht lesbar");
    this.name = "LocalReadError";
  }
}

/** Ohne angemeldeten Nutzer (`sub`) wird nichts vorgemerkt. */
export class NotSignedInError extends Error {
  constructor() {
    super("Kein angemeldeter Nutzer");
    this.name = "NotSignedInError";
  }
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
// `DELETE` eines vorgemerkten Rezepts läuft: Listenabrufe blenden es aus.
const deleting = new Set<string>();
// Rezept, dessen Übertragung gerade läuft: Seine Löschmarkierung entfernt
// erst die Übertragung (sie kann es nach einem 404 noch anlegen).
let transferring: string | null = null;

/** Einträge des angemeldeten Nutzers; wirft bei Lese- oder Sitzungsfehler. */
async function ownEntries(): Promise<PendingCreate[]> {
  const sub = await currentUserSub();
  const entries = await locked(readPendingCreates);
  return entries.filter((e) => sameUser(e.sub, sub));
}

export interface PendingState {
  /** Vorgemerkte Rezepte (auch abgelehnte, sie bleiben sichtbar) */
  pending: PendingCreate[];
  /** Gelöschte, deren `DELETE` aussteht: im Listenabruf ausblenden */
  deleted: Set<string>;
}

/**
 * Stand der Vormerkung des angemeldeten Nutzers. Ein Lese- oder
 * Sitzungsfehler ergibt eine leere Vormerkung, ohne zu schreiben.
 */
export async function readPending(): Promise<PendingState> {
  let entries: PendingCreate[] = [];
  try {
    entries = await ownEntries();
  } catch {
    // leer lassen
  }
  // Nach dem Lesen auswerten: Eine Löschung kann währenddessen begonnen haben
  const deleted = new Set([...removing, ...deleting]);
  for (const e of entries) {
    if (e.deleted) deleted.add(e.recipe.recipe_uuid);
  }
  return {
    pending: entries.filter((e) => !deleted.has(e.recipe.recipe_uuid)),
    deleted,
  };
}

/** Vorgemerkte Rezepte des angemeldeten Nutzers (siehe `readPending`). */
export async function listPending(): Promise<PendingCreate[]> {
  return (await readPending()).pending;
}

/**
 * Rezept für den angemeldeten Nutzer vormerken (ersetzt einen Eintrag mit
 * derselben ID). Wirft `NotSignedInError` ohne `sub` und `LocalSaveError`,
 * wenn die Sitzung nicht lesbar ist oder die IndexedDB scheitert.
 */
export async function addPending(recipe: Recipe): Promise<void> {
  const copy = deepCopyJSON(recipe);
  let sub: string | null;
  try {
    sub = await currentUserSub();
  } catch (e) {
    throw new LocalSaveError(e);
  }
  if (!sub) throw new NotSignedInError();
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
    if (!entry || entry.deleted) return false;
    entry.recipe = copy;
    delete entry.rejected;
    await writePendingCreates(entries);
    return true;
  });
}

/**
 * Vorgemerktes Rezept löschen. Der Server kann es schon haben (verlorene
 * Antwort, laufende Übertragung), deshalb bleibt die Löschung vorgemerkt
 * (`marked`), bis `deleteOnServer` sie bestätigt; Listenabrufe blenden das
 * Rezept so lange aus. Ein abgelehntes Rezept hat der Server nicht (bzw. bei
 * fremdem 409 gehört es einem anderen): sofort entfernen (`removed`).
 * `none`: nicht vorgemerkt. Wirft bei IndexedDB-Fehlern.
 */
export function markDeleted(
  uuid: string,
): Promise<"none" | "removed" | "marked"> {
  removing.add(uuid);
  return locked(async () => {
    const entries = await readPendingCreates();
    const entry = entries.find((e) => e.recipe.recipe_uuid === uuid);
    if (!entry) return "none" as const;
    if (entry.deleted) return "marked" as const;
    if (entry.rejected !== undefined) {
      await writePendingCreates(entries.filter((e) => e !== entry));
      return "removed" as const;
    }
    entry.deleted = true;
    await writePendingCreates(entries);
    return "marked" as const;
  }).finally(() => removing.delete(uuid));
}

/** Eintrag endgültig entfernen. */
function dropEntry(uuid: string): Promise<void> {
  return locked(async () => {
    const entries = await readPendingCreates();
    const rest = entries.filter((e) => e.recipe.recipe_uuid !== uuid);
    if (rest.length !== entries.length) await writePendingCreates(rest);
  });
}

/**
 * Vorgemerkte Löschung an den Server senden (nur mit gültiger Sitzung).
 * Bestätigt (204, 404) oder endgültig abgelehnt (übrige 4xx): Markierung
 * entfernen, `true`. Ausfall (offline, Timeout, 5xx, 401): bleibt
 * vorgemerkt, die nächste Übertragung sendet erneut, `false`. Läuft gerade
 * die Übertragung dieses Rezepts, entfernt erst sie die Markierung.
 */
export async function deleteOnServer(
  uuid: string,
  { fromTransfer = false } = {},
): Promise<boolean> {
  deleting.add(uuid);
  try {
    try {
      await recipeApi.delete(uuid);
    } catch (e) {
      if (!isClientError(e)) {
        console.warn("Delete of pending recipe failed, will retry", e);
        return false;
      }
      if (!(e instanceof ApiError && e.status === 404)) {
        console.warn("Delete of pending recipe rejected", e);
      }
    }
    // Abrufe, die vor der Bestätigung begannen, zeigen es nicht wieder
    noteDeleted(uuid);
    if (fromTransfer || transferring !== uuid) {
      try {
        await dropEntry(uuid);
      } catch (e) {
        // Markierung bleibt: nächste Übertragung, `DELETE` → 404, entfernt
        console.warn("Pending deletion not cleared", e);
      }
    }
    return true;
  } finally {
    deleting.delete(uuid);
  }
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
 * `sent` ist erledigt: Der Server hat ihn, oder sein PUT wurde abgelehnt
 * (eine Wiederholung desselben Stands hülfe nicht). Ist der vorgemerkte
 * Stand unverändert, Eintrag entfernen (`done`); wurde er inzwischen
 * bearbeitet, den neueren Stand liefern (bleibt vorgemerkt); `deleted`, wenn
 * er inzwischen gelöscht wurde.
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
    if (!entry || entry.deleted) return { status: "deleted" as const };
    if (!isEqualPlain(entry.recipe, sent)) {
      return { status: "changed" as const, recipe: entry.recipe };
    }
    await writePendingCreates(entries.filter((e) => e !== entry));
    return { status: "done" as const };
  });
}

// --- Anlegen mit Client-ID ---

/**
 * `created` mit `updateError`: Das Rezept existiert auf dem Server, aber der
 * nachgeschobene PUT des neueren Stands wurde abgelehnt (`detail` ist der
 * Serverstand ohne die letzte Änderung).
 */
export type CreateOutcome =
  | { status: "created"; detail: RecipeDetail; updateError?: unknown }
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
 * Lehnt das Backend den PUT ab, ist das Rezept trotzdem angelegt
 * (`created` mit `updateError`). Ausfälle (offline, Timeout, 5xx, 401) wirft
 * die Funktion weiter.
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
    if (!sameUser(existing.created_by, await currentUserSub())) {
      return { status: "rejected", error: e };
    }
    // JSON-Kopien: `undefined`-Felder zählen nicht als Unterschied
    const unchanged = isEqualPlain(
      deepCopyJSON(recipeToPayload(detailToRecipe(existing))),
      deepCopyJSON(recipeToPayload(recipe)),
    );
    if (unchanged) return { status: "created", detail: existing };
    const updated = await pushUpdate(recipe);
    return updated.status === "rejected"
      ? { status: "created", detail: existing, updateError: updated.error }
      : updated;
  }
}

// --- Übertragung ---

export interface TransferReport {
  /** Übertragene Rezepte */
  transferred: number;
  /** In diesem Lauf abgelehnt (vorgemerkt, nicht automatisch wiederholt) */
  rejected: { recipe_name: string; error: unknown }[];
  /**
   * Angelegt (in `transferred` mitgezählt), aber der PUT der letzten
   * Änderung wurde abgelehnt; die Änderung ist verworfen.
   */
  updateRejected: { recipe_name: string; error: unknown }[];
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
  const report: TransferReport = {
    transferred: 0,
    rejected: [],
    updateRejected: [],
  };
  let entries: PendingCreate[];
  try {
    entries = await ownEntries();
  } catch (e) {
    console.warn("Pending recipes not readable", e);
    return report;
  }
  try {
    // Erst vorgemerkte Löschungen, dann Anlagen
    for (const entry of entries.filter((e) => e.deleted)) {
      if (!(await finishDeletion(entry))) {
        throw new Error("Löschen nicht bestätigt");
      }
    }
    const open = entries.filter(
      (e) =>
        !e.deleted &&
        e.rejected === undefined &&
        !removing.has(e.recipe.recipe_uuid),
    );
    for (const { recipe } of open) {
      transferring = recipe.recipe_uuid;
      const outcome = await transferOne(recipe, onCreated).finally(() => {
        transferring = null;
      });
      if (outcome === "skipped") continue;
      if (outcome === "transferred") {
        report.transferred++;
      } else if (outcome.kind === "updateRejected") {
        report.transferred++;
        report.updateRejected.push(outcome.item);
      } else {
        report.rejected.push(outcome.item);
      }
    }
  } catch (e) {
    console.warn("Transfer of pending recipes interrupted", e);
  }
  return report;
}

type TransferItem = TransferReport["rejected"][number];

/** Vorgemerkte Löschung abschließen; `false` bei Ausfall. */
async function finishDeletion(entry: PendingCreate): Promise<boolean> {
  const uuid = entry.recipe.recipe_uuid;
  // Abgelehnt (auch während der Löschung): Der Server hat es nicht
  if (entry.rejected !== undefined) {
    await dropEntry(uuid);
    return true;
  }
  return deleteOnServer(uuid, { fromTransfer: true });
}

/** Ein Rezept übertragen; wirft bei Ausfall (Netz, Server, IndexedDB). */
async function transferOne(
  recipe: Recipe,
  onCreated: (detail: RecipeDetail) => void,
): Promise<
  | "transferred"
  | "skipped"
  | { kind: "rejected" | "updateRejected"; item: TransferItem }
> {
  let sent = recipe;
  const created = await createWithClientId(sent);
  if (created.status === "rejected") {
    const status =
      created.error instanceof ApiError ? created.error.status : 400;
    await markRejected(recipe.recipe_uuid, status);
    return {
      kind: "rejected",
      item: { recipe_name: sent.recipe_name, error: created.error },
    };
  }
  // Ab hier existiert das Rezept auf dem Server
  let { detail, updateError } = created;
  for (let updates = 0; ; updates++) {
    // Nach abgelehntem PUT ohne neuere Bearbeitung: nicht vorgemerkt lassen
    const settled = await settle(sent);
    if (settled.status === "done") {
      onCreated(detail);
      if (updateError === undefined) return "transferred";
      return {
        kind: "updateRejected",
        item: { recipe_name: sent.recipe_name, error: updateError },
      };
    }
    if (settled.status === "deleted") {
      // Während der Anfrage gelöscht: Der Server hat es trotzdem angelegt.
      // Ausfall: Die Löschung bleibt vorgemerkt, der Lauf endet.
      if (!(await deleteOnServer(recipe.recipe_uuid, { fromTransfer: true }))) {
        throw new Error("Löschen nach Übertragung nicht bestätigt");
      }
      return "skipped";
    }
    // Während der Anfrage bearbeitet: neueren Stand nachschieben; bleibt
    // vorgemerkt, bis der PUT gelingt oder abgelehnt ist
    if (updates >= MAX_UPDATES) return "skipped";
    sent = settled.recipe;
    const updated = await pushUpdate(sent);
    if (updated.status === "rejected") updateError = updated.error;
    else ({ detail, updateError } = updated);
  }
}
