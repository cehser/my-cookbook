import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return { ...actual, api: { post: vi.fn() } };
});

import { api, ApiError, ApiTimeoutError } from "./client";
import {
  aiApi,
  aiErrorMessage,
  AiImportError,
  MAX_IMAGE_MB,
  MAX_PAGES,
  MAX_TOTAL_MB,
} from "./ai";

const MB = 1024 * 1024;
/** Blob mit gewünschter Größe, ohne den Speicher wirklich zu füllen. */
const blobOf = (bytes: number) =>
  ({ size: bytes, type: "image/jpeg" }) as unknown as Blob;
const page = () => new Blob(["x"], { type: "image/jpeg" });

describe("aiErrorMessage", () => {
  it.each([
    [401, "", "Die Sitzung ist abgelaufen. Bitte neu anmelden."],
    [403, "", "Für den AI-Import fehlt die Berechtigung (Rolle Editor nötig)."],
    [
      413,
      "",
      `Die Bilder sind zu groß. Maximum: ${MAX_IMAGE_MB} MB je Bild, ${MAX_TOTAL_MB} MB gesamt.`,
    ],
    [429, "", "Zu viele Anfragen. Bitte in einer Minute erneut versuchen."],
    [429, '{"detail":"Kontingent erschöpft"}', "Kontingent erschöpft"],
    [
      502,
      "<html>Bad Gateway</html>",
      "Der Server ist für den AI-Import nicht erreichbar. Bitte später erneut versuchen.",
    ],
    [504, '{"detail":"OpenAI antwortet nicht"}', "OpenAI antwortet nicht"],
    [422, '{"detail":[{"loc":["body"]}]}', "Ungültige Anfrage."],
    [500, "", "Der AI-Import ist fehlgeschlagen (Fehler 500)."],
  ])("Status %i mit %j", (status, detail, expected) => {
    expect(aiErrorMessage(new ApiError(status, detail))).toBe(expected);
  });

  it("Zeitüberschreitung", () => {
    expect(aiErrorMessage(new ApiTimeoutError(135_000))).toContain(
      "dauert zu lange",
    );
  });

  it("Netzwerkfehler (TypeError von fetch)", () => {
    expect(aiErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Keine Verbindung zum Server. Bitte Netzwerk prüfen.",
    );
  });

  it("eigene Meldung und sonstige Fehler", () => {
    expect(aiErrorMessage(new AiImportError("Eigene Meldung"))).toBe(
      "Eigene Meldung",
    );
    expect(aiErrorMessage(new Error("kaputt"))).toBe("kaputt");
    expect(aiErrorMessage("roh")).toBe("roh");
  });
});

describe("aiApi.importImages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lehnt leere Seitenliste ab", async () => {
    await expect(aiApi.importImages([])).rejects.toThrow("Kein Bild");
    expect(api.post).not.toHaveBeenCalled();
  });

  it(`lehnt mehr als ${MAX_PAGES} Seiten ab`, async () => {
    const pages = Array.from({ length: MAX_PAGES + 1 }, page);
    await expect(aiApi.importImages(pages)).rejects.toThrow(
      `Maximum: ${MAX_PAGES}`,
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("prüft die Grenze je Bild vor dem Senden (413 vermeiden)", async () => {
    await expect(
      aiApi.importImages([blobOf(MAX_IMAGE_MB * MB + 1)]),
    ).rejects.toBeInstanceOf(AiImportError);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("prüft die Gesamtgrenze vor dem Senden (413 vermeiden)", async () => {
    // Jede Seite unter der Einzelgrenze, zusammen darüber
    const pages = [blobOf(8 * MB), blobOf(8 * MB), blobOf(8 * MB)];
    await expect(aiApi.importImages(pages)).rejects.toThrow(
      `${MAX_TOTAL_MB} MB gesamt`,
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sendet genau an den Grenzen und in Seitenreihenfolge", async () => {
    vi.mocked(api.post).mockResolvedValue({ recipe: {}, model: "m" });
    const pages = Array.from(
      { length: MAX_PAGES },
      (_, i) => new Blob([String(i)], { type: "image/jpeg" }),
    );
    await aiApi.importImages(pages);

    expect(api.post).toHaveBeenCalledTimes(1);
    const [path, body] = vi.mocked(api.post).mock.calls[0];
    expect(path).toBe("/ai/import/image");
    // happy-dom übernimmt den Dateinamen nicht; Reihenfolge über den Inhalt prüfen
    const contents = await Promise.all(
      (body as FormData).getAll("files").map((f) => (f as Blob).text()),
    );
    expect(contents).toEqual(
      Array.from({ length: MAX_PAGES }, (_, i) => String(i)),
    );
  });
});
