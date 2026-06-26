<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom" id="app-tab-bar">
        <ion-tab-button tab="tab1" href="/tabs/tab1">
          <ion-icon :icon="list" />
          <ion-label>Instances</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="tab2" href="/tabs/tab2">
          <ion-icon :icon="play" />
          <ion-label>Contents</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="tab6" href="/tabs/tab6">
          <ion-icon :icon="cloudUpload" />
          <ion-label>Upload</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="tab4" href="/tabs/tab4">
          <ion-icon :icon="time" />
          <ion-label>History</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="tab5" href="/tabs/tab5">
          <ion-icon :icon="bookmarks" />
          <ion-label>Playlist</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="tab3" href="/tabs/tab3">
          <ion-icon :icon="settings" />
          <ion-label>Options</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { bookmarks, cloudUpload, list, play, settings, time } from 'ionicons/icons';
</script>
