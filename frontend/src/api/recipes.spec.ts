import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ api: { get: vi.fn() } }));

import { api } from "@/api/client";
import { recipeApi, type RecipeListItem } from "@/api/recipes";

const get = vi.mocked(api.get);

function item(id: string): RecipeListItem {
  return {
    id,
    recipe_name: id,
    author: null,
    subtitle: null,
    tags: [],
    imageurl: null,
    first_image_id: null,
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
  };
}

function items(from: number, count: number): RecipeListItem[] {
  return Array.from({ length: count }, (_, i) => item(`id${from + i}`));
}

describe("recipeApi.listAll", () => {
  beforeEach(() => get.mockReset());

  it("liefert bei leerer Liste eine leere Liste nach einem Aufruf", async () => {
    get.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 200 });
    expect(await recipeApi.listAll()).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/recipes?page=1&page_size=200");
  });

  it("lädt eine unvollständige Seite und stoppt", async () => {
    get.mockResolvedValueOnce({
      items: items(0, 3),
      total: 3,
      page: 1,
      page_size: 200,
    });
    expect(await recipeApi.listAll()).toHaveLength(3);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("lädt mehrere Seiten nacheinander", async () => {
    get
      .mockResolvedValueOnce({
        items: items(0, 200),
        total: 250,
        page: 1,
        page_size: 200,
      })
      .mockResolvedValueOnce({
        items: items(200, 50),
        total: 250,
        page: 2,
        page_size: 200,
      });
    const all = await recipeApi.listAll();
    expect(all).toHaveLength(250);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenNthCalledWith(2, "/recipes?page=2&page_size=200");
  });

  it("verwirft ein Duplikat an der Seitengrenze", async () => {
    get
      .mockResolvedValueOnce({
        items: items(0, 200),
        total: 250,
        page: 1,
        page_size: 200,
      })
      .mockResolvedValueOnce({
        items: [item("id199"), ...items(200, 49)],
        total: 250,
        page: 2,
        page_size: 200,
      });
    const all = await recipeApi.listAll();
    expect(all).toHaveLength(249);
    expect(new Set(all.map((r) => r.id)).size).toBe(249);
  });

  it("stoppt, wenn total kleiner ist als die gelieferte Menge", async () => {
    get.mockResolvedValueOnce({
      items: items(0, 200),
      total: 150,
      page: 1,
      page_size: 200,
    });
    expect(await recipeApi.listAll()).toHaveLength(200);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("stoppt bei genau einer vollen Seite mit total = 200", async () => {
    get.mockResolvedValueOnce({
      items: items(0, 200),
      total: 200,
      page: 1,
      page_size: 200,
    });
    expect(await recipeApi.listAll()).toHaveLength(200);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("reicht Fehler des Clients durch", async () => {
    get.mockRejectedValueOnce(new Error("netz"));
    await expect(recipeApi.listAll()).rejects.toThrow("netz");
  });
});
