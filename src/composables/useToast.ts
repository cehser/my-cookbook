import { useToast as useBootstrapToast } from 'bootstrap-vue-next'
import type { ColorVariant } from 'bootstrap-vue-next'

/**
 * Composable for showing toast notifications using bootstrap-vue-next
 */
export function useToast() {
  const { show } = useBootstrapToast()

  /**
   * Show a toast notification
   * @param title - The title to display
   * @param message - The message to display
   * @param variant - Bootstrap alert variant (info, success, warning, danger)
   */
  const showToast = (
    title: string,
    message: string,
    variant: ColorVariant = 'primary'
  ): void => {
    show?.({
      props: {
        title,
        body: message,
        variant,
        solid: true,
      },
    })
  }

  return {
    showToast,
    toast: showToast,
  }
}
