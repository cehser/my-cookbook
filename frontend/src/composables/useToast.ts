import { useToast as useBootstrapToast } from "bootstrap-vue-next";
import type { ColorVariant } from "bootstrap-vue-next";

// Anzeigedauer: bootstrap-vue-next 0.44 setzte sie selbst (5 s), ab 1.x
// zeigt create() ohne modelValue nichts an.
const TOAST_DURATION_MS = 5000;

export function useToast() {
  const { create } = useBootstrapToast();

  const showToast = (
    message: string,
    variant: ColorVariant = "primary",
  ): void => {
    const toast = create({
      position: "bottom-end",
      body: message,
      variant,
      solid: true,
      modelValue: TOAST_DURATION_MS,
    });
    // show() endet mit dem Ausblenden; danach aus dem Orchestrator entfernen,
    // sonst sammeln sich ausgeblendete Toasts im Store
    void toast.show().then(() => toast.destroy());
  };

  return {
    showToast,
    toast: showToast,
  };
}
