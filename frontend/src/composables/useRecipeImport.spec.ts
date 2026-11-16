import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ appendRecipe: vi.fn() }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/api/images", () => ({ imageApi: { upload: vi.fn() } }));

import { imageApi } from "@/api/images";
import { ApiError } from "@/api/client";
import { useImportPages } from "@/composables/useImportPages";
import { useRecipeImport } from "@/composables/useRecipeImport";
import type { Recipe } from "@/types/recipe";

const page = (text: string) => new Blob([text], { type: "image/jpeg" });
const recipe = () =>
  ({ recipe_uuid: "lokal-1", recipe_name: "Apfelkuchen" }) as Recipe;
const created = (id: string) => ({ status: "created", detail: { id } });

/** Zwei Seiten im Seitenzustand (Modulebene, vor jedem Test geleert). */
function twoPages() {
  const blobs = [page("1"), page("2")];
  blobs.forEach((b) => useImportPages().addPage(b, page("t")));
  return blobs;
}

describe("useRecipeImport", () => {
  const onImported = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useImportPages().clearPages();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("Foto-Weg: legt an, lädt die Seiten in Reihenfolge hoch, setzt zurück, navigiert", async () => {
    const blobs = twoPages();
    store.appendRecipe.mockResolvedValue(created("srv-1"));
    vi.mocked(imageApi.upload).mockResolvedValue({} as never);
    const order: string[] = [];
    onImported.mockImplementation(() => order.push("imported"));
    push.mockImplementation(async () => order.push("push"));
    const { importRecipe, importing } = useRecipeImport({ onImported });

    expect(await importRecipe(recipe(), "images")).toBeNull();

    expect(vi.mocked(imageApi.upload).mock.calls).toEqual([
      ["srv-1", blobs[0], "source"],
      ["srv-1", blobs[1], "source"],
    ]);
    expect(onImported).toHaveBeenCalledWith(expect.anything(), []);
    expect(useImportPages().pages.value).toEqual([]);
    expect(push).toHaveBeenCalledWith("/edit/srv-1/apfelkuchen");
    expect(order).toEqual(["imported", "push"]);
    expect(importing.value).toBe(false);
  });

  it("Upload-Fehler einzelner Seiten wird gemeldet, das Rezept bleibt", async () => {
    twoPages();
    store.appendRecipe.mockResolvedValue(created("srv-2"));
    vi.mocked(imageApi.upload)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("413"));
    const { importRecipe } = useRecipeImport({ onImported });

    expect(await importRecipe(recipe(), "images")).toBeNull();

    expect(imageApi.upload).toHaveBeenCalledTimes(2);
    expect(onImported).toHaveBeenCalledWith(expect.anything(), [
      "Vorlage: Seite 2 von 2 konnte nicht gespeichert werden.",
    ]);
    expect(push).toHaveBeenCalledWith("/edit/srv-2/apfelkuchen");
  });

  it("local: kein Upload, Hinweis „wird übertragen“, Navigation mit lokaler UUID", async () => {
    twoPages();
    store.appendRecipe.mockResolvedValue({ status: "local" });
    const { importRecipe } = useRecipeImport({ onImported });

    expect(await importRecipe(recipe(), "images")).toBeNull();

    expect(imageApi.upload).not.toHaveBeenCalled();
    const warnings = onImported.mock.calls[0][1] as string[];
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("wird beim nächsten Online-Start übertragen");
    expect(warnings[0]).toContain("Vorlage wurde nicht gespeichert");
    expect(push).toHaveBeenCalledWith("/edit/lokal-1/apfelkuchen");
  });

  it("failed: Meldung, keine Navigation, Seiten bleiben erhalten", async () => {
    twoPages();
    store.appendRecipe.mockResolvedValue({
      status: "failed",
      error: new ApiError(403, "forbidden"),
    });
    const { importRecipe, importing } = useRecipeImport({ onImported });

    expect(await importRecipe(recipe(), "images")).toBe(
      "Rezept nicht angelegt: keine Berechtigung.",
    );

    expect(imageApi.upload).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(useImportPages().pages.value).toHaveLength(2);
    expect(importing.value).toBe(false);
  });

  it("Text-Weg: keine Vorlage, auch wenn Seiten liegen", async () => {
    twoPages();
    store.appendRecipe.mockResolvedValue(created("srv-3"));
    const { importRecipe } = useRecipeImport({ onImported });

    await importRecipe(recipe(), "text");

    expect(imageApi.upload).not.toHaveBeenCalled();
    expect(onImported).toHaveBeenCalledWith(expect.anything(), []);
  });

  it("vergibt eine UUID, wenn das Rezept keine hat", async () => {
    store.appendRecipe.mockResolvedValue({ status: "local" });
    const { importRecipe } = useRecipeImport({ onImported });
    const r = { recipe_name: "Apfelkuchen" } as Recipe;

    await importRecipe(r, "text");

    expect(r.recipe_uuid).toBeTruthy();
    expect(push).toHaveBeenCalledWith(`/edit/${r.recipe_uuid}/apfelkuchen`);
  });
});
