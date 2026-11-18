import { describe, expect, it } from "vitest";
import { currentSectionOnly, effectiveSections } from "./recipeSections";

const sections = [
  { section: "Ragù" },
  { section: "Béchamel" },
  { section: "Schichten" },
];

describe("effectiveSections", () => {
  it("liefert nur Abschnitte mit Einträgen, in Rezeptreihenfolge", () => {
    const items = [{ section: "Schichten" }, { section: "Ragù" }];
    expect(effectiveSections(sections, items)).toEqual([
      { section: "Ragù" },
      { section: "Schichten" },
    ]);
  });

  it("stellt Einträge unbekannter Abschnitte als eigene Abschnitte voran", () => {
    const items = [{ section: "Béchamel" }, { section: "Deko" }, {}];
    expect(effectiveSections(sections, items)).toEqual([
      { section: "Deko" },
      { section: "" },
      { section: "Béchamel" },
    ]);
  });
});

describe("currentSectionOnly", () => {
  const all = sections;

  it("liefert genau den aktiven Abschnitt", () => {
    expect(currentSectionOnly(all, "Béchamel")).toEqual([
      { section: "Béchamel" },
    ]);
  });

  it("nimmt ohne aktiven Abschnitt den ersten", () => {
    expect(currentSectionOnly(all, null)).toEqual([{ section: "Ragù" }]);
  });

  it("liefert nichts, wenn der aktive Abschnitt keine Einträge hat", () => {
    expect(currentSectionOnly(all, "Anrichten")).toEqual([]);
  });
});
