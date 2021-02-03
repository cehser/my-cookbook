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
    }
  }
</script>
