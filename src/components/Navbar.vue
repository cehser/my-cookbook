<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
    <router-link class="navbar-brand" to="/">Kochbuch</router-link>
    <div id="mainmenu" class="collapse navbar-collapse">
      <ul class="navbar-nav">
        <li class="nav-item">
          <router-link class="nav-link" to="/" exact>Galerie</router-link>
        </li>
        <li class="nav-item">
          <router-link class="nav-link" :to="'/recipe/' + selected">Rezept</router-link>
        </li>
        <li class="nav-item" v-if="!read_only">
          <router-link class="nav-link" :to="'/edit/' + selected">Bearbeiten</router-link>
        </li>
        <li class="nav-item">
          <router-link class="nav-link" to="/settings">Einstellungen</router-link>
        </li>
        <li class="nav-item">
          <router-link class="nav-link" to="/administration">Verwaltung</router-link>
        </li>
        <slot></slot>
      </ul>
    </div>
    <div class="d-flex align-items-center">      
      <div id="loading-spinner" class="spinner-border spinner-border-sm text-light d-none" role="status">
        <span class="sr-only">Loading...</span>
      </div>
      <button class="navbar-toggler ml-4" type="button" data-toggle="collapse" data-target="#mainmenu" aria-controls="mainmenu" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
    </div>
  </nav>
</template>

<script lang="ts">
  import { Component, Prop, Vue} from 'vue-property-decorator'
  @Component
  export default class Recipe extends Vue {
    @Prop({type: Number,default: 0}) selected!:number
    @Prop({type: Boolean, default: true}) read_only!:boolean
 }
</script>

<style scoped> 
  .router-link-active {
    color: #FFFFFF !important;
  }
</style>