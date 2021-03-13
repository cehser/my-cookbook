<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<script lang="ts">
  import { Component, Vue} from 'vue-property-decorator'
  @Component
  export default class App extends Vue {
    mounted() {
      //load settings from IDB on aplication loading
      this.$store.dispatch("Settings/loadSettings");
      this.$store.dispatch("Recipes/loadRecipes");
      this.$store.dispatch("Recipes/loadRecipePictures");

      //time in ms
      const interval = 60000

      setInterval(() => {
        if(this.$store.state.settings.autosync) {
          console.log('syncing with cloud')
          this.$store.dispatch('Recipes/syncRecipesWithCloud')
            .then(() => {
              this.$store.dispatch('Recipes/saveRecipes')
              this.$store.dispatch('Recipes/saveRecipePictures')
            })
        }
      }, interval)
    }
  }
</script>
