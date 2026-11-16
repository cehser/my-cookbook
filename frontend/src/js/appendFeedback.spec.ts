import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/client";
import type { RecipeDetail } from "@/api/recipes";
import type { Recipe } from "@/types/recipe";
import {
  appendedId,
  appendFailedMessage,
  appendToast,
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

  it("Sitzung abgelaufen: „Bitte neu anmelden“", () => {
    expect(appendFailedMessage(new ApiError(401, ""))).toBe(
      "Rezept nicht angelegt: Bitte neu anmelden.",
    );
  });

  it("Übertragung: Erfolg gesammelt, Ablehnung je Rezept", () => {
    expect(transferToasts({ transferred: 0, rejected: [] })).toEqual([]);
    expect(transferToasts({ transferred: 1, rejected: [] })).toEqual([
      { message: "1 Rezept übertragen.", variant: "success" },
    ]);
    const toasts = transferToasts({
      transferred: 2,
      rejected: [{ recipe_name: "Kuchen", error: new ApiError(403, "") }],
    });
    expect(toasts[0].message).toBe("2 Rezepte übertragen.");
    expect(toasts[1].variant).toBe("warning");
    expect(toasts[1].message).toContain(
      "Rezept „Kuchen“ nicht übertragen: keine Berechtigung.",
    );
  });
});
