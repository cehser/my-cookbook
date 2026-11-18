import { describe, expect, it } from "vitest";
import { ApiError, OfflineError } from "@/api/client";
import type { RecipeDetail } from "@/api/recipes";
import { IncompleteRecipeError } from "@/js/recipeMapping";
import { LocalReadError, NotSignedInError } from "@/store/pendingCreates";
import type { Recipe } from "@/types/recipe";
import {
  appendedId,
  appendFailedMessage,
  appendToast,
  deleteFailedMessage,
  saveFailedMessage,
  transferToasts,
} from "@/js/appendFeedback";

const recipe = { recipe_uuid: "lokal-1" } as Recipe;
const created = {
  status: "created",
  detail: { id: "srv-1" } as RecipeDetail,
} as const;

describe("appendFeedback", () => {
  it("created: Erfolg, Backend-ID", () => {
    expect(appendToast(created, "Angelegt.")).toEqual({
      message: "Angelegt.",
      variant: "success",
    });
    expect(appendedId(created, recipe)).toBe("srv-1");
  });

  it("local: Warnung „wird übertragen“, lokale UUID", () => {
    const toast = appendToast({ status: "local" }, "Angelegt.");
    expect(toast.variant).toBe("warning");
    expect(toast.message).toBe(
      "Angelegt. Auf diesem Gerät gespeichert, wird beim nächsten Online-Start übertragen.",
    );
    expect(appendedId({ status: "local" }, recipe)).toBe("lokal-1");
  });

  it("failed: Fehler je Status, keine ID", () => {
    const failed = { status: "failed", error: new ApiError(422, "x") } as const;
    expect(appendToast(failed, "Angelegt.")).toEqual({
      message: "Rezept nicht angelegt: Rezeptdaten ungültig.",
      variant: "danger",
    });
    expect(appendedId(failed, recipe)).toBeNull();
    expect(appendFailedMessage(new ApiError(403, ""))).toContain(
      "keine Berechtigung",
    );
    expect(appendFailedMessage(new ApiError(409, ""))).toContain(
      "ID bereits vergeben",
    );
    expect(appendFailedMessage(new ApiError(400, ""))).toContain("Fehler 400");
  });

  it("Speichern einer Listenzeile: eigener Text", () => {
    expect(saveFailedMessage(new IncompleteRecipeError())).toBe(
      "Rezept nicht gespeichert: Es ist nur unvollständig geladen " +
        "(ohne Zutaten und Schritte). Bitte neu laden und erneut bearbeiten.",
    );
  });

  it("422 mit Klartext-detail: Grund vom Server", () => {
    const body = JSON.stringify({
      detail:
        "Zutaten und Schritte würden geleert, Rezept unverändert. " +
        "Bitte neu laden oder, falls gewollt, das Rezept löschen",
    });
    expect(saveFailedMessage(new ApiError(422, body))).toBe(
      "Rezept nicht gespeichert: Zutaten und Schritte würden geleert, " +
        "Rezept unverändert. Bitte neu laden oder, falls gewollt, das Rezept löschen.",
    );
    // Validierungsfehler (detail als Liste) und kein JSON: allgemeiner Text
    const validation = JSON.stringify({ detail: [{ msg: "x" }] });
    expect(saveFailedMessage(new ApiError(422, validation))).toBe(
      "Rezept nicht gespeichert: Rezeptdaten ungültig.",
    );
    expect(saveFailedMessage(new ApiError(422, "Unprocessable"))).toBe(
      "Rezept nicht gespeichert: Rezeptdaten ungültig.",
    );
  });

  it("Sitzung abgelaufen: „Bitte neu anmelden“", () => {
    expect(appendFailedMessage(new ApiError(401, ""))).toBe(
      "Rezept nicht angelegt: Bitte neu anmelden.",
    );
  });

  it("Übertragung: Erfolg gesammelt, Ablehnung je Rezept", () => {
    const none = { rejected: [], updateRejected: [] };
    expect(transferToasts({ transferred: 0, ...none })).toEqual([]);
    expect(transferToasts({ transferred: 1, ...none })).toEqual([
      { message: "1 Rezept übertragen.", variant: "success" },
    ]);
    const toasts = transferToasts({
      transferred: 2,
      rejected: [{ recipe_name: "Kuchen", error: new ApiError(403, "") }],
      updateRejected: [],
    });
    expect(toasts[0].message).toBe("2 Rezepte übertragen.");
    expect(toasts[1].variant).toBe("warning");
    expect(toasts[1].message).toContain(
      "Rezept „Kuchen“ nicht übertragen: keine Berechtigung.",
    );
  });

  it("ohne angemeldeten Nutzer: „Bitte anmelden“", () => {
    expect(appendFailedMessage(new NotSignedInError())).toBe(
      "Rezept nicht angelegt: Bitte anmelden.",
    );
  });

  it("angelegt, letzte Änderung abgelehnt: Warnung statt „nicht angelegt“", () => {
    const toast = appendToast(
      { ...created, updateError: new ApiError(422, "") },
      "Angelegt.",
    );
    expect(toast).toEqual({
      message:
        "Rezept angelegt, letzte Änderung nicht übertragen: Rezeptdaten ungültig.",
      variant: "warning",
    });
    const toasts = transferToasts({
      transferred: 1,
      rejected: [],
      updateRejected: [{ recipe_name: "Kuchen", error: new ApiError(403, "") }],
    });
    expect(toasts.map((t) => t.message)).toEqual([
      "1 Rezept übertragen.",
      "Rezept „Kuchen“ angelegt, letzte Änderung nicht übertragen: keine Berechtigung.",
    ]);
  });

  it("Löschen gescheitert: Grund je Fehlerart", () => {
    expect(deleteFailedMessage(new ApiError(403, ""))).toBe(
      "Rezept nicht gelöscht: keine Berechtigung.",
    );
    expect(deleteFailedMessage(new OfflineError())).toBe(
      "Rezept nicht gelöscht: keine Verbindung zum Server.",
    );
    expect(deleteFailedMessage(new TypeError("Failed to fetch"))).toBe(
      "Rezept nicht gelöscht: keine Verbindung zum Server.",
    );
    expect(deleteFailedMessage(new LocalReadError(new Error("idb")))).toBe(
      "Rezept nicht gelöscht: auf diesem Gerät nicht lesbar.",
    );
  });

  it("Speichern gescheitert: Grund statt allgemeiner Meldung", () => {
    expect(saveFailedMessage(new LocalReadError(new Error("idb")))).toBe(
      "Rezept nicht gespeichert: auf diesem Gerät nicht lesbar.",
    );
  });
});
