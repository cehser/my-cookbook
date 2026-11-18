import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/session", () => ({
  getAccessToken: vi.fn(async () => "token"),
  renewAfterUnauthorized: vi.fn(),
}));

import { api, readDownload } from "./client";

describe("readDownload", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("liest Blob und Dateinamen aus Content-Disposition", async () => {
    const response = new Response("zip", {
      headers: {
        "Content-Disposition":
          'attachment; filename="my-cookbook-export-2026-11-18.zip"',
      },
    });
    const file = await readDownload(response);
    expect(file.filename).toBe("my-cookbook-export-2026-11-18.zip");
    expect(await file.blob.text()).toBe("zip");
  });

  it("ohne Header kein Dateiname", async () => {
    expect((await readDownload(new Response("x"))).filename).toBeNull();
  });

  it("api.get nutzt parse statt JSON und sendet den Auth-Header", async () => {
    const fetch = vi.fn(
      async () =>
        new Response("zip", {
          headers: { "Content-Disposition": "attachment; filename=a.zip" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const file = await api.get<{ filename: string | null }>("/admin/export", {
      parse: readDownload,
    });

    expect(file.filename).toBe("a.zip");
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token");
  });
});
