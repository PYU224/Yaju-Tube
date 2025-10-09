import { createApp, nextTick, watch } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import App from './App.vue';
import router from './router';
import { IonicVue } from '@ionic/vue';
import { Capacitor } from '@capacitor/core'
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

// 🆕 デバイス言語取得ユーティリティをインポート
import { getInitialLocale } from './utils/locale';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App)
  .use(router)
  .use(pinia)
  .use(IonicVue, { innerHTMLTemplatesEnabled: true })
  .use(i18n)

import { useSettingsStore } from '@/stores/settingsStore';

// 🆕 アプリ起動時にデバイス言語を設定
async function initializeApp() {
  const settingsStore = useSettingsStore();
  
  // テーマ設定
  document.body.setAttribute('data-theme', settingsStore.theme);
  
  // 🆕 言語設定の初期化
  const initialLocale = await getInitialLocale();
  
  // settingsStoreに保存されている言語と異なる場合のみ更新
  if (settingsStore.locale !== initialLocale) {
    settingsStore.changeLanguage(initialLocale);
  } else {
    // 既に正しい言語が設定されている場合もi18nに反映
    i18n.global.locale.value = settingsStore.locale as 'ja' | 'en' | 'de';
  }
  
  console.log('App initialized with locale:', settingsStore.locale);
}

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

async function applyNavBarColor(theme: string) {
  const isLight = theme === 'light' || theme === 'sepia';
  const backgroundColor = isLight ? '#EEEEEE' : '#222222';

  if (Capacitor.getPlatform() === 'android') {
    try {
      await EdgeToEdge.setBackgroundColor({ color: backgroundColor });
    } catch (e) {
      console.error('EdgeToEdgeエラー:', e);
    }
  }

  if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
    try {
      await StatusBar.setStyle({ style: isLight ? Style.Dark : Style.Light });
      await StatusBar.setOverlaysWebView({ overlay: true });
    } catch (e) {
      console.error('StatusBarエラー:', e);
    }
  }
}

// 🆕 アプリを初期化してからマウント
router.isReady().then(async () => {
  await initializeApp(); // 言語設定を初期化
  app.mount('#app');
  
  const settingsStore = useSettingsStore();
  
  // テーマ変更時の処理
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
});