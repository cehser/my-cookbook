import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import { deepCopyJSON } from "@/js/deepCopy";

describe("deepCopyJSON", () => {
  it("kopiert verschachtelte Daten tief", () => {
    const src = { a: [1, { b: "x" }], c: null };
    const copy = deepCopyJSON(src);
    expect(copy).toEqual(src);
    expect(copy).not.toBe(src);
    expect(copy.a).not.toBe(src.a);
    (copy.a[1] as { b: string }).b = "y";
    expect((src.a[1] as { b: string }).b).toBe("x");
  });

  it("liest durch reaktive Proxies und liefert ein einfaches Objekt", () => {
    const src = reactive({ list: [{ n: 1 }] });
    const copy = deepCopyJSON(src);
    expect(copy).toEqual({ list: [{ n: 1 }] });
    expect(() => structuredClone(src)).toThrow();
    expect(() => structuredClone(copy)).not.toThrow();
  });

  it("verwirft undefined-Werte und Funktionen", () => {
    const copy = deepCopyJSON({ a: undefined, b: 1, f: () => 1 });
    expect(copy).toEqual({ b: 1 });
    expect("a" in copy).toBe(false);
  });

  it("wandelt Date in String (bekannte Grenze)", () => {
    const d = new Date("2026-01-02T03:04:05.000Z");
    expect(deepCopyJSON({ d })).toEqual({ d: d.toISOString() });
  });
});
