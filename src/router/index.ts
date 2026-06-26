import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import TabsPage from '../views/TabsPage.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/tab2' // デフォルトは動画一覧
  },
  {
    path: '/tabs',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/tab2'
      },
      {
        path: 'tab1',
        component: () => import('@/views/Tab1Page.vue')
      },
      {
        path: 'tab2',
        component: () => import('@/views/Tab2Page.vue')
      },
      {
        path: 'tab3',
        component: () => import('@/views/Tab3Page.vue')
      },
      {
        path: 'tab4', // 🆕 視聴履歴タブ追加
        component: () => import('@/views/Tab4Page.vue')
      },
      {
        path: 'tab5',
        component: () => import('@/views/Tab5Page.vue')
      },
      {
        path: 'tab6',
        component: () => import('@/views/UploadPage.vue')
      },
      {
        path: 'video/:videoId',
        component: () => import('@/views/VideoPlayerPage.vue'),
        props: true
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
