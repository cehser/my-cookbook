<template>
  <div class="card recipe_card_container">
    <div class="recipe_card_container">
      <img class="" id="recipe_img" :src="picture_src" alt="Card image cap">
      <div class="card-body recipe_title">
        <h2 class="card-title d-flex flex-row flex-wrap justify-content-between">
          <TextHighlight class="card-title-text" :queries="highlight" :caseSensitive="false">{{ recipe.recipe_name }}</TextHighlight>
        </h2>
        <div class="icons">
          <router-link v-if="!read_only" class="editLink" :to="'/edit/' + index"><b-icon-pencil class="icon"></b-icon-pencil></router-link>
          <a href="javascript:void(0)" @click="$emit('favtoggle')">
            <b-icon-star class="icon" v-if="!is_favorite"></b-icon-star>
            <b-icon-star-fill class="icon" v-if="is_favorite"></b-icon-star-fill>
          </a>
        </div>
        <p class="card-text">{{recipe.subtitle}}</p>
      </div>
    </div>
    <b-link :to="{ path: '/recipe/'+index }" class="stretched-link"></b-link>
  </div>
</template>


<script lang="ts">
  import { Component, Vue, Prop} from 'vue-property-decorator'
  import TextHighlight from 'vue-text-highlight';

  @Component({
    components: {TextHighlight}
  })
  export default class RecipeCard extends Vue{
    @Prop(Object) recipe:any
    @Prop([Object, URL, String]) picture_src:any
    @Prop(Number) index!: number
    @Prop(String) highlight!: string
    @Prop(Boolean) read_only!: boolean
    @Prop(Boolean) is_favorite!: boolean
  }
</script>

<style scoped>
.recipe_card_container img {
  position: absolute;
  border-radius: calc(0.25rem - 1px);
  
  object-fit: cover; /* Do not scale the image */
  object-position: center; /* Center the image within the element */
  width: 100%;
  height: 100%;
  margin:auto;
}

.recipe_title {
  width:100%;
  position: absolute;
  bottom: 0;
  background-color: rgba(230, 230, 230,0.6);
  /*color: black;*/
}

a .recipe_card_container {
    color: initial;
}
 
.recipe_title p {
  -webkit-line-clamp: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}

.icons {
  position: absolute;
  top: 0.25rem;
  right: 0.5rem;
  color: #888;
  z-index: 100;
}

.icons a {
  color: #888;
}

.icon {
  margin-right: 0.5rem;
}

.card-title-text {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  line-height: 1.3;
}

.card-title >>> mark {
  padding: 0 !important;
  background-color: rgba(255, 204, 0, 0.5);
}
</style>