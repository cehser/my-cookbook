import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./formatDate";

// Lokale Zeit ohne Zeitzonen-Suffix, damit der Test unabhängig von TZ ist
const ISO = "2026-11-15T23:05:00";

describe("formatDate", () => {
  it("zeigt nur das Datum", () => {
    expect(formatDate(ISO)).toBe("15.11.2026");
  });

  it("zeigt „—“ ohne Wert", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("zeigt Datum mit Uhrzeit", () => {
    expect(formatDateTime(ISO)).toBe("15.11.2026, 23:05");
  });

  it("zeigt „—“ ohne Wert", () => {
    expect(formatDateTime(null)).toBe("—");
  });
});
