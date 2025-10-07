// stores/instanceStore.ts
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useInstanceStore = defineStore('instanceStore', () => {
  const defaultInstanceUrl = ref('810video.com');
  const instances = ref<{ name: string; url: string }[]>([]);
  const selectedInstanceUrl = ref<string>(defaultInstanceUrl.value);

  // ローカルストレージからインスタンスを読み込む
  const loadInstances = () => {
    const saved = localStorage.getItem('instances');
    if (saved) {
      instances.value = JSON.parse(saved);
    }
  };

  // インスタンスを追加する
  const addInstance = (instance: { name: string; url: string }) => {
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
    defaultInstanceUrl,
    selectedInstanceUrl,
  };
});
