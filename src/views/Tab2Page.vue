<template>
  <ion-page>
    <!-- ヘッダー -->
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('menu.videolist') }}</ion-title>
      </ion-toolbar>
      <ion-toolbar class="responsive-toolbar">
        <ion-accordion-group expand="compact">
          <ion-accordion value="controls">
            <ion-item slot="header" button>
              <ion-label>{{ $t('filter.controls') }}</ion-label>
            </ion-item>

            <div slot="content">
              <!-- 検索 -->
              <ion-toolbar>
                <ion-searchbar
                  v-model="searchQuery"
                  @ionInput="onSearch"
                  show-cancel-button="focus"
                  :placeholder="$t('menu.search')"
                  style="flex: 1; margin-right: 8px;"
                />
              </ion-toolbar>

              <!-- ソート・表示切替・フィルタ -->
              <ion-toolbar>
              <div class="toolbar-controls">
                <ion-select
                  v-model="selectedSort"
                  :placeholder="$t('sort.select')"
                  style="height: 40px; width: 120px; margin-left: 16px;"
                  @ionChange="onSortChange"
                >
                  <ion-select-option value="-publishedAt">{{ $t('sort.newest') }}</ion-select-option>
                  <ion-select-option value="-views">{{ $t('sort.views_desc') }}</ion-select-option>
                  <ion-select-option value="hot">{{ $t('sort.hot') }}</ion-select-option>
                  <ion-select-option value="-likes">{{ $t('sort.likes_desc') }}</ion-select-option>
                </ion-select>

                <!-- 表示モード切替ボタン -->
                <div class="mode-switch">
                  <ion-button
                    fill="clear"
                    :color="settingsStore.displayMode === 'list' ? 'primary' : 'medium'"
                    @click="settingsStore.setDisplayMode('list')"
                    :aria-label="$t('aria.switchToList')"
                  >                
                    <ion-icon :icon="list"></ion-icon>&nbsp;List
                  </ion-button>
                  <ion-button
                    fill="clear"
                    :color="settingsStore.displayMode === 'grid' ? 'primary' : 'medium'"
                    @click="settingsStore.setDisplayMode('grid')"
                    :aria-label="$t('aria.switchToGrid')"
                  >
                    <ion-icon :icon="grid"></ion-icon>&nbsp;Grid
                  </ion-button>
                </div>

                <!-- フィルターセグメント -->
                <ion-segment
                  v-model="filterMode"
                  @ionChange="onFilterChange"
                  style="height: 40px; width: 180px;"
                >
                  <ion-segment-button value="all">{{ $t('filter.all') }}</ion-segment-button>
                  <ion-segment-button value="local">{{ $t('filter.local') }}</ion-segment-button>
                </ion-segment>
              </div>
              </ion-toolbar>
            </div>
          </ion-accordion>
        </ion-accordion-group>
      </ion-toolbar>
    </ion-header>

    <!-- コンテンツ：リスト or グリッド -->
    <ion-content :fullscreen="true">
      <!-- リスト表示 -->
      <template v-if="settingsStore.displayMode === 'list'">
        <ion-list v-if="videos.length > 0">
          <ion-item
            v-for="video in videos"
            :key="video.uuid"
            button
            @click="goToVideo(video.uuid)"
          >
            <ion-thumbnail slot="start">
              <img
                :src="getThumbnailUrl(video.thumbnailPath)"
                :alt="video.name"
                loading="lazy"
                @error="onImageError"
              />
            </ion-thumbnail>
            <ion-label>
              <h2>{{ video.name }}</h2>
              <p>{{ video.channel.name }}</p>
            </ion-label>
          </ion-item>
        </ion-list>
      </template>

      <!-- グリッド表示 -->
      <template v-else>
        <div class="video-grid">
          <div
            v-for="video in videos"
            :key="video.uuid"
            class="video-card"
            @click="goToVideo(video.uuid)"
          >
            <ion-card>
              <img 
                :src="getThumbnailUrl(video.thumbnailPath)"
                :alt="video.name"
                loading="lazy"
                @error="onImageError"
              />
              <ion-card-header>
                <ion-card-title>{{ video.name }}</ion-card-title>
                <ion-card-subtitle>{{ video.channel.name }}</ion-card-subtitle>
              </ion-card-header>
            </ion-card>
          </div>
        </div>
      </template>

      <!-- 空状態メッセージ -->
      <div
        v-if="videos.length === 0"
        class="notion"
        style="white-space: pre-line;"
      >
        {{ errorMessage || $t('menu.getVideo') }}
      </div>
    </ion-content>

<!-- ページネーション -->
<ion-footer>
  <ion-toolbar>
    <div class="pagination-controls">
      <ion-button 
        @click="prevPage" 
        :disabled="currentPage === 1"
        :aria-label="$t('aria.prevPage')"
      >
        ＜
      </ion-button>
      <ion-input
        type="number"
        v-model.number="inputPage"
        :min="1"
        :max="totalPages"
        :placeholder="$t('menu.pageNumber')"
        :aria-label="$t('aria.pageNumberInput')"
        style="width: 80px; margin: 0 1rem; font-size: 1.2rem; text-align: center;"
      ></ion-input>
      <ion-button 
        @click="goToPage"
        :aria-label="$t('aria.goToPage')"
      >
        {{ $t('menu.pages') }}
      </ion-button>
      <ion-button 
        @click="nextPage" 
        :disabled="currentPage === totalPages"
        :aria-label="$t('aria.nextPage')"
      >
        ＞
      </ion-button>
    </div>
  </ion-toolbar>
</ion-footer>
</ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonSearchbar, IonToolbar, IonTitle, IonContent, IonFooter,
  IonButton, IonInput, IonList, IonItem, IonThumbnail, IonLabel,
  IonSelect, IonSelectOption, IonSegment, IonSegmentButton,
  IonAccordion, IonAccordionGroup, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle
} from '@ionic/vue';
import { ref, watch, computed } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';
import { useInstanceStore } from '@/stores/instanceStore';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import '../theme/variables.css';
import API from '@/api';
import { useAuthStore } from '@/stores/auth';
import { storeToRefs } from 'pinia';
import { grid, list } from 'ionicons/icons';

const authStore = useAuthStore();
const token = authStore.accessToken;

const router = useRouter();
const goToVideo = (videoId: string) => {
  router.push(`/tabs/video/${videoId}`);
};

const settingsStore = useSettingsStore();
const instanceStore = useInstanceStore();
const { t } = useI18n();
const { itemsPerPage } = storeToRefs(settingsStore);

const count = computed(() => settingsStore.itemsPerPage);
const videos = ref<any[]>([]);
const currentPage = ref(1);
const totalPages = ref(1);
const inputPage = ref(1);
const searchQuery = ref('');
const errorMessage = ref('');
const selectedSort = ref<string>('-publishedAt');
const filterMode = ref<'all' | 'local'>('all');

const refresh = () => {
  currentPage.value = 1;
  loadVideos(1, searchQuery.value, selectedSort.value, filterMode.value);
};

const onSearch = () => refresh();
const onSortChange = () => refresh();
const onFilterChange = () => refresh();

const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = '/placeholder.png';
  img.alt = t('aria.thumbnailNotAvailable'); // $t ではなく t を使う
};

const getThumbnailUrl = (path: string) =>
  `https://${instanceStore.selectedInstanceUrl}${path}`;

async function loadVideos(page: number, query = '', sort = selectedSort.value, filter = filterMode.value) {
  try {
    const start = (page - 1) * count.value;
    const params: any = { sort, start, count: count.value };
    if (filter === 'local') params.isLocal = true;
    if (query.trim()) params.search = query.trim();

    const res = await API.get(
      `https://${instanceStore.selectedInstanceUrl}/api/v1/videos`,
      { params, timeout: 10000 }
    );
    
    videos.value = res.data.data || [];
    totalPages.value = Math.ceil((res.data.total || 0) / count.value);
    currentPage.value = inputPage.value = page;
    errorMessage.value = '';
  } catch (e: any) {
    videos.value = [];
    totalPages.value = 1;
    currentPage.value = inputPage.value = 1;
    
    if (axios.isAxiosError(e)) {
      if (e.code === 'ECONNABORTED') {
        errorMessage.value = t('errors.timeout');
      } else if (e.response) {
        errorMessage.value = t('errors.httpError', { status: e.response.status, statusText: e.response.statusText });
      } else if (e.request) {
        errorMessage.value = t('errors.networkError');
      } else {
        errorMessage.value = t('errors.requestError');
      }
    } else {
      errorMessage.value = t('errors.unexpected');
    }
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    loadVideos(currentPage.value - 1, searchQuery.value, selectedSort.value, filterMode.value);
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    loadVideos(currentPage.value + 1, searchQuery.value, selectedSort.value, filterMode.value);
  }
};

const goToPage = () => {
  if (inputPage.value >= 1 && inputPage.value <= totalPages.value) {
    loadVideos(inputPage.value, searchQuery.value, selectedSort.value, filterMode.value);
  }
};

watch(
  () => instanceStore.selectedInstanceUrl,
  () => loadVideos(1, searchQuery.value, selectedSort.value, filterMode.value),
  { immediate: true }
);

watch(
  () => itemsPerPage.value,
  () => {
    currentPage.value = 1;
    loadVideos(currentPage.value, searchQuery.value, selectedSort.value, filterMode.value);
  },
  { immediate: false }
);
</script>

<style scoped>
.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
}
.pagination-controls ion-input {
  width: 80px;
  margin: 0 1rem;
}
.notion {
  margin-top: 1rem;
  margin-left: 1rem;
  font-size: 1.2rem;
}
.error-message {
  white-space: pre-wrap;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 0.1rem;
  padding: 0;
  font-size: 1rem;
}
@media (min-width: 768px) {
  .video-grid {
    grid-template-columns: repeat(5, minmax(100px, 1fr));
  }
}

.video-card {
  margin: 0;
  outline: 3px solid var(--video-outline-color);
  margin: 3px;
}
.video-card img {
  width: 100%;
  height: auto;
}

@media (min-width: 768px) {
  .video-card ion-card-title {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow: hidden;
    white-space: normal;
    margin: 0.2rem 0;
    line-height: 1.2;
    font-size: 1rem;
  }
}

ion-button {
  font-size: 1rem;
}
</style>