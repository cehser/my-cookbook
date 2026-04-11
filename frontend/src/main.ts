import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

import router from "./router";
import { registerSW } from "virtual:pwa-register";

// Import Bootstrap and BootstrapVueNext CSS files
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue-next/dist/bootstrap-vue-next.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const app = createApp(App);

app.use(router);
app.use(createPinia());

// --- PWA Auto-Update: reload on next navigation when new SW is ready ---
let swNeedsReload = false;

registerSW({
  onNeedRefresh() {
    swNeedsReload = true;
  },
});

router.afterEach(() => {
  if (swNeedsReload) {
    window.location.reload();
  }
});

// Global Vue error handler — prevents white screen on render errors
app.config.errorHandler = (err, instance, info) => {
  console.error(`[Vue Error] ${info}:`, err);
};

// Catch unhandled promise rejections (e.g. forgotten API .catch())
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise]", event.reason);
});

app.mount("#app");
