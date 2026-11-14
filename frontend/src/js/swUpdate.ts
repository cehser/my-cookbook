/**
 * Service-Worker-Update steuern (registerType "prompt").
 *
 * Ein neuer SW wartet, bis die App ihn aktiviert. Aktiviert (und neu geladen)
 * wird still bei der nächsten Navigation oder wenn die App in den Hintergrund
 * geht, nie mitten in der Benutzung. Eine schreibende Anfrage, die noch läuft,
 * schiebt das Neuladen auf, bis sie beendet ist.
 *
 * Nach Updates sucht der Browser von sich aus nur bei Navigation und
 * Registrierung. Eine fortgesetzte PWA prüft deshalb beim Start und beim
 * Wechsel in den Vordergrund, höchstens alle 30 min und nur online.
 *
 * Läuft nur im Build, nicht im Dev-Server.
 */

import type { Router } from "vue-router";
import { registerSW } from "virtual:pwa-register";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let updateReady = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let registration: ServiceWorkerRegistration | undefined;
let lastCheck = 0;
let pendingWrites = 0;
let applying = false;

/** Zählt laufende schreibende Anfragen (alles außer GET/HEAD) über window.fetch. */
function trackWrites(): void {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (method === "GET" || method === "HEAD")
      return originalFetch(input, init);
    pendingWrites++;
    return originalFetch(input, init).finally(() => {
      pendingWrites--;
      if (document.visibilityState === "hidden") applyUpdate();
    });
  };
}

function applyUpdate(): void {
  if (!updateReady || !updateSW || applying || pendingWrites > 0) return;
  applying = true;
  void updateSW(true);
}

function checkForUpdate(): void {
  if (!registration || !navigator.onLine) return;
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = now;
  registration.update().catch(() => {
    // offline oder Server nicht erreichbar: beim nächsten Mal erneut
  });
}

export function setupSwUpdate(router: Router): void {
  trackWrites();

  updateSW = registerSW({
    onNeedRefresh() {
      updateReady = true;
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      checkForUpdate();
    },
  });

  let firstNavigation = true;
  router.afterEach((to) => {
    if (firstNavigation) {
      firstNavigation = false;
      return;
    }
    // Neuladen auf /callback würde den Login unterbrechen (Code nur einmal gültig).
    if (to.name === "Callback") return;
    applyUpdate();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") applyUpdate();
    else checkForUpdate();
  });
}
