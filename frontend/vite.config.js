import { fileURLToPath, URL } from "node:url";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";
import Components from "unplugin-vue-components/vite";
import { BootstrapVueNextResolver } from "bootstrap-vue-next";

// https://vitejs.dev/config/
let commitHash = process.env.COMMIT_HASH || "dev";
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // git not available (e.g. Docker build) — use COMMIT_HASH env or fallback
}

export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [
    basicSsl(),
    vue(),
    Components({
      resolvers: [BootstrapVueNextResolver()],
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Thumbnails: CacheFirst — Bilder ändern sich nicht (UUID-basiert)
            urlPattern: /\/api\/v1\/images\/[^/]+\/thumbnail$/,
            handler: "CacheFirst",
            options: {
              cacheName: "recipe-thumbnails",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 Tage
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Optimierte Bilder: CacheFirst
            urlPattern: /\/api\/v1\/images\/[^/]+$/,
            handler: "CacheFirst",
            options: {
              cacheName: "recipe-images",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 Tage
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: "Kochbuch",
        short_name: "Kochbuch",
        start_url: ".",
        lang: "de",
        display: "standalone",
        theme_color: "#4DBA87",
        background_color: "#000000",
        icons: [
          {
            src: "/img/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/img/icon-48x48.png",
            sizes: "48x48",
            type: "image/png",
          },
          {
            src: "/img/icon-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "/img/icon-96x96.png",
            sizes: "96x96",
            type: "image/png",
          },
          {
            src: "/img/icon-128x128.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "/img/icon-180x180.png",
            sizes: "180x180",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/img/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/img/icon-256x256.png",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: "/img/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 8080,
    host: true,
    // HTTPS disabled - causes SSL errors in Docker
    // For Clipboard API, localhost with HTTP works in modern browsers
  },
  css: {
    transformer: "lightningcss",
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
});
