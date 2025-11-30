import { createRouter, createWebHistory } from 'vue-router'
import Gallery from '@/views/Gallery.vue'


const routes = [
  {
    path: '/',
    name: 'Gallery',
    component: Gallery
  },
  { 
    path: '/recipe/:selected', 
    component: () => import(/* webpackChunkName: "recipe" */ '../views/Recipe.vue'),
    props: (route) => {
      const selected = Number.parseInt(route.params.selected, 10)
      if (Number.isNaN(selected)) {
        return 0
      }
      return { selected }
    }
  },
  { 
    path: '/edit/:selected', 
    component: () => import(/* webpackChunkName: "edit" */ '../views/Edit.vue'),
    props: (route) => {
      const selected = Number.parseInt(route.params.selected, 10)
      if (Number.isNaN(selected)) {
        return 0
      }
      return { selected }
    }
  },
  { 
    path: '/settings', 
    component: () => import(/* webpackChunkName: "settings" */ '../views/Settings.vue'),
  },
  { 
    path: '/administration', 
    component: () => import(/* webpackChunkName: "settings" */ '../views/Administration.vue'),
  },
  //legacy paths for compatibility reasons
  { path: '/edit.html', redirect: '/edit/0' }, 
  { path: '/edit', redirect: '/edit/0' },
  { path: '/recipe.html', redirect: '/recipe' },
  { path: '/recipe', redirect: '/recipe/0' }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
