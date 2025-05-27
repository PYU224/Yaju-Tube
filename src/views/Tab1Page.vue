<script setup lang="ts">
import { useInstanceStore } from '@/stores/instanceStore';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
} from '@ionic/vue';
import { useRouter } from 'vue-router';
import '../theme/variables.css';

const router = useRouter();
const instanceStore = useInstanceStore();

const deleteInstance = (url: string) => {
  instanceStore.removeInstance(url);
};

const selectInstance = (url: string) => {
  instanceStore.selectedInstanceUrl = url;
  router.push('/tabs/tab2');
};
</script>


<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>インスタンス一覧</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item-sliding
          v-for="instance in instanceStore.instances" :key="instance.url" 
        >
          <ion-item button @click="selectInstance(instance.url)">
            <ion-label>{{ instance.name }}</ion-label>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" @click="deleteInstance(instance.url)">
              削除
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>
    </ion-content>
  </ion-page>
</template>
