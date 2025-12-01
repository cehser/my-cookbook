<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
    <div class="container-fluid">
      <router-link class="navbar-brand" to="/">Kochbuch</router-link>
      <button 
        class="navbar-toggler" 
        type="button" 
        @click="toggleMenu"
        aria-controls="mainmenu" 
        :aria-expanded="isMenuOpen" 
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div id="mainmenu" class="collapse navbar-collapse" :class="{ show: isMenuOpen }">
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
      <div id="loading-spinner" class="spinner-border spinner-border-sm text-light d-none" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </nav>
</template>

<script>
  export default {
    name: 'Navbar',
    props: {
      selected: {
        type: Number,
        default: 0
      },
      read_only: {
        type: Boolean,
        default: true
      },
      recipes_list: Array
    },
    data () {
      return {
        data_selected: 0,
        isMenuOpen: false
      }
    },
    watch: {
      data_selected: function(value){
        this.$emit('update:selected', value);
      }
    },
    created() {
      this.data_selected = this.selected;
    },
    methods: {
      toggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;
      }
    }
  }
</script>

<style scoped> 
  .router-link-active {
    color: #FFFFFF !important;
  }
</style>