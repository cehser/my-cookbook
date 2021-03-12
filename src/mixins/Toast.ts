export default {
  methods: {
    toast: function(content:string,variant:string)  {
      this.$bvToast.toast(content, {
          toaster: 'b-toaster-bottom-left',
         // solid: true,
          appendToast: true,
          noCloseButton: true,
          variant: variant
        });
    },
  },
}
