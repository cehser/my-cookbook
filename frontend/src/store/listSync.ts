/**
 * Rezeptliste gegen parallel laufende Listenabrufe abgleichen.
 *
 * Eine Liste, deren Abruf vor dem Anlegen bzw. Löschen begann, kennt das neue
 * Rezept nicht bzw. enthält das gelöschte noch. `listSeq` zählt die Abrufe;
 * ein angelegtes Rezept bleibt vorgemerkt (`createdPending`), ein gelöschtes
 * bleibt ausgeblendet (`deletedRecently`, auch gegen eine gleichzeitig
 * laufende Übertragung), bis ein danach gestarteter Abruf fertig ist.
 */

import { looksLikeListRow } from "@/js/recipeMapping";
import type { Recipe } from "@/types/recipe";

let listSeq = 0;
let appliedListSeq = 0;
let createdPending: { seq: number; recipe: Recipe }[] = [];
let deletedRecently: { seq: number; uuid: string }[] = [];

/** Hängt die Rezepte aus `extra` an, deren ID in `recipes` noch fehlt. */
export function withPending(
  recipes: Recipe[],
  extra: readonly { recipe: Recipe }[],
): Recipe[] {
  const known = new Set(recipes.map((r) => r.recipe_uuid));
  const added = extra
    .map((e) => e.recipe)
    .filter((r) => !known.has(r.recipe_uuid));
  return added.length > 0 ? [...recipes, ...added] : recipes;
}

/**
 * Rezeptliste aus dem Cache: Listenzeilen wieder als `listOnly`
 * kennzeichnen (das Kennzeichen wird nicht gespeichert). Vorgemerkte Rezepte
 * sind vollständig und bleiben ungekennzeichnet.
 */
export function markListRows(
  recipes: Recipe[],
  pending: readonly { recipe: Recipe }[],
): Recipe[] {
  const pendingIds = new Set(pending.map((e) => e.recipe.recipe_uuid));
  return recipes.map((r) =>
    !pendingIds.has(r.recipe_uuid) && looksLikeListRow(r)
      ? { ...r, listOnly: true }
      : r,
  );
}

/** Vor dem Listenabruf aufrufen; das Ergebnis an `mergeFetched` geben. */
export function startListFetch(): number {
  return ++listSeq;
}

/** Vom Backend angelegtes Rezept bis zum nächsten Abruf festhalten. */
export function noteCreated(recipe: Recipe): void {
  createdPending.push({ seq: listSeq, recipe });
}

/** Gelöschtes Rezept bis zum nächsten Abruf ausblenden. */
export function noteDeleted(uuid: string): void {
  deletedRecently.push({ seq: listSeq, uuid });
  createdPending = createdPending.filter((c) => c.recipe.recipe_uuid !== uuid);
}

/**
 * Abgerufene Liste mit den seit Abrufbeginn angelegten und gelöschten
 * Rezepten abgleichen. `null`: Eine neuere Antwort ist schon übernommen,
 * diese ist veraltet.
 */
export function mergeFetched(seq: number, fromApi: Recipe[]): Recipe[] | null {
  if (seq < appliedListSeq) return null;
  appliedListSeq = seq;
  // Vor diesem Abruf Angelegtes bzw. Gelöschtes ist in der Antwort
  // berücksichtigt; während des Abrufs Geändertes womöglich nicht.
  createdPending = createdPending.filter((c) => c.seq >= seq);
  deletedRecently = deletedRecently.filter((d) => d.seq >= seq);
  const deleted = new Set(deletedRecently.map((d) => d.uuid));
  return withPending(
    fromApi.filter((r) => !deleted.has(r.recipe_uuid)),
    createdPending,
  );
}
