import { describe, expect, it } from "vitest";
import { isEqualPlain } from "@/js/isEqualPlain";

describe("isEqualPlain", () => {
  it("vergleicht Primitive strikt", () => {
    expect(isEqualPlain(1, 1)).toBe(true);
    expect(isEqualPlain("a", "a")).toBe(true);
    expect(isEqualPlain(1, "1")).toBe(false);
    expect(isEqualPlain(0, false)).toBe(false);
    expect(isEqualPlain(null, undefined)).toBe(false);
    expect(isEqualPlain(null, null)).toBe(true);
  });

  it("vergleicht Objekte unabhängig von der Schlüsselreihenfolge", () => {
    expect(isEqualPlain({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(isEqualPlain({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(isEqualPlain({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it("unterscheidet fehlenden Schlüssel und undefined-Wert", () => {
    expect(isEqualPlain({ a: undefined }, { b: undefined })).toBe(false);
    expect(isEqualPlain({ a: undefined }, {})).toBe(false);
  });

  it("vergleicht Arrays nach Länge und Reihenfolge", () => {
    expect(isEqualPlain([1, 2], [1, 2])).toBe(true);
    expect(isEqualPlain([1, 2], [2, 1])).toBe(false);
    expect(isEqualPlain([1], [1, 2])).toBe(false);
    expect(isEqualPlain([], [])).toBe(true);
  });

  it("unterscheidet Array und Objekt", () => {
    expect(isEqualPlain([], {})).toBe(false);
    expect(isEqualPlain({ 0: "a" }, ["a"])).toBe(false);
  });

  it("vergleicht verschachtelt", () => {
    const a = { x: [{ y: [1, { z: "q" }] }] };
    const b = { x: [{ y: [1, { z: "q" }] }] };
    expect(isEqualPlain(a, b)).toBe(true);
    b.x[0].y[1] = { z: "r" };
    expect(isEqualPlain(a, b)).toBe(false);
  });
});
