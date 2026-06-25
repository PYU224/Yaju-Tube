<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('menu.history') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="showClearConfirm" v-if="historyStore.history.length > 0">
            <ion-icon :icon="trashOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- 履歴が空の場合 -->
      <div v-if="historyStore.history.length === 0" class="empty-state">
        <ion-icon :icon="timeOutline" class="empty-icon"></ion-icon>
        <p>{{ $t('menu.noHistory') }}</p>
      </div>

      <!-- 履歴一覧 -->
      <div v-else>
        <!-- 今日 -->
        <div v-if="historyStore.groupedHistory.today.length > 0">
          <ion-list-header>
            <ion-label>{{ $t('history.today') }}</ion-label>
          </ion-list-header>
          <ion-list>
            <ion-item-sliding
              v-for="item in historyStore.groupedHistory.today"
              :key="item.videoId"
            >
              <ion-item button @click="goToVideo(item)">
                <ion-thumbnail slot="start">
                  <img
                    :src="getThumbnailUrl(item.thumbnailPath, item.instanceUrl)"
                    :alt="item.videoName"
                    loading="lazy"
                  />
                  <!-- 再生進行度バー -->
                  <div v-if="item.progress && item.duration" class="progress-bar">
                    <div 
                      class="progress-fill" 
                      :style="{ width: getProgressPercent(item) + '%' }"
                    ></div>
                  </div>
                </ion-thumbnail>
                <ion-label>
                  <h2>{{ item.videoName }}</h2>
                  <p>{{ item.channelName }}</p>
                  <p class="time-ago">{{ formatTimeAgo(item.watchedAt) }}</p>
                </ion-label>
              </ion-item>
              <ion-item-options side="end">
                <ion-item-option color="danger" @click="removeItem(item.videoId)">
                  {{ $t('menu.delete') }}
                </ion-item-option>
              </ion-item-options>
            </ion-item-sliding>
          </ion-list>
        </div>

        <!-- 昨日 -->
        <div v-if="historyStore.groupedHistory.yesterday.length > 0">
          <ion-list-header>
            <ion-label>{{ $t('history.yesterday') }}</ion-label>
          </ion-list-header>
          <ion-list>
            <ion-item-sliding
              v-for="item in historyStore.groupedHistory.yesterday"
              :key="item.videoId"
            >
              <ion-item button @click="goToVideo(item)">
                <ion-thumbnail slot="start">
                  <img
                    :src="getThumbnailUrl(item.thumbnailPath, item.instanceUrl)"
                    :alt="item.videoName"
                    loading="lazy"
                  />
                  <div v-if="item.progress && item.duration" class="progress-bar">
                    <div 
                      class="progress-fill" 
                      :style="{ width: getProgressPercent(item) + '%' }"
                    ></div>
                  </div>
                </ion-thumbnail>
                <ion-label>
                  <h2>{{ item.videoName }}</h2>
                  <p>{{ item.channelName }}</p>
                  <p class="time-ago">{{ formatTimeAgo(item.watchedAt) }}</p>
                </ion-label>
              </ion-item>
              <ion-item-options side="end">
                <ion-item-option color="danger" @click="removeItem(item.videoId)">
                  {{ $t('menu.delete') }}
                </ion-item-option>
              </ion-item-options>
            </ion-item-sliding>
          </ion-list>
        </div>

        <!-- 今週 -->
        <div v-if="historyStore.groupedHistory.thisWeek.length > 0">
          <ion-list-header>
            <ion-label>{{ $t('history.thisWeek') }}</ion-label>
          </ion-list-header>
          <ion-list>
            <ion-item-sliding
              v-for="item in historyStore.groupedHistory.thisWeek"
              :key="item.videoId"
            >
              <ion-item button @click="goToVideo(item)">
                <ion-thumbnail slot="start">
                  <img
                    :src="getThumbnailUrl(item.thumbnailPath, item.instanceUrl)"
                    :alt="item.videoName"
                    loading="lazy"
                  />
                  <div v-if="item.progress && item.duration" class="progress-bar">
                    <div 
                      class="progress-fill" 
                      :style="{ width: getProgressPercent(item) + '%' }"
                    ></div>
                  </div>
                </ion-thumbnail>
                <ion-label>
                  <h2>{{ item.videoName }}</h2>
                  <p>{{ item.channelName }}</p>
                  <p class="time-ago">{{ formatTimeAgo(item.watchedAt) }}</p>
                </ion-label>
              </ion-item>
              <ion-item-options side="end">
                <ion-item-option color="danger" @click="removeItem(item.videoId)">
                  {{ $t('menu.delete') }}
                </ion-item-option>
              </ion-item-options>
            </ion-item-sliding>
          </ion-list>
        </div>

        <!-- 今月 -->
        <div v-if="historyStore.groupedHistory.thisMonth.length > 0">
          <ion-list-header>
            <ion-label>{{ $t('history.thisMonth') }}</ion-label>
          </ion-list-header>
          <ion-list>
            <ion-item-sliding
              v-for="item in historyStore.groupedHistory.thisMonth"
              :key="item.videoId"
            >
              <ion-item button @click="goToVideo(item)">
                <ion-thumbnail slot="start">
                  <img
                    :src="getThumbnailUrl(item.thumbnailPath, item.instanceUrl)"
                    :alt="item.videoName"
                    loading="lazy"
                  />
                  <div v-if="item.progress && item.duration" class="progress-bar">
                    <div 
                      class="progress-fill" 
                      :style="{ width: getProgressPercent(item) + '%' }"
                    ></div>
                  </div>
                </ion-thumbnail>
                <ion-label>
                  <h2>{{ item.videoName }}</h2>
                  <p>{{ item.channelName }}</p>
                  <p class="time-ago">{{ formatTimeAgo(item.watchedAt) }}</p>
                </ion-label>
              </ion-item>
              <ion-item-options side="end">
                <ion-item-option color="danger" @click="removeItem(item.videoId)">
                  {{ $t('menu.delete') }}
                </ion-item-option>
              </ion-item-options>
            </ion-item-sliding>
          </ion-list>
        </div>

        <!-- それ以前 -->
        <div v-if="historyStore.groupedHistory.older.length > 0">
          <ion-list-header>
            <ion-label>{{ $t('history.older') }}</ion-label>
          </ion-list-header>
          <ion-list>
            <ion-item-sliding
              v-for="item in historyStore.groupedHistory.older"
              :key="item.videoId"
            >
              <ion-item button @click="goToVideo(item)">
                <ion-thumbnail slot="start">
                  <img
                    :src="getThumbnailUrl(item.thumbnailPath, item.instanceUrl)"
                    :alt="item.videoName"
                    loading="lazy"
                  />
                  <div v-if="item.progress && item.duration" class="progress-bar">
                    <div 
                      class="progress-fill" 
                      :style="{ width: getProgressPercent(item) + '%' }"
                    ></div>
                  </div>
                </ion-thumbnail>
                <ion-label>
                  <h2>{{ item.videoName }}</h2>
                  <p>{{ item.channelName }}</p>
                  <p class="time-ago">{{ formatDate(item.watchedAt) }}</p>
                </ion-label>
              </ion-item>
              <ion-item-options side="end">
                <ion-item-option color="danger" @click="removeItem(item.videoId)">
                  {{ $t('menu.delete') }}
                </ion-item-option>
              </ion-item-options>
            </ion-item-sliding>
          </ion-list>
        </div>
      </div>
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
  IonListHeader,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonLabel,
  IonThumbnail,
  IonIcon,
  IonButtons,
  IonButton,
  alertController
} from '@ionic/vue';
import { timeOutline, trashOutline } from 'ionicons/icons';
import { useHistoryStore } from '@/stores/historyStore';
import type { HistoryItem } from '@/stores/historyStore';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const historyStore = useHistoryStore();
const router = useRouter();
const { t } = useI18n();

// サムネイルURLを取得
const getThumbnailUrl = (path: string, instanceUrl: string) => {
  return `https://${instanceUrl}${path}`;
};

// 動画に移動
const goToVideo = (item: HistoryItem) => {
  // インスタンスURLを一時的に保存（動画再生用）
  sessionStorage.setItem('tempInstanceUrl', item.instanceUrl);
  router.push(`/tabs/video/${item.videoId}`);
};

// 再生進行度を取得
const getProgressPercent = (item: HistoryItem): number => {
  return (item.progress! / item.duration!) * 100;
};

// 時間の経過を表示（相対時間）
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return t('history.justNow');
  if (minutes < 60) return t('history.minutesAgo', { n: minutes });
  if (hours < 24) return t('history.hoursAgo', { n: hours });
  
  return formatDate(timestamp);
};

// 日付をフォーマット
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString();
};

// 履歴を削除
const removeItem = (videoId: string) => {
  historyStore.removeFromHistory(videoId);
};

// すべて削除確認
const showClearConfirm = async () => {
  const alert = await alertController.create({
    header: t('history.clearAll'),
    message: t('history.clearConfirm'),
    buttons: [
      {
        text: t('menu.cancel'),
        role: 'cancel'
      },
      {
        text: t('menu.delete'),
        role: 'destructive',
        handler: () => {
          historyStore.clearHistory();
        }
      }
    ]
  });

  await alert.present();
};
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

.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(0, 0, 0, 0.3);
}

.progress-fill {
  height: 100%;
  background: var(--ion-color-primary);
  transition: width 0.3s ease;
}

.time-ago {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-top: 0.25rem;
}

ion-thumbnail {
  position: relative;
  --size: 120px;
  --border-radius: 4px;
}
</style>
