import { useToast as useBootstrapToast } from "bootstrap-vue-next";
import type { ColorVariant } from "bootstrap-vue-next";

export function useToast() {
  const { create } = useBootstrapToast();

  const showToast = (
    message: string,
    variant: ColorVariant = "primary",
  ): void => {
    create?.({
      pos: "bottom-end",
      props: {
        body: message,
        variant,
        solid: true,
      },
    });
  };

  return {
    showToast,
    toast: showToast,
  };
}
