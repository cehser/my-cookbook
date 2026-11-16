import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/client";
import type { RecipeDetail } from "@/api/recipes";
import type { Recipe } from "@/types/recipe";
import {
  appendedId,
  appendFailedMessage,
  appendToast,
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

  it("local: Warnung „nur auf diesem Gerät“, lokale UUID", () => {
    const toast = appendToast({ status: "local" }, "Angelegt.");
    expect(toast.variant).toBe("warning");
    expect(toast.message).toContain("Nur auf diesem Gerät gespeichert");
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
    expect(appendFailedMessage(new ApiError(409, ""))).toContain("Fehler 409");
  });
});
