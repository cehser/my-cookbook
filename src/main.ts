import { createApp } from 'vue'
import App from './App.vue'

import router from './router'
import store from './store'

// Import Bootstrap and BootstrapVueNext CSS files
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

const app = createApp(App)

app.use(router)
app.use(store)

app.mount('#app')
