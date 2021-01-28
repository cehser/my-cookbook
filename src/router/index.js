import Vue from 'vue'
import VueRouter from 'vue-router'
import Recipe from '@/views/Recipe.vue'
import Gallery from '@/views/Gallery.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Gallery',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: Gallery
  },
  {
    path: '/recipe',
    name: 'Recipe',
    component: Recipe
  },
  { path: '/recipe/:id', component: Recipe },
  {
    path: '/edit',
    name: 'Edit',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/Edit.vue')
  },
  //legacy paths for compatibility reasons
  { path: '/edit.html', redirect: '/edit' }, 
  { path: '/recipe.html', redirect: '/recipe' }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
