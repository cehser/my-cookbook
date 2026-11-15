import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { BootstrapVueNextResolver } from "bootstrap-vue-next";

// Bewusst getrennt von vite.config.js (SSL- und PWA-Plugin gehören nicht in Tests).
// eslint-disable-next-line no-restricted-exports
export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify("test"),
  },
  plugins: [
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
  },
});
