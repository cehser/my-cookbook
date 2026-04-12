<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { handleCallback } from "@/auth/oidc";

const router = useRouter();

onMounted(async () => {
  try {
    await handleCallback();
    const returnUrl = sessionStorage.getItem("oidc-return-url");
    sessionStorage.removeItem("oidc-return-url");
    router.replace(returnUrl || "/");
  } catch (err) {
    console.error("OIDC callback failed:", err);
    router.replace("/");
  }
});
</script>

<template>
  <div
    class="d-flex justify-content-center align-items-center"
    style="min-height: 60vh"
  >
    <div class="text-center">
      <div class="spinner-border text-primary mb-3" role="status">
        <span class="visually-hidden">Anmeldung wird verarbeitet...</span>
      </div>
      <p class="text-muted">Anmeldung wird verarbeitet...</p>
    </div>
  </div>
</template>
