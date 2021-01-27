<template>
  <div id="mainmenu" class="collapse navbar-collapse">
      <ul class="navbar-nav">
        <li class="nav-item">
          <router-link class="nav-link" to="/">Home</router-link>
        </li>
        <li class="nav-item active">
          <router-link class="nav-link" to="/edit">Bearbeiten</router-link>
        </li>
        <li class="nav-item">
          <form class="form-inline">
              <b-form-select class="form-control mr-sm-2" v-model.number="data_selected" :options="recipes_list"></b-form-select>
          </form>
        </li>
        <slot></slot>
      </ul>
    </div>
</template>

<script>
  // @ is an alias to /src

  export default {
    name: 'Recipe',
    props: {
      selected: Number,
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
