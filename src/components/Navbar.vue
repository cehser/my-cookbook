<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
    <router-link class="navbar-brand" to="/">Kochbuch</router-link>
    <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#mainmenu" aria-controls="mainmenu" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div id="mainmenu" class="collapse navbar-collapse">
      <ul class="navbar-nav">
        <li class="nav-item">
          <router-link class="nav-link" to="/" exact>Galerie</router-link>
        </li>
        <li class="nav-item">
          <router-link class="nav-link" :to="'/recipe/' + selected">Rezept</router-link>
        </li>
        <li class="nav-item">
          <router-link class="nav-link" :to="'/edit/' + selected">Bearbeiten</router-link>
        </li>
        <li class="nav-item">
          <router-link class="nav-link" to="/settings">Einstellungen</router-link>
        </li>
<!--       <li class="nav-item">
          <form class="form-inline">
              <b-form-select class="form-control mr-sm-2" v-model.number="data_selected" :options="recipes_list"></b-form-select>
          </form>
        </li>-->
        <slot></slot>
      </ul>
    </div>
  </nav>
</template>

<script>
  // @ is an alias to /src

  export default {
    name: 'Recipe',
    props: {
      selected: {
        type: Number,
        default: 0
      },
      recipes_list: Array
    },
    data () {
      return {
        data_selected: 0
      }
    },
    watch: {
      data_selected: function(value){
        this.$emit('input', value);
      }
    },
    created() {
      this.data_selected = this.selected;
    }
  }
</script>

<style scoped> 
  .router-link-active {
    color: #FFFFFF !important;
  }
</style>