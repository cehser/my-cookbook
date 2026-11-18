import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

/**
 * Hält den Bildschirm an, solange die Komponente sichtbar ist und
 * `enabled` gilt (Screen Wake Lock API, R-02).
 *
 * - Nur per Feature-Erkennung; ohne API passiert nichts (`isSupported` false),
 *   bewusst ohne Rückfall-Tricks wie ein stummes Video.
 * - Der Browser gibt die Sperre beim Verbergen der Seite selbst frei;
 *   bei `visibilitychange` → sichtbar wird sie erneut angefordert.
 * - Abgelehnte Anforderungen (z. B. Stromsparmodus) werden geschluckt.
 * - Beim Verlassen (Unmount) wird sie freigegeben.
 *
 * Eigene Umsetzung statt `useWakeLock` aus VueUse: Dort fängt die erneute
 * Anforderung nach `visibilitychange` Ablehnungen nicht ab, und der Schalter
 * müsste zusätzlich daneben gesteuert werden.
 */
export function useWakeLock(enabled: Ref<boolean>) {
  const isSupported =
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    !!navigator.wakeLock;
  const isActive = ref(false);

  let sentinel: WakeLockSentinel | null = null;
  let requesting = false;
  let mounted = false;

  async function request() {
    if (!isSupported || !mounted || !enabled.value) return;
    if (sentinel || requesting) return;
    if (document.visibilityState !== "visible") return;
    requesting = true;
    try {
      const s = await navigator.wakeLock.request("screen");
      if (!mounted || !enabled.value) {
        await s.release();
        return;
      }
      sentinel = s;
      isActive.value = true;
      s.addEventListener("release", () => {
        if (sentinel !== s) return;
        sentinel = null;
        isActive.value = false;
      });
    } catch {
      isActive.value = false;
    } finally {
      requesting = false;
    }
  }

  async function release() {
    const s = sentinel;
    sentinel = null;
    isActive.value = false;
    if (s && !s.released) {
      try {
        await s.release();
      } catch {
        // bereits freigegeben
      }
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") void request();
  }

  watch(enabled, (on) => {
    if (on) void request();
    else void release();
  });

  onMounted(() => {
    mounted = true;
    document.addEventListener("visibilitychange", onVisibilityChange);
    void request();
  });

  onBeforeUnmount(() => {
    mounted = false;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    void release();
  });

  return { isSupported, isActive };
}
