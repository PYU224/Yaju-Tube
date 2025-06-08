import { createApp, nextTick } from 'vue';
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

const pinia = createPinia();

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
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && typeof activeElement.blur === 'function') {
      activeElement.blur();
    }
    document.body.tabIndex = 0;
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
});

router.isReady().then(() => {
  app.mount('#app');
});
