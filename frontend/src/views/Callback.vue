<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useOnline } from "@vueuse/core";
import { onCallback, retryLoginFromCallback } from "@/auth/session";

const router = useRouter();
const isOnline = useOnline();
const failed = ref(false);
const returnUrl = sessionStorage.getItem("oidc-return-url") || "/";

onMounted(async () => {
  // onCallback verarbeitet den Code genau einmal (auch bei zweitem Mount/Reload).
  if (await onCallback(returnUrl)) {
    sessionStorage.removeItem("oidc-return-url");
    router.replace(returnUrl);
    return;
  }
  // Fehlgeschlagen (nach höchstens einer automatischen Wiederholung):
  // Meldung statt Endlos-Spinner oder Redirect-Schleife.
  failed.value = true;
});

async function retryLogin() {
  await retryLoginFromCallback(returnUrl);
}
</script>

<template>
  <div
    class="d-flex justify-content-center align-items-center"
    style="min-height: 60vh"
  >
    <div v-if="!failed" class="text-center">
      <div class="spinner-border text-primary mb-3" role="status">
        <span class="visually-hidden">Anmeldung wird verarbeitet...</span>
      </div>
      <p class="text-muted">Anmeldung wird verarbeitet...</p>
    </div>
    <div v-else class="text-center px-4" role="alert">
      <i class="bi bi-exclamation-triangle fs-1 d-block mb-2"></i>
      <h5>Anmeldung fehlgeschlagen</h5>
      <p class="text-muted">
        Die Antwort des Anmeldedienstes konnte nicht verarbeitet werden.
      </p>
      <p v-if="!isOnline" class="text-muted">
        Keine Verbindung. Erneut anmelden, sobald das Netz wieder da ist.
      </p>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!isOnline"
        @click="retryLogin"
      >
        Erneut anmelden
      </button>
    </div>
  </div>
</template>
