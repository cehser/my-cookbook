import { describe, expect, it } from "vitest";
import {
  detailToRecipe,
  listItemToRecipe,
  looksLikeListRow,
  recipeToPayload,
  withoutListOnly,
} from "@/js/recipeMapping";
import type { RecipeDetail, RecipeListItem } from "@/api/recipes";

const listItem: RecipeListItem = {
  id: "r1",
  recipe_name: "Pfannkuchen",
  author: "Oma",
  subtitle: "dünn",
  tags: ["süß"],
  imageurl: "https://example.org/p.jpg",
  first_image_id: "img1",
  updated_at: "2026-01-01T00:00:00Z",
  created_by: "u1",
};

const detail: RecipeDetail = {
  id: "r1",
  recipe_name: "Pfannkuchen",
  data: {
    ingredients: [{ name: "Mehl", amounts: [], section: "" }],
    steps: [{ step: "Rühren", section: "" }],
    sections: [{ section: "" }],
    author: "Oma",
    first_image_id: "veraltet",
  },
  tags: ["süß"],
  first_image_id: "img1",
  created_by: "u1",
  updated_by: "u2",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
};

describe("listItemToRecipe", () => {
  it("übernimmt Kopfdaten und setzt leere Listen", () => {
    expect(listItemToRecipe(listItem)).toEqual({
      listOnly: true,
      recipe_uuid: "r1",
      recipe_name: "Pfannkuchen",
      author: "Oma",
      subtitle: "dünn",
      tags: ["süß"],
      imageurl: "https://example.org/p.jpg",
      first_image_id: "img1",
      created_by: "u1",
      lastUpdated: "2026-01-01T00:00:00Z",
      ingredients: [],
      steps: [],
      sections: [],
    });
  });

  it("macht null zu undefined", () => {
    const r = listItemToRecipe({
      ...listItem,
      author: null,
      subtitle: null,
      imageurl: null,
      first_image_id: null,
    });
    expect(r.author).toBeUndefined();
    expect(r.subtitle).toBeUndefined();
    expect(r.imageurl).toBeUndefined();
    expect(r.first_image_id).toBeUndefined();
  });
});

describe("Kennzeichen listOnly", () => {
  it("nie im Payload, auch nicht aus der Listenzeile", () => {
    const payload = recipeToPayload(listItemToRecipe(listItem));
    expect(payload).not.toHaveProperty("listOnly");
    expect(payload.data).not.toHaveProperty("listOnly");
    expect(JSON.stringify(payload)).not.toContain("listOnly");
  });

  it("Detail ist nie gekennzeichnet, auch wenn data es enthielte", () => {
    const r = detailToRecipe({
      ...detail,
      data: { ...detail.data, listOnly: true },
    });
    expect(r).not.toHaveProperty("listOnly");
  });

  it("withoutListOnly entfernt es, ohne das Original zu ändern", () => {
    const row = listItemToRecipe(listItem);
    const plain = withoutListOnly(row);
    expect(plain).not.toHaveProperty("listOnly");
    expect(row.listOnly).toBe(true);
    const full = detailToRecipe(detail);
    expect(withoutListOnly(full)).toBe(full);
  });

  it("looksLikeListRow: ohne Zutaten und Schritte", () => {
    const row = withoutListOnly(listItemToRecipe(listItem));
    expect(looksLikeListRow(row)).toBe(true);
    expect(looksLikeListRow(detailToRecipe(detail))).toBe(false);
  });
});

describe("detailToRecipe", () => {
  it("übernimmt Kopfdaten und entpackt data", () => {
    const r = detailToRecipe(detail);
    expect(r.recipe_uuid).toBe("r1");
    expect(r.recipe_name).toBe("Pfannkuchen");
    expect(r.lastUpdated).toBe("2026-02-01T00:00:00Z");
    expect(r.tags).toEqual(["süß"]);
    expect(r.author).toBe("Oma");
    expect(r.ingredients).toHaveLength(1);
    expect(r.steps).toHaveLength(1);
  });

  it("created_by aus der Antwort, nicht aus data, nie im Payload", () => {
    const r = detailToRecipe({
      ...detail,
      data: { ...detail.data, created_by: "aus-data" },
    });
    expect(r.created_by).toBe("u1");
    expect(recipeToPayload(r).data).not.toHaveProperty("created_by");
    expect(recipeToPayload(listItemToRecipe(listItem)).data).not.toHaveProperty(
      "created_by",
    );
  });

  it("nimmt first_image_id aus der Antwort, nicht aus data", () => {
    expect(detailToRecipe(detail).first_image_id).toBe("img1");
    expect(
      detailToRecipe({ ...detail, first_image_id: null }).first_image_id,
    ).toBeUndefined();
  });

  it("füllt fehlende Listen mit Standardwerten", () => {
    const r = detailToRecipe({ ...detail, data: {} });
    expect(r.ingredients).toEqual([]);
    expect(r.steps).toEqual([]);
    expect(r.sections).toEqual([]);
  });

  it("data überschreibt die Standardwerte, auch tags", () => {
    const r = detailToRecipe({ ...detail, data: { tags: ["aus-data"] } });
    expect(r.tags).toEqual(["aus-data"]);
  });

  it("verträgt data = null", () => {
    const r = detailToRecipe({
      ...detail,
      data: null as unknown as Record<string, unknown>,
    });
    expect(r.recipe_uuid).toBe("r1");
    expect(r.ingredients).toEqual([]);
  });
});
