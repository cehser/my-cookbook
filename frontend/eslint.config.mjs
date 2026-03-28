import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "@vue/eslint-config-prettier";

export default defineConfig([
  js.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  prettierConfig,

  // ─── Global rules for all source files ───
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },

      ecmaVersion: "latest",
      sourceType: "module",
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: [".vue"],
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },

    plugins: {
      "@typescript-eslint": tsPlugin,
    },

    rules: {
      // --- Vue: Composition API / <script setup> only ---
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/block-order": [
        "error",
        { order: ["script", "template", "style"] },
      ],
      "vue/no-v-html": "warn",
      "vue/no-mutating-props": "off",

      // --- TypeScript strictness ---
      "@typescript-eslint/no-explicit-any": "error",

      // --- Forbidden imports (deprecated/insecure packages) ---
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "vuex", message: "Vuex ist entfernt. Verwende Pinia (useRecipeStore / useUIStore)." },
            { name: "jsonpath", message: "jsonpath hat eine Code-Injection-Schwachstelle. Verwende native JS." },
            { name: "lodash", message: "lodash ist nicht installiert. Verwende native JS/TS." },
          ],
        },
      ],

      // --- Code quality ---
      "no-var": "error",
      "prefer-const": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": "off", // use TS version instead
    },
  },

  // ─── TypeScript files: no default exports (except router), strict unused vars ───
  {
    files: ["**/*.ts"],
    ignores: ["**/router/**"],
    rules: {
      "no-restricted-exports": [
        "error",
        { restrictDefaultExports: { direct: true } },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",
    },
  },

  // ─── Views can use single-word component names ───
  {
    files: ["**/views/**/*.vue"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },

  // ─── Service Worker specific config ───
  {
    files: ["**/sw.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        workbox: "readonly",
      },
    },
  },
]);
