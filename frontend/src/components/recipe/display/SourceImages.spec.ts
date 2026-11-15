import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@/api/images", () => ({
  imageApi: {
    list: vi.fn(),
    imageUrl: (id: string) => `/api/v1/images/${id}`,
    thumbnailUrl: (id: string) => `/api/v1/images/${id}/thumbnail`,
  },
}));

import { imageApi, type ImageInfo } from "@/api/images";
import SourceImages from "./SourceImages.vue";

const source = (id: string, sort_order: number) =>
  ({ id, sort_order, kind: "source" }) as ImageInfo;

describe("SourceImages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("zeigt die Vorlagen zugeklappt in Reihenfolge, Link auf das große Bild", async () => {
    vi.mocked(imageApi.list).mockResolvedValue([
      source("s1", 0),
      source("s2", 1),
    ]);
    const w = mount(SourceImages, { props: { recipeId: "r1" } });
    await flushPromises();

    expect(imageApi.list).toHaveBeenCalledWith("r1", "source");
    const details = w.find("details");
    expect(details.attributes("open")).toBeUndefined();
    expect(details.find("summary").text()).toContain("Vorlage (2 Seiten)");
    expect(w.findAll("a").map((a) => a.attributes("href"))).toEqual([
      "/api/v1/images/s1",
      "/api/v1/images/s2",
    ]);
    expect(w.findAll("img").map((i) => i.attributes("src"))).toEqual([
      "/api/v1/images/s1/thumbnail",
      "/api/v1/images/s2/thumbnail",
    ]);
  });

  it("bleibt ohne Vorlagen unsichtbar", async () => {
    vi.mocked(imageApi.list).mockResolvedValue([]);
    const w = mount(SourceImages, { props: { recipeId: "r1" } });
    await flushPromises();
    expect(w.find("details").exists()).toBe(false);
  });

  it("bleibt unsichtbar, wenn die Liste nicht ladbar ist (offline, lokales Rezept)", async () => {
    vi.mocked(imageApi.list).mockRejectedValue(new Error("404"));
    const w = mount(SourceImages, { props: { recipeId: "lokal" } });
    await flushPromises();
    expect(w.find("details").exists()).toBe(false);
  });

  it("lädt beim Rezeptwechsel neu", async () => {
    vi.mocked(imageApi.list)
      .mockResolvedValueOnce([source("s1", 0)])
      .mockResolvedValueOnce([]);
    const w = mount(SourceImages, { props: { recipeId: "r1" } });
    await flushPromises();
    await w.setProps({ recipeId: "r2" });
    await flushPromises();
    expect(imageApi.list).toHaveBeenLastCalledWith("r2", "source");
    expect(w.find("details").exists()).toBe(false);
  });
});
