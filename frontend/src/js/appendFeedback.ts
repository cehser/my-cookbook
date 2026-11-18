/**
 * Meldungen und Ziel-ID nach `recipeStore.appendRecipe` für alle Aufrufer,
 * dazu die Meldungen nach der Übertragung vorgemerkter Rezepte und nach
 * einem gescheiterten Löschen oder Speichern.
 */

import { ApiError, ApiTimeoutError, OfflineError } from "@/api/client";
import { IncompleteRecipeError } from "@/js/recipeMapping";
import type { AppendResult } from "@/store/recipeStore";
import {
  LocalReadError,
  LocalSaveError,
  NotSignedInError,
  type TransferReport,
} from "@/store/pendingCreates";
import type { Recipe } from "@/types/recipe";

/** Vorgemerkt: wird übertragen, sobald eine gültige Sitzung besteht. */
export const LOCAL_PENDING_TEXT =
  "Auf diesem Gerät gespeichert, wird beim nächsten Online-Start übertragen.";

/**
 * Klartext-`detail` einer Backend-Antwort (FastAPI: `{"detail": "…"}`), etwa
 * die 422 „Zutaten und Schritte würden geleert …“. Validierungsfehler haben
 * eine Liste als `detail` und ergeben `null`.
 */
function serverReason(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && "detail" in parsed) {
      const detail = (parsed as { detail: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) {
        return detail.trim().replace(/\.+$/, "");
      }
    }
  } catch {
    // kein JSON
  }
  return null;
}

/** Grund einer Ablehnung durch das Backend bzw. einer abgelaufenen Sitzung. */
function rejectReason(error: unknown): string {
  if (error instanceof LocalSaveError) {
    return "konnte auf diesem Gerät nicht gespeichert werden";
  }
  if (error instanceof LocalReadError) {
    return "auf diesem Gerät nicht lesbar";
  }
  if (error instanceof NotSignedInError) return "Bitte anmelden";
  if (error instanceof IncompleteRecipeError) {
    return "Rezept nicht vollständig geladen";
  }
  if (
    error instanceof OfflineError ||
    error instanceof ApiTimeoutError ||
    error instanceof TypeError
  ) {
    return "keine Verbindung zum Server";
  }
  if (!(error instanceof ApiError)) return "unbekannter Fehler";
  if (error.status === 401) return "Bitte neu anmelden";
  if (error.status === 403) return "keine Berechtigung";
  if (error.status === 409) return "ID bereits vergeben";
  if (error.status === 422)
    return serverReason(error.detail) ?? "Rezeptdaten ungültig";
  return `Fehler ${error.status}`;
}

/**
 * Fehlermeldung, wenn das Anlegen scheiterte (4xx, Sitzung abgelaufen,
 * Vormerkung nicht speicherbar).
 */
export function appendFailedMessage(error: unknown): string {
  return `Rezept nicht angelegt: ${rejectReason(error)}.`;
}

/** Angelegt, aber der PUT der letzten Änderung wurde abgelehnt. */
function updateRejectedMessage(error: unknown, name?: string): string {
  const what = name ? `Rezept „${name}“` : "Rezept";
  return `${what} angelegt, letzte Änderung nicht übertragen: ${rejectReason(error)}.`;
}

/** Fehlermeldung, wenn das Löschen scheiterte; das Rezept bleibt. */
export function deleteFailedMessage(error: unknown): string {
  return `Rezept nicht gelöscht: ${rejectReason(error)}.`;
}

/** Fehlermeldung, wenn `setRecipe` bzw. `setRecipeTags` scheiterte. */
export function saveFailedMessage(error: unknown): string {
  if (error instanceof IncompleteRecipeError) {
    return (
      "Rezept nicht gespeichert: Es ist nur unvollständig geladen " +
      "(ohne Zutaten und Schritte). Bitte neu laden und erneut bearbeiten."
    );
  }
  return `Rezept nicht gespeichert: ${rejectReason(error)}.`;
}

/**
 * Bearbeitung eines vorgemerkten Rezepts, das der Server als fremd abgelehnt
 * hat (`stillRejected`): bleibt nur auf diesem Gerät, wird nicht übertragen.
 */
export const LOCAL_REJECTED_TEXT =
  "Nur auf diesem Gerät gespeichert. Der Server hat das Rezept abgelehnt " +
  "(ID gehört einem anderen Rezept), es wird nicht übertragen.";

/** Toasts nach einer Übertragung: Erfolg gesammelt, Ablehnung je Rezept. */
export function transferToasts(
  report: TransferReport,
): { message: string; variant: "success" | "warning" }[] {
  const toasts: { message: string; variant: "success" | "warning" }[] = [];
  if (report.transferred > 0) {
    const n = report.transferred;
    toasts.push({
      message: n === 1 ? "1 Rezept übertragen." : `${n} Rezepte übertragen.`,
      variant: "success",
    });
  }
  for (const { recipe_name, error } of report.rejected) {
    toasts.push({
      message:
        `Rezept „${recipe_name}“ nicht übertragen: ${rejectReason(error)}. ` +
        "Es bleibt auf diesem Gerät; nach einer Bearbeitung wird es erneut versucht.",
      variant: "warning",
    });
  }
  for (const { recipe_name, error } of report.updateRejected) {
    toasts.push({
      message: updateRejectedMessage(error, recipe_name),
      variant: "warning",
    });
  }
  return toasts;
}

/** Toast zum Ergebnis: Erfolg, Hinweis „nur auf diesem Gerät“ oder Fehler. */
export function appendToast(
  result: AppendResult,
  successText: string,
): { message: string; variant: "success" | "warning" | "danger" } {
  switch (result.status) {
    case "created":
      if (result.updateError !== undefined) {
        return {
          message: updateRejectedMessage(result.updateError),
          variant: "warning",
        };
      }
      return { message: successText, variant: "success" };
    case "local":
      return {
        message: `${successText} ${LOCAL_PENDING_TEXT}`,
        variant: "warning",
      };
    case "failed":
      return { message: appendFailedMessage(result.error), variant: "danger" };
  }
}

/**
 * ID für Navigation und Upload: bei `created` die Backend-ID, sonst die
 * lokale UUID; bei `failed` `null` (nicht navigieren).
 */
export function appendedId(
  result: AppendResult,
  recipe: Recipe,
): string | null {
  if (result.status === "created") return result.detail.id;
  if (result.status === "local") return recipe.recipe_uuid;
  return null;
}
