<template>
  <ion-page>
    <!-- ヘッダー: タイトルと検索バー -->
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('menu.videolist') }}</ion-title>
      </ion-toolbar>

<ion-toolbar>

  <ion-accordion-group expand="compact">
    <ion-accordion value="controls">
      <ion-item slot="header" button>
        <ion-label>{{ $t('filter.controls') }}</ion-label>
      </ion-item>

      <div slot="content">
        <ion-toolbar>
          <ion-searchbar
            v-model="searchQuery"
            @ionInput="onSearch"
            show-cancel-button="focus"
            :placeholder="$t('menu.search')"
            style="flex: 1; margin-right: 8px;"
          />
        </ion-toolbar>

        <ion-toolbar>
          <ion-select
            v-model="selectedSort"
            placeholder="{{ $t('sort.select') }}"
            style="height: 40px; width: 160px; margin-left: 8px;"
            @ionChange="onSortChange"
          >
            <ion-select-option value="-publishedAt">{{ $t('sort.newest') }}</ion-select-option>
            <ion-select-option value="-views">{{ $t('sort.views_desc') }}</ion-select-option>
            <ion-select-option value="hot">{{ $t('sort.hot') }}</ion-select-option>
            <ion-select-option value="-likes">{{ $t('sort.likes_desc') }}</ion-select-option>
          </ion-select>

          <ion-segment v-model="filterMode" @ionChange="onFilterChange" style="height: 40px; width: 180px;">
            <ion-segment-button value="all">{{ $t('filter.all') }}</ion-segment-button>
            <ion-segment-button value="local">{{ $t('filter.local') }}</ion-segment-button>
          </ion-segment>
        </ion-toolbar>
      </div>
    </ion-accordion>
  </ion-accordion-group>

</ion-toolbar>
    </ion-header>

    <!-- コンテンツ: 動画一覧 -->
    <ion-content :fullscreen="true">
      <ion-list v-if="videos.length > 0">
        <ion-item v-for="video in videos" :key="video.uuid" button @click="goToVideo(video.uuid)">
          <ion-thumbnail slot="start">
              <img
              :src="getThumbnailUrl(video.thumbnailPath)"
              @error="onImageError"
              />
          </ion-thumbnail>
          <ion-label>
            <h2>{{ video.name }}</h2>
            <p>{{ video.channel.name }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
      <div v-else class="notion" style="white-space: pre-line;">
        {{ errorMessage ||  $t('menu.getVideo')  }}
      </div>
    </ion-content>


    <ion-footer>
      <ion-toolbar>
        <div class="pagination-controls">
          <ion-button @click="prevPage" :disabled="currentPage === 1">＜</ion-button>
          <ion-input
            type="number"
            v-model.number="inputPage"
            :min="1"
            :max="totalPages"
            :placeholder="$t('menu.pageNumber')"
            style="width: 80px; margin: 0 1rem; font-size: 1.2rem; text-align: center;"
          ></ion-input>
          <ion-button @click="goToPage">{{ $t('menu.pages') }}</ion-button>
          <ion-button @click="nextPage" :disabled="currentPage === totalPages">＞</ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonSearchbar, IonToolbar, IonTitle, IonContent, IonFooter, IonButton, IonInput, IonList, IonItem, IonThumbnail, IonLabel, IonSelect, IonSelectOption, IonSegment, IonSegmentButton, IonAccordion, IonAccordionGroup } from '@ionic/vue';
import { ref, watch, computed, defineComponent  } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';
import { useInstanceStore } from '@/stores/instanceStore';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import '../theme/variables.css';
import API from '@/api';

// コンポーネント内での使用例
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const token = authStore.accessToken;

// 動画再生部分
const router = useRouter();
const goToVideo = (videoId: string) => {
  router.push(`/tabs/video/${videoId}`);
};

const settingsStore = useSettingsStore();
const instanceStore = useInstanceStore();

const { t } = useI18n();

const count = computed(() => settingsStore.itemsPerPage);
const videos = ref<any[]>([]);
const currentPage = ref(1);
const totalPages = ref(1);
const inputPage = ref(1);
const searchQuery = ref('');
const errorMessage = ref('');

const selectedSort = ref<string>('-publishedAt');
const filterMode = ref<'all' | 'local'>('all');

// 検索・ソート・フィルター変更の共通ハンドラー
const refresh = () => {
  currentPage.value = 1;
  loadVideos(1, searchQuery.value, selectedSort.value, filterMode.value);
};

const onSearch = () => refresh();
const onSortChange = () => refresh();
const onFilterChange = () => refresh();
const onImageError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  target.src = '/placeholder.png'; // プレースホルダー画像のURLを指定
};
const getThumbnailUrl = (path: string) => {
  return `https://${instanceStore.selectedInstanceUrl}${path}`;
};

async function loadVideos(
  page: number,
  query = '',
  sort = selectedSort.value,
  filter = filterMode.value
) {
  try {
    const start = (page - 1) * count.value;
    const params: any = { sort, start, count: count.value };

if (filter === 'local') {
  params.isLocal = true;
}
if (query.trim()) {
  params.search = query.trim();
}

    const res = await API.get(
      `https://${instanceStore.selectedInstanceUrl}/api/v1/videos`,
      { params }
    );
    videos.value = res.data.data;
    totalPages.value = Math.ceil(res.data.total / count.value);
    currentPage.value = inputPage.value = page;
    errorMessage.value = '';
  } catch (e: any) {
    videos.value = [];
    totalPages.value = 1;
    currentPage.value = inputPage.value = 1;

    if (axios.isAxiosError(e)) {
      if (e.response) {
        errorMessage.value = `エラーが発生しました: ${e.response.status} ${e.response.statusText}`;
      } else if (e.request) {
        errorMessage.value = "サーバーからの応答がありません。";
      } else {
        errorMessage.value = `リクエスト設定中にエラーが発生: ${e.message}`;
      }
    } else {
      errorMessage.value = `予期しないエラー: ${e.message}`;
    }
    console.error('動画取得失敗:', e);
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    loadVideos(
      currentPage.value,
      searchQuery.value,
      selectedSort.value,
      filterMode.value
    );
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    loadVideos(
      currentPage.value,
      searchQuery.value,
      selectedSort.value,
      filterMode.value
    );
  }
};

const goToPage = () => {
  if (inputPage.value >= 1 && inputPage.value <= totalPages.value) {
    currentPage.value = inputPage.value;
    loadVideos(
      currentPage.value,
      searchQuery.value,
      selectedSort.value,
      filterMode.value
    );
  }
};

watch(
  () => instanceStore.selectedInstanceUrl,
  () => {
    currentPage.value = 1;
    loadVideos(
      currentPage.value,
      searchQuery.value,
      selectedSort.value,
      filterMode.value
    );
  },
  { immediate: true }
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

.notion{
  margin-top: 1rem;
  margin-left: 1rem;
  font-size: 1.2rem;
}

.error-message {
  white-space: pre-wrap;
}
</style>