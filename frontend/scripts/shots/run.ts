/**
 * Screenshot-Harness: liefert den Production-Build (`dist/`) statisch aus,
 * beantwortet `/api/v1` per Mock, belegt Sitzung und Vormerkung vor und
 * fotografiert die Szenarien mit einem installierten Browser.
 *
 * Aufruf (aus `frontend/`, vorher `npm run build` aus einem Pfad mit `C:`):
 *   npm run shots -- <szenario|all> [ausgabeordner]
 *   npm run shots -- --list
 * Vorgabe Ausgabeordner: `docs/plans/shots/` (relativ zum Repo).
 * Browser: `SHOTS_BROWSER=<pfad>` oder Kanal `msedge`, sonst `chrome`.
 * Geräte bzw. Themen einschränken: `SHOTS_DEVICES=iphone,desktop`,
 * `SHOTS_THEMES=hell,dunkel`.
 */

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { createMockApi } from "./mockApi.ts";
import { scenarios } from "./scenarios.ts";
import { applySeed, type BrowserSeed } from "./seed.ts";
import type { DeviceName, Scenario, Seed, Theme } from "./types.ts";

const FRONTEND = resolve(fileURLToPath(import.meta.url), "../../..");
const DIST = join(FRONTEND, "dist");
const REPO = resolve(FRONTEND, "..");
const CLIENT_ID = "shots";

const DEVICES: Record<
  DeviceName,
  {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    isMobile: boolean;
    hasTouch: boolean;
  }
> = {
  iphone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webp": "image/webp",
};

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Server je Szenario: statisch `dist/`, `/config.js`, Seed-Seite, Mock-API. */
async function startServer(
  scenario: Scenario,
): Promise<{ server: Server; origin: string }> {
  const handle = createMockApi(scenario.seed, scenario.responses);
  let origin = "";
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    if (path.startsWith("/api/v1/")) {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let body: unknown;
        try {
          body = raw ? JSON.parse(raw) : undefined;
        } catch {
          body = undefined;
        }
        const result = handle(
          req.method ?? "GET",
          path.slice("/api/v1".length),
          body,
        );
        setTimeout(() => {
          if (result.body === undefined) {
            res.writeHead(result.status).end();
          } else {
            res
              .writeHead(result.status, { "Content-Type": "application/json" })
              .end(JSON.stringify(result.body));
          }
        }, result.delayMs);
      });
      return;
    }
    if (path === "/config.js") {
      res.writeHead(200, { "Content-Type": MIME[".js"] }).end(
        `window.__CONFIG__ = ${JSON.stringify({
          OIDC_AUTHORITY: `${origin}/oidc`,
          OIDC_CLIENT_ID: CLIENT_ID,
        })};`,
      );
      return;
    }
    if (path === "/__shots/seed") {
      res
        .writeHead(200, { "Content-Type": MIME[".html"] })
        .end("<!doctype html><title>seed</title>");
      return;
    }
    const file = join(DIST, decodeURIComponent(path));
    const isFile =
      file.startsWith(DIST) && existsSync(file) && statSync(file).isFile();
    // SPA-Fallback wie nginx
    const target = isFile ? file : join(DIST, "index.html");
    res
      .writeHead(200, {
        "Content-Type": MIME[extname(target)] ?? "application/octet-stream",
      })
      .end(readFileSync(target));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, origin };
}

/** Seed des Szenarios in localStorage und IndexedDB übersetzen. */
function browserSeed(seed: Seed, origin: string): BrowserSeed {
  const local: Record<string, string> = { ...seed.localStorage };
  const user = seed.user;
  if (user) {
    const now = Math.floor(Date.now() / 1000);
    local[`oidc.user:${origin}/oidc:${CLIENT_ID}`] = JSON.stringify({
      id_token: "shots",
      access_token: "shots",
      refresh_token: "shots",
      token_type: "Bearer",
      scope: "openid profile email offline_access",
      profile: {
        sub: user.sub,
        name: user.name,
        iss: `${origin}/oidc`,
        aud: CLIENT_ID,
      },
      expires_at: now + 3600,
    });
    local["my-cookbook-role"] = JSON.stringify({
      sub: user.sub,
      role: user.role,
    });
  }
  const idb: Record<string, unknown> = { ...seed.idb };
  if (seed.pending?.length) {
    idb.pendingCreates = seed.pending.map((p) => ({
      ...p,
      sub: p.sub === undefined ? (user?.sub ?? null) : p.sub,
    }));
  }
  return { localStorage: local, idb };
}

async function launch(): Promise<Browser> {
  const executablePath = process.env.SHOTS_BROWSER;
  if (executablePath) return chromium.launch({ executablePath });
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // nächster Kanal
    }
  }
  throw new Error(
    "Kein Browser gefunden: Edge oder Chrome installieren oder SHOTS_BROWSER=<pfad> setzen.",
  );
}

function listFromEnv<T extends string>(
  name: string,
  allowed: readonly T[],
): T[] | null {
  const raw = process.env[name];
  if (!raw) return null;
  const values = raw.split(",").map((v) => v.trim()) as T[];
  const unknown = values.filter((v) => !allowed.includes(v));
  if (unknown.length)
    throw new Error(`${name}: unbekannt ${unknown.join(", ")}`);
  return values;
}

async function shoot(
  browser: Browser,
  scenario: Scenario,
  outDir: string,
): Promise<string[]> {
  const devices = listFromEnv<DeviceName>("SHOTS_DEVICES", [
    "iphone",
    "desktop",
  ]) ??
    scenario.devices ?? ["iphone"];
  const themes = listFromEnv<Theme>("SHOTS_THEMES", ["hell", "dunkel"]) ??
    scenario.themes ?? ["hell", "dunkel"];
  const { server, origin } = await startServer(scenario);
  const written: string[] = [];
  try {
    for (const device of devices) {
      for (const theme of themes) {
        const context = await browser.newContext({
          ...DEVICES[device],
          colorScheme: theme === "dunkel" ? "dark" : "light",
          locale: "de-DE",
          serviceWorkers: "block",
        });
        try {
          const page = await context.newPage();
          await page.goto(`${origin}/__shots/seed`);
          await page.evaluate(applySeed, browserSeed(scenario.seed, origin));
          await page.goto(`${origin}${scenario.route}`);
          if (scenario.waitForText) {
            await page
              .getByText(scenario.waitForText)
              .first()
              .waitFor({ timeout: 15_000 });
          }
          await page.waitForLoadState("networkidle");
          for (const selector of scenario.clicks ?? []) {
            await page.locator(selector).first().click();
          }
          // Übergänge abklingen lassen
          await page.waitForTimeout(500);
          const file = join(outDir, `${device}-${theme}-${scenario.name}.png`);
          await page.screenshot({
            path: file,
            fullPage: scenario.fullPage ?? false,
          });
          written.push(file);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    server.close();
  }
  return written;
}

async function main(): Promise<void> {
  const [which, outArg] = process.argv.slice(2);
  if (!which || which === "--list") {
    log("Szenarien:");
    for (const s of scenarios) log(`  ${s.name}: ${s.description}`);
    log("Aufruf: npm run shots -- <szenario|all> [ausgabeordner]");
    return;
  }
  const selected =
    which === "all" ? scenarios : scenarios.filter((s) => s.name === which);
  if (!selected.length)
    throw new Error(`Unbekanntes Szenario: ${which} (--list zeigt alle)`);
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(
      "dist/ fehlt: zuerst `npm run build` (aus einem Pfad mit großem C:).",
    );
  }
  const outDir = resolve(REPO, outArg ?? "docs/plans/shots");
  mkdirSync(outDir, { recursive: true });

  const browser = await launch();
  try {
    for (const scenario of selected) {
      for (const file of await shoot(browser, scenario, outDir)) log(file);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
