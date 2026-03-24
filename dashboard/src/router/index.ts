import { createRouter, createWebHistory } from 'vue-router'
import OpsDashboardView from '../views/OpsDashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'ops',
      component: OpsDashboardView,
    },
  ],
})

export default router
