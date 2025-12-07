import { useToast as useBvnToast } from 'bootstrap-vue-next'

/**
 * Composable for showing toast notifications using bootstrap-vue-next
 */
export function useToast() {
  const bvnToast = useBvnToast()

  /**
   * Show a toast notification
   * @param content - The message to display
   * @param variant - Bootstrap alert variant (info, success, warning, danger)
   */
  const toast = (content: string, variant: string = 'info'): void => {
    bvnToast?.show({
      props: {
        body: content,
        variant: variant,
        pos: 'bottom-start',
        value: true,
      },
    })
  }

  return {
    toast,
  }
}
