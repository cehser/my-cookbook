import { useToast as useBootstrapToast } from "bootstrap-vue-next";
import type { ColorVariant } from "bootstrap-vue-next";

export function useToast() {
  const { show } = useBootstrapToast();

  const showToast = (
    message: string,
    variant: ColorVariant = "primary",
  ): void => {
    show?.({
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
