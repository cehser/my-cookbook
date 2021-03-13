import { Component, Prop, Vue } from 'vue-property-decorator'

@Component
export default class Toast extends Vue {
  public toast(content:string,variant:string)  {
    this.$bvToast.toast(content, {
        toaster: 'b-toaster-bottom-left',
        // solid: true,
        appendToast: true,
        noCloseButton: true,
        variant: variant
      });
  }
}
