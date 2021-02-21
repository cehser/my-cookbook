<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<script>
  export default {
    mounted() {
      //load settings from IDB on aplication loading
      this.$store.dispatch("loadSettings");
      this.$store.dispatch("loadRecipes");
      this.$store.dispatch("loadRecipePictures");

      //time in ms
      const interval = 60000

      setInterval(() => {
        if(this.$store.state.settings.autosync) {
          console.log('syncing with cloud')
          this.$store.dispatch('syncRecipesWithCloud')
            .then(() => {
              this.$store.dispatch('saveRecipes')
              this.$store.dispatch('saveRecipePictures')
            })
        }
      }, interval)
    }
  }
</script>
