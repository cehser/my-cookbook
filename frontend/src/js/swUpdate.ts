/**
 * Service-Worker-Update steuern (registerType "prompt").
 *
 * Ein neuer SW wartet, bis die App ihn aktiviert. Aktiviert (und neu geladen)
 * wird still bei der nächsten erfolgreichen Navigation oder bei der Rückkehr
 * in den Vordergrund nach mindestens 10 min Hintergrund, nie mitten in der
 * Benutzung und nie bei kurzem hidden (Kamera, Fotoauswahl). Eine laufende
 * schreibende Anfrage verhindert die Aktivierung.
 *
 * Nach Updates sucht der Browser von sich aus nur bei Navigation und
 * Registrierung. Eine fortgesetzte PWA prüft deshalb beim Start und beim
 * Wechsel in den Vordergrund, höchstens alle 30 min und nur online.
 *
 * Läuft nur im Build, nicht im Dev-Server.
 */

import type { Router } from "vue-router";
import { registerSW } from "virtual:pwa-register";
import { reloadOnce } from "./reload";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
/** So lange muss die App im Hintergrund gewesen sein, damit die Rückkehr neu lädt. */
const HIDDEN_RELOAD_MS = 10 * 60 * 1000;

let updateReady = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let registration: ServiceWorkerRegistration | undefined;
let lastCheck = 0;
let pendingWrites = 0;
let applying = false;
/** Ein anderer Tab hat den neuen SW aktiviert; dieser Tab läuft noch mit altem JS. */
let reloadPending = false;
let hiddenSince: number | undefined;

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
    });
  };
}

function applyUpdate(): void {
  if (applying || pendingWrites > 0) return;
  if (reloadPending) {
    applying = true;
    reloadOnce();
  } else if (updateReady && updateSW) {
    applying = true;
    void updateSW(true);
  }
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
    // register.js ruft das bei jedem Controllerwechsel (isUpdate) statt
    // location.reload(): auch wenn ein anderer Tab aktiviert hat. Eigene
    // Aktivierung lädt sofort, fremde erst bei Navigation oder Rückkehr.
    onNeedReload() {
      if (applying) reloadOnce();
      else reloadPending = true;
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      checkForUpdate();
    },
  });

  let firstNavigation = true;
  router.afterEach((to, _from, failure) => {
    // Abgebrochene, gecancelte und doppelte Navigationen zählen nicht: App.vue
    // cancelt beim Kaltstart die Initialnavigation per router.replace().
    if (failure) return;
    if (firstNavigation) {
      firstNavigation = false;
      return;
    }
    // Neuladen auf /callback würde den Login unterbrechen (Code nur einmal gültig).
    if (to.name === "Callback") return;
    applyUpdate();
  });

  // Ein anderer Tab hat aktiviert und der Server liefert die alten Chunks nicht
  // mehr: die Navigation scheitert, egal in welchem Browser und mit welcher
  // Meldung. Dann auf das Ziel neu laden (der Router-Handler tut das bei
  // erkannten Chunk-Fehlern ebenfalls; reloadOnce verhindert doppeltes Laden).
  router.onError((_error, to) => {
    if (reloadPending && pendingWrites === 0) {
      applying = true;
      reloadOnce(to.fullPath);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Kamera/Fotoauswahl setzen die Seite ebenfalls auf hidden: nicht neu laden.
      hiddenSince = Date.now();
      return;
    }
    const wasHiddenMs =
      hiddenSince === undefined ? 0 : Date.now() - hiddenSince;
    hiddenSince = undefined;
    if (
      (updateReady || reloadPending) &&
      wasHiddenMs >= HIDDEN_RELOAD_MS &&
      pendingWrites === 0
    ) {
      applyUpdate();
      return;
    }
    checkForUpdate();
  });
}
