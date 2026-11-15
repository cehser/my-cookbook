import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImportPages } from "./useImportPages";

const blob = (text: string) => new Blob([text], { type: "image/jpeg" });

describe("useImportPages", () => {
  let created: number;
  const revoke = vi.fn();

  beforeEach(() => {
    // Modulzustand: vor jedem Test leeren, sonst hängen die Tests voneinander ab
    useImportPages().clearPages();
    created = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:test/${++created}`,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoke);
    revoke.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("hält Blobs in Reihenfolge und erzeugt Vorschau-URLs", () => {
    const { pages, addPage } = useImportPages();
    const a = blob("a");
    const b = blob("b");
    addPage(a, blob("ta"));
    addPage(b, blob("tb"));

    expect(pages.value.map((p) => p.blob)).toEqual([a, b]);
    expect(pages.value.map((p) => p.url)).toEqual([
      "blob:test/1",
      "blob:test/2",
    ]);
    expect(new Set(pages.value.map((p) => p.id)).size).toBe(2);
  });

  it("teilt den Zustand zwischen Aufrufen (überlebt Abbau der Komponente)", () => {
    useImportPages().addPage(blob("a"), blob("t"));
    expect(useImportPages().pages.value).toHaveLength(1);
  });

  it("entfernt eine Seite und gibt ihre URL frei", () => {
    const { pages, addPage, removePage } = useImportPages();
    addPage(blob("a"), blob("ta"));
    addPage(blob("b"), blob("tb"));
    const [first, second] = pages.value;

    removePage(first.id);

    expect(pages.value).toEqual([second]);
    expect(revoke).toHaveBeenCalledWith(first.url);
  });

  it("ignoriert unbekannte IDs", () => {
    const { pages, addPage, removePage } = useImportPages();
    addPage(blob("a"), blob("ta"));
    removePage(9999);
    expect(pages.value).toHaveLength(1);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("leert alle Seiten und gibt alle URLs frei", () => {
    const { pages, addPage, clearPages } = useImportPages();
    addPage(blob("a"), blob("ta"));
    addPage(blob("b"), blob("tb"));
    clearPages();
    expect(pages.value).toEqual([]);
    expect(revoke).toHaveBeenCalledTimes(2);
  });
});
