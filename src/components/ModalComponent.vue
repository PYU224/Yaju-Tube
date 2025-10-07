<template>
  <ion-modal :is-open="isOpen" @didDismiss="closeModal">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
       <ion-item v-if="modalType === 'add'">
         <ion-label position="stacked">{{ $t('menu.inputName') }}</ion-label>
        <ion-input v-model="inputName" :placeholder="$t('menu.exampleName')"></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">{{ modalType === 'add' ? $t('menu.inputInstanceName') : $t('menu.inputInstanceUrl') }}</ion-label>
        <ion-input v-model="inputValue" :placeholder="$t('menu.exampleUrl')"></ion-input>
      </ion-item>
      <ion-button expand="block" @click="save">{{ $t('menu.inputSave') }}</ion-button>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonButton, IonButtons, IonInput, IonModal } from '@ionic/vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  modalType: 'add' | 'default';
  title: string;
}>();

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void;
  (e: 'save', value: { name?: string; url: string }): void;
}>();

const inputName = ref('');
const inputValue = ref('');

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      inputName.value = '';
      inputValue.value = '';
    }
  }
);

const closeModal = () => {
  emit('update:isOpen', false);
};

const save = () => {
  const normalizedUrl = inputValue.value
  .trim()
  .replace(/^https?:\/\//, '') // プロトコル削除
  .replace(/\/+$/, '') // 末尾スラッシュ削除
  .replace(/\/\/+/g, '/'); // 連続スラッシュを1つに

  if (props.modalType === 'add') {
    emit('save', {
      name: inputName.value.trim(),
      url: normalizedUrl,
    });
  } else {
    emit('save', {
      url: normalizedUrl,
    });
  }

  closeModal();
};
</script>
