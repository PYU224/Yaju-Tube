<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';
import { useInstanceStore } from '@/stores/instanceStore';
import ModalComponent from '@/components/ModalComponent.vue';
import { useI18n } from 'vue-i18n';
import '../theme/variables.css';

import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonSelect, IonSelectOption, IonToggle, IonAlert } from '@ionic/vue';

const { t } = useI18n();

const settingsStore = useSettingsStore();
const instanceStore = useInstanceStore();

const isModalOpen = ref(false);
const modalMode = ref<'add' | 'default'>('add');
const modalTitle = computed(() => t(`modal.title.${modalMode.value}`));

const openModal = (mode: 'add' | 'default') => {
  modalMode.value = mode;
  isModalOpen.value = true;
};

const handleSave = (data: { name?: string; url: string }) => {
  if (modalMode.value === 'add') {
    const name = data.name?.trim() || data.url.trim();
    const url = data.url.trim().replace(/^https?:\/\//, '');
    instanceStore.addInstance({ name, url });
  } else if (modalMode.value === 'default') {
    const url = data.url.trim().replace(/^https?:\/\//, '');
    settingsStore.setDefaultInstanceUrl(url);
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
        <ion-title>{{ $t('menu.settings') }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item>
          <ion-label>{{ $t('menu.setItems') }}</ion-label>
          <ion-select v-model="settingsStore.itemsPerPage" interface="popover">
            <ion-select-option :value="10">10</ion-select-option>
            <ion-select-option :value="20">20</ion-select-option>
            <ion-select-option :value="30">30</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-label>{{ $t('menu.setThemes') }}</ion-label>
          <ion-select v-model="settingsStore.theme" @ionChange="settingsStore.setTheme($event.detail.value)" interface="popover">
            <ion-select-option v-for="theme in settingsStore.availableThemes" :key="theme" :value="theme">
              {{ theme }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-label>{{ $t('menu.setNotification') }}</ion-label>
          <ion-toggle v-model="settingsStore.notificationsEnabled"></ion-toggle>
        </ion-item>

        <ion-item @click="openModal('default')">{{ $t('menu.setDefaultInstance') }}</ion-item>
        <ion-item @click="openModal('add')">{{ $t('menu.addInstance') }}</ion-item>

        <ModalComponent
          :isOpen="isModalOpen"
          :modalType="modalMode"
          :title="modalTitle"
          @update:isOpen="isModalOpen = $event"
          @save="handleSave"
        />

        <ion-item>
          <ion-label>{{ $t('menu.setLanguage') }}</ion-label>
          <ion-select v-model="settingsStore.locale" @ionChange="settingsStore.changeLanguage($event.detail.value)" interface="popover">
            <ion-select-option value="ja">日本語</ion-select-option>
            <ion-select-option value="en">English</ion-select-option>
            <ion-select-option value="de">Deutsch</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item id="about-alert">{{ $t('menu.about') }}</ion-item>
        <ion-alert
          trigger="about-alert"
          header="Yaju-Tube"
          sub-header="Ver 1.3"
          message="<p>開発：PYU224</p><p>連絡先一覧：<br>https://linksta.cc/@pyu224 </p><p>ライセンス：GPL-3.0</p>"
          cssClass="custom-alert"
        ></ion-alert>
      </ion-list>
    </ion-content>
  </ion-page>
</template>
