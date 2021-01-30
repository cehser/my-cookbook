import Vue from 'vue'
import VueRouter from 'vue-router'
import Gallery from '@/views/Gallery.vue'


Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Gallery',
    component: Gallery
  },
  {
    path: '/recipe',
    name: 'Recipe',
    component: () => import(/* webpackChunkName: "recipe" */ '../views/Recipe.vue')
  },
  { path: '/recipe/:id', component: () => import(/* webpackChunkName: "recipe" */ '../views/Recipe.vue') },
  {
    path: '/edit',
    name: 'Edit',
    // route level code-splitting
    // this generates a separate chunk (edit.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "edit" */ '../views/Edit.vue')
  },
  { path: '/edit/:id', component: () => import(/* webpackChunkName: "edit" */ '../views/Edit.vue') },
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
