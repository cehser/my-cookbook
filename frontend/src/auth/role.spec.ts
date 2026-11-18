import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ api: { get: vi.fn() } }));
vi.mock("@/auth/session", () => ({
  isAuthenticated: vi.fn(),
  RENEW_TIMEOUT_SECONDS: 10,
}));

import {
  canDeleteRecipe,
  canEdit,
  canFavorite,
  normalizeUserId,
  sameUser,
} from "@/auth/role";

const SUB = "3f2b8c1e-0a4d-4e5f-9b6a-7c8d9e0f1a2b";

describe("sameUser", () => {
  it("vergleicht ohne Groß-/Kleinschreibung, Bindestriche und Klammern", () => {
    expect(normalizeUserId(`{${SUB.toUpperCase()}}`)).toBe(
      SUB.replace(/-/g, ""),
    );
    expect(sameUser(SUB, `{${SUB.toUpperCase()}}`)).toBe(true);
    expect(sameUser(SUB, SUB.replace(/-/g, ""))).toBe(true);
    expect(sameUser(SUB, "3f2b8c1e-0a4d-4e5f-9b6a-000000000000")).toBe(false);
  });

  it("fehlende IDs sind nie gleich", () => {
    expect(sameUser(null, null)).toBe(false);
    expect(sameUser(undefined, SUB)).toBe(false);
    expect(sameUser("", "")).toBe(false);
  });
});

describe("canFavorite", () => {
  it("ab readonly, nicht für pending", () => {
    expect(canFavorite("readonly")).toBe(true);
    expect(canFavorite("editor")).toBe(true);
    expect(canFavorite("admin")).toBe(true);
    expect(canFavorite("pending")).toBe(false);
    expect(canFavorite(undefined)).toBe(false);
  });
});

describe("canEdit", () => {
  it.each([
    ["admin", true],
    ["editor", true],
    ["readonly", false],
    ["pending", false],
    ["unbekannt", false],
    ["", false],
    [null, false],
    [undefined, false],
  ] as const)("%s → %s", (role, expected) => {
    expect(canEdit(role)).toBe(expected);
  });
});

describe("canDeleteRecipe", () => {
  const other = "11111111-2222-3333-4444-555555555555";
  it.each([
    ["admin", SUB, other, false, true],
    ["admin", SUB, undefined, false, true],
    ["editor", SUB, SUB.toUpperCase(), false, true],
    ["editor", SUB, other, false, false],
    ["editor", SUB, undefined, false, false], // Altbestand: nur Admin
    ["editor", null, SUB, false, false],
    ["readonly", SUB, SUB, false, false],
    ["pending", SUB, SUB, false, false],
    ["readonly", SUB, undefined, true, true], // vorgemerkt: Ersteller darf
  ] as const)(
    "%s (sub %s, created_by %s, vorgemerkt %s) → %s",
    (role, sub, createdBy, pending, allowed) => {
      expect(canDeleteRecipe({ role, sub, createdBy, pending })).toBe(allowed);
    },
  );
});
