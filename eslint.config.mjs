import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import prettierConfig from "@vue/eslint-config-prettier";

export default defineConfig([
  js.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  prettierConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },

      ecmaVersion: "latest",
      sourceType: "module",
      parser: vueParser,
    },

    rules: {
      "vue/no-mutating-props": "off",
    },
  },
  {
    // Views can use single-word component names
    files: ["**/views/**/*.vue", "**/components/Navbar.vue"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  {
    // Service Worker specific config
    files: ["**/sw.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        workbox: "readonly",
      },
    },
  },
]);
