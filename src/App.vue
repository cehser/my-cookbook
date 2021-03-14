<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<script lang="ts">
  import { Component, Vue} from 'vue-property-decorator'
  import { namespace, Getter } from 'vuex-class'
  // eslint-disable-next-line no-unused-vars
  import Settings from './types/settings'

  const VuexSettings = namespace('Settings')
  const VuexRecipes = namespace('Recipes')

  @Component
  export default class App extends Vue {
    @VuexSettings.Action loadSettings!: () => Promise<void>

    @VuexRecipes.Action loadRecipes!: () => Promise<void>
    @VuexRecipes.Action loadRecipePictures!: () => Promise<void>
    @VuexRecipes.Action syncRecipesWithCloud!: () => Promise<void>
    @VuexRecipes.Action saveRecipes!: () => Promise<void>
    @VuexRecipes.Action saveRecipePictures!: () => Promise<void>

    @Getter getSettings!: Settings

    mounted() {
      //load settings from IDB on aplication loading
      this.loadSettings()
      this.loadRecipes()
      this.loadRecipePictures()

      //time in ms
      const interval = 60000

      setInterval(() => {
        if(this.getSettings.autosync) {
          console.log('syncing with cloud')
          this.syncRecipesWithCloud()
            .then(() => {
              this.saveRecipes()
              this.saveRecipePictures()
            })
        }
      }, interval)
    }
  }
</script>
