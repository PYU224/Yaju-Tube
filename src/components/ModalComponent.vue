<template>
  <ion-modal :is-open="isOpen" @did-dismiss="closeModal">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal">閉じる</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item v-if="mode === 'add'">
          <ion-label position="stacked">名前</ion-label>
          <ion-input v-model="name" placeholder="例: 野獣動画2nd"></ion-input>
        </ion-item>
        <ion-item>
          <ion-label position="stacked">URL</ion-label>
          <ion-input v-model="url" placeholder="例: 810video.com"></ion-input>
        </ion-item>
      </ion-list>
      <ion-button expand="full" @click="handleSave">保存</ion-button>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
} from '@ionic/vue';
import { ref } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  mode: 'add' | 'default';
  title: string;
}>();
const emit = defineEmits(['update:isOpen', 'save']);

const name = ref('');
const url = ref('');

const handleSave = () => {
  if (url.value.trim()) {
    const payload = props.mode === 'add'
      ? { name: name.value.trim(), url: url.value.trim() }
      : url.value.trim();
    emit('save', payload);
    name.value = '';
    url.value = '';
    emit('update:isOpen', false);
  }
};

const closeModal = () => {
  emit('update:isOpen', false);
};
</script>
