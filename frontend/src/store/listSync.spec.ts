import { describe, expect, it } from "vitest";
import type { Recipe } from "@/types/recipe";
import {
  mergeFetched,
  noteCreated,
  noteDeleted,
  startListFetch,
} from "@/store/listSync";

const r = (id: string) => ({ recipe_uuid: id }) as Recipe;
const ids = (list: Recipe[] | null) => list?.map((x) => x.recipe_uuid);

describe("listSync", () => {
  it("während des Abrufs Angelegtes bleibt, bis ein späterer Abruf endet", () => {
    const first = startListFetch();
    noteCreated(r("neu"));
    expect(ids(mergeFetched(first, [r("a")]))).toEqual(["a", "neu"]);
    const second = startListFetch();
    expect(ids(mergeFetched(second, [r("a")]))).toEqual(["a"]);
  });

  it("während des Abrufs Gelöschtes bleibt ausgeblendet", () => {
    const first = startListFetch();
    noteCreated(r("x"));
    noteDeleted("x");
    noteDeleted("a");
    expect(ids(mergeFetched(first, [r("a"), r("b")]))).toEqual(["b"]);
    const second = startListFetch();
    expect(ids(mergeFetched(second, [r("a")]))).toEqual(["a"]);
  });

  it("veraltete Antwort: null", () => {
    const older = startListFetch();
    const newer = startListFetch();
    expect(ids(mergeFetched(newer, [r("a")]))).toEqual(["a"]);
    expect(mergeFetched(older, [r("alt")])).toBeNull();
  });
});
