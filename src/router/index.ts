import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Gallery from '@/views/Gallery.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Gallery',
    component: Gallery
  },
  {
    path: '/favorites',
    name: 'Favorites',
    component: Gallery // Temporär: Nutzt Gallery-Komponente, später eigene View oder Query-Parameter
  },
  {
    path: '/search',
    name: 'Search',
    component: Gallery // Temporär: Nutzt Gallery-Komponente mit Fokus auf Suchleiste
  },
  { 
    path: '/recipe/:selected', 
    name: 'Recipe',
    component: () => import(/* webpackChunkName: "recipe" */ '../views/Recipe.vue'),
    props: (route) => {
      const selected = Number.parseInt(route.params.selected as string, 10)
      if (Number.isNaN(selected)) {
        return { selected: 0 }
      }
      return { selected }
    }
  },
  { 
    path: '/edit/:selected',
    name: 'Edit',
    component: () => import(/* webpackChunkName: "edit" */ '../views/Edit.vue'),
    props: (route) => {
      const selected = Number.parseInt(route.params.selected as string, 10)
      if (Number.isNaN(selected)) {
        return { selected: 0 }
      }
      return { selected }
    }
  },
  { 
    path: '/settings',
    name: 'Settings',
    component: () => import(/* webpackChunkName: "settings" */ '../views/Settings.vue'),
  },
  { 
    path: '/administration',
    name: 'Administration',
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
