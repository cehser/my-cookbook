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

      setInterval(() => {
        if(this.$store.state.settings.autosync) {
          console.log('syncing with cloud')
          this.$store.dispatch('syncRecipesWithCloud')
        }
      }, 60000)
    }
  }
</script>
