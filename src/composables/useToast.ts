/**
 * Composable for showing toast notifications
 */
export function useToast() {
  /**
   * Show a toast notification
   * @param content - The message to display
   * @param variant - Bootstrap alert variant (info, success, warning, danger)
   */
  const toast = (content: string, variant: string = 'info'): void => {
    // Create a simple toast notification
    const toastEl = document.createElement('div')
    toastEl.className = `alert alert-${variant} position-fixed bottom-0 start-0 m-3`
    toastEl.style.zIndex = '9999'
    toastEl.textContent = content
    document.body.appendChild(toastEl)
    
    setTimeout(() => {
      toastEl.remove()
    }, 3000)
  }

  return {
    toast
  }
}
