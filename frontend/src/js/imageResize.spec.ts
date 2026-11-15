import { describe, expect, it } from "vitest";
import { computeTargetSize, MAX_EDGE_PX, THUMB_EDGE_PX } from "./imageResize";

describe("computeTargetSize", () => {
  it("verkleinert Querformat auf die lange Kante", () => {
    expect(computeTargetSize(4000, 3000)).toEqual({
      width: MAX_EDGE_PX,
      height: 1500,
    });
  });

  it("verkleinert Hochformat auf die lange Kante", () => {
    expect(computeTargetSize(3024, 4032)).toEqual({
      width: 1500,
      height: 2000,
    });
  });

  it("vergrößert nie", () => {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(computeTargetSize(MAX_EDGE_PX, 10)).toEqual({
      width: MAX_EDGE_PX,
      height: 10,
    });
  });

  it("nutzt die übergebene Grenze (Vorschaubild)", () => {
    expect(computeTargetSize(4000, 3000, THUMB_EDGE_PX)).toEqual({
      width: 320,
      height: 240,
    });
  });

  it("hält extreme Seitenverhältnisse bei mindestens 1 px", () => {
    expect(computeTargetSize(10_000, 1)).toEqual({
      width: MAX_EDGE_PX,
      height: 1,
    });
  });
});
