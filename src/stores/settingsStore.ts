// stores/settingsStore.ts
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: 'light',
    availableThemes: ['light', 'dark', 'sepia', 'grape'],
    language: 'ja',
    notificationsEnabled: true,
    itemsPerPage: 20,
    defaultInstanceUrl: '810video.com', // 追加

    instances: [] as string[],
  }),
  actions: {
    setTheme(newTheme: string) {
      this.theme = newTheme;
      document.body.setAttribute('data-theme', newTheme);
    },
    setLanguage(newLanguage: string) {
      this.language = newLanguage;
    },
    toggleNotifications() {
      this.notificationsEnabled = !this.notificationsEnabled;
    },
    setItemsPerPage(newItemsPerPage: number) {
      this.itemsPerPage = newItemsPerPage;
    },

    setDefaultInstanceUrl(url: string) {
      const normalizedUrl = url.trim().replace(/^https?:\/\//, '');
      this.defaultInstanceUrl = normalizedUrl;
      const instanceStore = useInstanceStore();
      if (!instanceStore.instances.some(instance => instance.url === normalizedUrl)) {
        instanceStore.addInstance({ name: normalizedUrl, url: normalizedUrl });
      }
    },
    addInstance(url: string) {
      const normalizedUrl = url.trim().replace(/^https?:\/\//, '');
      if (!this.instances.includes(normalizedUrl)) {
        this.instances.push(normalizedUrl);
      }
    },
    removeInstance(url: string) {
      this.instances = this.instances.filter(instance => instance !== url);
    },
  },
  persist: true,
});

export const useInstanceStore = defineStore('instanceStore', () => {
  const instances = ref<{ name: string; url: string }[]>([]);

  // ローカルストレージからインスタンスを読み込む
  const loadInstances = () => {
    const saved = localStorage.getItem('instances');
    if (saved) {
      instances.value = JSON.parse(saved);
    }
  };

  // インスタンスを追加する
  const addInstance = (instance: { name: string; url: string }) => {
    // 重複チェック
    if (!instances.value.some(i => i.url === instance.url)) {
      instances.value.push(instance);
    }
  };

  // インスタンスを削除する
  const removeInstance = (url: string) => {
    instances.value = instances.value.filter(i => i.url !== url);
  };

  // インスタンスの変更をローカルストレージに保存
  watch(instances, (newVal) => {
    localStorage.setItem('instances', JSON.stringify(newVal));
  }, { deep: true });

  // 初期化時にインスタンスを読み込む
  loadInstances();

  return {
    instances,
    addInstance,
    removeInstance,
  };
});
