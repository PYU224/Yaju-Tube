<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('menu.playlist') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            aria-label="import-playlist"
            @click="showImportDialog"
          >
            <ion-icon :icon="cloudUploadOutline"></ion-icon>
          </ion-button>
          <ion-button
            v-if="playlistStore.playlist.length > 0"
            aria-label="export-playlist"
            @click="showExportDialog"
          >
            <ion-icon :icon="downloadOutline"></ion-icon>
          </ion-button>
          <ion-button
            v-if="playlistStore.playlist.length > 0"
            aria-label="clear-playlist"
            @click="showClearConfirm"
          >
            <ion-icon :icon="trashOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div
        v-if="importError"
        class="import-error"
      >
        {{ importError }}
      </div>

      <div
        v-if="playlistStore.playlist.length === 0"
        class="empty-state"
      >
        <ion-icon
          :icon="albumsOutline"
          class="empty-icon"
        ></ion-icon>
        <p>{{ $t('playlist.empty') }}</p>
      </div>

      <ion-list v-else>
        <ion-item-sliding
          v-for="item in playlistStore.playlist"
          :key="`${item.instanceUrl}/${item.videoId}`"
        >
          <ion-item
            button
            @click="goToVideo(item)"
          >
            <ion-thumbnail slot="start">
              <img
                v-if="item.thumbnailPath"
                :src="getThumbnailUrl(item.thumbnailPath, item.instanceUrl)"
                :alt="item.videoName"
                loading="lazy"
              />
              <div
                v-else
                class="thumbnail-fallback"
                aria-hidden="true"
              >
                <ion-icon :icon="albumsOutline"></ion-icon>
              </div>
            </ion-thumbnail>
            <ion-label>
              <h2>{{ item.videoName }}</h2>
              <p>{{ item.channelName }}</p>
              <p class="instance-url">{{ item.instanceUrl }}</p>
            </ion-label>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option
              color="danger"
              @click="removeItem(item)"
            >
              {{ $t('menu.delete') }}
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonLabel,
  IonThumbnail,
  IonIcon,
  IonButtons,
  IonButton,
  alertController,
} from '@ionic/vue'
import {
  albumsOutline,
  cloudUploadOutline,
  downloadOutline,
  trashOutline,
} from 'ionicons/icons'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  type PlaylistExportSettings,
  type PlaylistItem,
  usePlaylistStore,
} from '@/stores/playlistStore'
import { useSettingsStore } from '@/stores/settingsStore'

const playlistStore = usePlaylistStore()
const settingsStore = useSettingsStore()
const router = useRouter()
const { t } = useI18n()
const importError = ref('')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPlaylistJson(data: unknown): string {
  if (isRecord(data) && typeof data['playlistJson'] === 'string') {
    return data['playlistJson']
  }

  return ''
}

function currentExportSettings(): PlaylistExportSettings {
  return {
    defaultInstanceUrl: settingsStore.defaultInstanceUrl,
    displayMode: settingsStore.displayMode,
    itemsPerPage: settingsStore.itemsPerPage,
    locale: settingsStore.locale,
    theme: settingsStore.theme,
  }
}

function applyImportedSettings(settings: PlaylistExportSettings) {
  settingsStore.setDefaultInstanceUrl(settings.defaultInstanceUrl)
  settingsStore.setDisplayMode(settings.displayMode)
  settingsStore.itemsPerPage = settings.itemsPerPage
  settingsStore.changeLanguage(settings.locale)
  settingsStore.setTheme(settings.theme)
}

function getThumbnailUrl(path: string, instanceUrl: string) {
  return `https://${instanceUrl}${path}`
}

function goToVideo(item: PlaylistItem) {
  sessionStorage.setItem('tempInstanceUrl', item.instanceUrl)
  router.push(`/tabs/video/${item.videoId}`)
}

function removeItem(item: PlaylistItem) {
  playlistStore.removeFromPlaylist(item.videoId, item.instanceUrl)
}

async function showExportDialog() {
  const exportData = playlistStore.exportPlaylist(currentExportSettings())
  const alert = await alertController.create({
    header: t('playlist.exportTitle'),
    inputs: [
      {
        name: 'playlistJson',
        type: 'textarea',
        value: JSON.stringify(exportData, null, 2),
      },
    ],
    buttons: [
      {
        text: t('menu.cancel'),
        role: 'cancel',
      },
    ],
  })

  await alert.present()
}

async function showImportDialog() {
  const alert = await alertController.create({
    header: t('playlist.importTitle'),
    message: t('playlist.importHelp'),
    inputs: [
      {
        name: 'playlistJson',
        type: 'textarea',
        placeholder: t('playlist.importPlaceholder'),
      },
    ],
    buttons: [
      {
        text: t('menu.cancel'),
        role: 'cancel',
      },
      {
        text: t('playlist.import'),
        role: 'confirm',
        handler: (data: unknown) => {
          try {
            const importedSettings = playlistStore.importPlaylist(readPlaylistJson(data))
            applyImportedSettings(importedSettings)
            importError.value = ''
          } catch {
            importError.value = t('playlist.importError')
          }
        },
      },
    ],
  })

  await alert.present()
}

async function showClearConfirm() {
  const alert = await alertController.create({
    header: t('playlist.clearAll'),
    message: t('playlist.clearConfirm'),
    buttons: [
      {
        text: t('menu.cancel'),
        role: 'cancel',
      },
      {
        text: t('menu.delete'),
        role: 'destructive',
        handler: () => {
          playlistStore.clearPlaylist()
        },
      },
    ],
  })

  await alert.present()
}
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.import-error {
  margin: 1rem;
  padding: 0.75rem;
  color: var(--ion-color-danger);
  border: 1px solid var(--ion-color-danger);
  border-radius: 4px;
}

.instance-url {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-top: 0.25rem;
}

.thumbnail-fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--ion-color-medium);
  background: var(--ion-color-light);
}

ion-thumbnail {
  --size: 120px;
  --border-radius: 4px;
}
</style>
