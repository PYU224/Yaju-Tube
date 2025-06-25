import { createApp, nextTick, watch } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import App from './App.vue';
import router from './router';
import { IonicVue } from '@ionic/vue';
/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/* Theme variables */
import './theme/variables.css';

import i18n from './i18n'
// ナビゲーションバーへのめり込み防止 
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';
import { StatusBar, Style } from '@capacitor/status-bar';

// ナビゲーションバーへのめり込み防止 
// await EdgeToEdge.setBackgroundColor({ color: '#000000' });

const pinia = createPinia();
;
const app = createApp(App)
  .use(router)

pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(IonicVue, { innerHTMLTemplatesEnabled: true });
app.use(i18n)

import { useSettingsStore } from '@/stores/settingsStore';
const settingsStore = useSettingsStore();
document.body.setAttribute('data-theme', settingsStore.theme);

router.afterEach(() => {
  nextTick(() => {
    try {
      const active = document.activeElement as HTMLElement | null;
      if (active?.blur) active.blur();
      document.body.tabIndex = 0;
      document.body.focus();
      document.body.removeAttribute('tabindex');
    } catch (e) {
      console.error('afterEach の DOM 操作で例外:', e);
    }
  });
});

router.isReady().then(() => {
  app.mount('#app');
});

async function applyNavBarColor(theme: string) {
  const isLight = theme === 'light' || theme === 'sepia';
  const backgroundColor = isLight ? '#EEEEEE' : '#222222';

  if (Capacitor.getPlatform() === 'android') {
    try {
    // 両バーへ同時に色適用
      await EdgeToEdge.setBackgroundColor({ color: backgroundColor });
    } catch (e) {
      console.error('EdgeToEdgeエラー:', e);
    }
  }

  if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
    try {
    // ステータスバーテキスト色調整
      await StatusBar.setStyle({ style: isLight ? Style.Dark : Style.Light });
      await StatusBar.setOverlaysWebView({ overlay: true });
    } catch (e) {
      console.error('StatusBarエラー:', e);
    }
  }
}
// テーマ変更時にも呼び出し
watch(
  () => settingsStore.theme,
  async (theme) => {
    try {
      await applyNavBarColor(theme);
    } catch (err) {
      console.error('ナビバーの色設定に失敗しました:', err);
    }
  },
  { immediate: true }
);
