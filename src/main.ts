import { createApp } from 'vue';
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
import {
  initializeAppSettings,
  registerFocusRestoration,
  watchThemeNativeChrome,
} from './appBootstrap';
import { useSettingsStore } from '@/stores/settingsStore';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App)
  .use(router)
  .use(pinia)
  .use(IonicVue, { innerHTMLTemplatesEnabled: true })
  .use(i18n)

registerFocusRestoration(router);

// アプリを初期化してからマウント
router.isReady().then(async () => {
  const settingsStore = useSettingsStore();

  await initializeAppSettings(settingsStore); // 言語設定を初期化
  app.mount('#app');

  // テーマ変更時の処理
  watchThemeNativeChrome(settingsStore);
});
