<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';
import { useInstanceStore } from '@/stores/instanceStore';
import ModalComponent from '@/components/ModalComponent.vue';
import { useRoute } from 'vue-router';
import '../theme/variables.css';

const route = useRoute();
const settingsStore = useSettingsStore();
const instanceStore = useInstanceStore();

const instanceUrl = route.params.instanceUrl as string || settingsStore.defaultInstanceUrl;

const isModalOpen = ref(false);
const modalMode = ref<'add' | 'default'>('add');
const modalTitle = ref('インスタンスを追加');

const openModal = (mode: 'add' | 'default') => {
  modalMode.value = mode;
  modalTitle.value = mode === 'add' ? 'インスタンスを追加' : 'デフォルトインスタンスURLを設定';
  isModalOpen.value = true;
};

const handleSave = (data: any) => {
  if (modalMode.value === 'add') {
    instanceStore.addInstance(data);
  } else if (modalMode.value === 'default') {
    settingsStore.setDefaultInstanceUrl(data);
  }
};

onMounted(() => {
  document.body.setAttribute('data-theme', settingsStore.theme);
});
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>設定</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item>
          <ion-label>表示件数</ion-label>
          <ion-select v-model="settingsStore.itemsPerPage" interface="popover">
            <ion-select-option :value="10">10</ion-select-option>
            <ion-select-option :value="20">20</ion-select-option>
            <ion-select-option :value="30">30</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-label>テーマ</ion-label>
            <ion-select v-model="settingsStore.theme" @ionChange="settingsStore.setTheme($event.detail.value)" interface="popover">
            <ion-select-option v-for="theme in settingsStore.availableThemes" :key="theme" :value="theme">
              {{ theme }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-label>通知</ion-label>
          <ion-toggle v-model="settingsStore.notificationsEnabled"></ion-toggle>
        </ion-item>

        <ion-item @click="openModal('default')">デフォルトインスタンスURLを設定</ion-item>
        <ion-item @click="openModal('add')">インスタンスを追加する</ion-item>
        <ModalComponent
          :isOpen="isModalOpen"
          :mode="modalMode"
          :title="modalTitle"
          @update:isOpen="isModalOpen = $event"
          @save="handleSave"
        />

        <ion-item id="about-alert">このアプリについて</ion-item>
        <ion-alert
          trigger="about-alert"
          header="Yaju-Tube"
          sub-header="Ver 0.1"
          message="<p>開発：PYU224</p><p>連絡先一覧：<br>https://linksta.cc/@pyu224 </p><p>ライセンス：GPL-3.0（予定）</p>"
          cssClass="color-change"
        ></ion-alert>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonSelect, IonSelectOption, IonToggle, IonAlert } from '@ionic/vue';

const settingsStore = useSettingsStore();
const isModalOpen = ref(false);
const newInstanceUrl = ref('');

// instanceUrl を使用して動画一覧を取得・表示する処理を追加

</script>
