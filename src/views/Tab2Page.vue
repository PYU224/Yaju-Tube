<template>
  <ion-page>
    <!-- ヘッダー: タイトルと検索バー -->
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('menu.videolist') }}</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="searchQuery" @ionInput="onSearch" show-cancel-button="focus" :placeholder="$t('menu.search')" style="font-size: 1.2rem; text-align: center;"></ion-searchbar>
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
import { IonPage, IonHeader, IonSearchbar, IonToolbar, IonTitle, IonContent, IonFooter, IonButton, IonInput, IonList, IonItem, IonThumbnail, IonLabel } from '@ionic/vue';
import { ref, watch, computed } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';
import { useInstanceStore } from '@/stores/instanceStore';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import '../theme/variables.css';

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

const onImageError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  target.src = '/placeholder.png'; // プレースホルダー画像のURLを指定
};
const getThumbnailUrl = (path: string) => {
  return `https://${instanceStore.selectedInstanceUrl}${path}`;
};

async function loadVideos(page: number, query: string = '') {
  try {
    const start = (page - 1) * count.value;
    const params: any = {
      sort: '-publishedAt',
      start: start,
      count: count.value,
    };
    if (query.trim() !== '') {
      params.search = query;
    }
    const response = await axios.get(`https://${instanceStore.selectedInstanceUrl}/api/v1/videos`, { params });
    videos.value = response.data.data;
    const totalItems = response.data.total;
    totalPages.value = Math.ceil(totalItems / count.value);
    errorMessage.value = '';
  } catch (error: any) {
    videos.value = [];
    totalPages.value = 1;
    currentPage.value = 1;

    if (axios.isAxiosError(error)) {
      if (error.response) {
        errorMessage.value = `エラーが発生しました: ${error.response.status} ${error.response.statusText}`;
      } else if (error.request) {
        errorMessage.value = "サーバーからの応答がありません。\nインスタンスのURLが正しいか確認してください。";
      } else {
        errorMessage.value = `リクエストの設定中にエラーが発生しました: ${error.message}`;
      }
    } else {
      errorMessage.value = `予期しないエラーが発生しました: ${error.message}`;
    }

    console.error('動画の取得に失敗しました:', error);
  }
}

const onSearch = () => {
  currentPage.value = 1;
  loadVideos(currentPage.value, searchQuery.value);
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    loadVideos(currentPage.value, searchQuery.value);
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    loadVideos(currentPage.value, searchQuery.value);
  }
};

const goToPage = () => {
  if (inputPage.value >= 1 && inputPage.value <= totalPages.value) {
    currentPage.value = inputPage.value;
    loadVideos(currentPage.value, searchQuery.value);
  }
};

watch(
  () => instanceStore.selectedInstanceUrl,
  () => {
    currentPage.value = 1;
    loadVideos(currentPage.value, searchQuery.value);
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