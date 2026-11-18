import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { BootstrapVueNextResolver } from "bootstrap-vue-next";

// Bewusst getrennt von vite.config.js (SSL- und PWA-Plugin gehören nicht in Tests).

// Windows mit kleinem Laufwerksbuchstaben (`c:`, so liefern VS Code und
// Claude-Code-Sitzungen das Arbeitsverzeichnis): Mit dem Standard-Pool lädt
// Vitest Module doppelt, alle Dateien scheitern („failed to find the current
// suite“, „reading 'config'“). `vmThreads` umgeht das. Sonst und in CI der
// Standard. Entfällt, sobald vitest-dev/vitest#9507 behoben ist.
const lowerDriveLetter =
  process.platform === "win32" && /^[a-z]:/.test(process.cwd());
// eslint-disable-next-line no-restricted-exports
export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify("test"),
  },
  plugins: [
    // Das PWA-Plugin fehlt hier bewusst; Specs mocken das virtuelle Modul.
    {
      name: "pwa-register-stub",
      resolveId: (id: string) =>
        id === "virtual:pwa-register" ? "\0virtual:pwa-register" : undefined,
      load: (id: string) =>
        id === "\0virtual:pwa-register"
          ? "export function registerSW() { return async () => {}; }"
          : undefined,
    },
    vue(),
    Components({
      resolvers: [BootstrapVueNextResolver()],
      dts: false,
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    environmentOptions: { happyDOM: { url: "http://localhost/" } },
    include: ["src/**/*.spec.ts"],
    ...(lowerDriveLetter ? { pool: "vmThreads" as const } : {}),
  },
});
