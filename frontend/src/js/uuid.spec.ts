import { afterEach, describe, expect, it, vi } from "vitest";
import { generateUUID } from "@/js/uuid";

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateUUID", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("nutzt crypto.randomUUID, wenn verfügbar", () => {
    const randomUUID = vi.fn(() => "11111111-1111-4111-8111-111111111111");
    vi.stubGlobal("crypto", { randomUUID });
    expect(generateUUID()).toBe("11111111-1111-4111-8111-111111111111");
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("ohne crypto.randomUUID: gültige v4-UUID aus dem Rückfall", () => {
    vi.stubGlobal("crypto", {});
    const a = generateUUID();
    expect(a).toMatch(V4);
    expect(generateUUID()).not.toBe(a);
  });
});
