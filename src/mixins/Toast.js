export default {
  methods: {
    toast(content, variant = 'info') {
      // Create a simple toast notification
      const toastEl = document.createElement('div');
      toastEl.className = `alert alert-${variant} position-fixed bottom-0 start-0 m-3`;
      toastEl.style.zIndex = '9999';
      toastEl.textContent = content;
      document.body.appendChild(toastEl);
      
      setTimeout(() => {
        toastEl.remove();
      }, 3000);
    },
  },
}
