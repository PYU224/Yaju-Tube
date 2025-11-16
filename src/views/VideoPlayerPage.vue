<template>
  <ion-page>
    <ion-header v-if="!isFullScreen">
      <ion-toolbar>
        <ion-title>{{ video?.name || $t('menu.videolist') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="video" class="iframeWrap">
        <iframe
          ref="iframeRef"
          :src="getEmbedUrl(video.uuid)"
          width="100%"
          height="360"
          frameborder="0"
          allowfullscreen
          @load="handleVideoLoad"
        ></iframe>
        <p>
          <!-- 動画説明文 -->
          <div v-if="descHtml" class="description" v-html="descHtml"></div>
          <div v-else-if="video" class="description">{{ $t('menu.getLoading') }}</div>
        </p>
      </div>
      <div v-else class="notion">
        {{ errorMessage || $t('menu.getVideoInfo') }}
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue';
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { useInstanceStore } from '@/stores/instanceStore';
import { PeerTubePlayer } from '@peertube/embed-api';
import { marked } from 'marked';
import { useI18n } from 'vue-i18n';
import { sanitizeHtml } from '@/utils/sanitize'; // 🆕 統一されたサニタイズ関数を使用
import '../theme/variables.css';
// 動画画面の向き設定
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';

const route = useRoute();
const instanceStore = useInstanceStore();
const { t } = useI18n();

const video = ref<any>(null);
const isPlaying = ref(false);
const isFullScreen = ref(false);
let player: PeerTubePlayer | null = null;
const iframeRef = ref<HTMLIFrameElement | null>(null);

// 動画説明文
const descHtml = ref<string>('');
const errorMessage = ref<string>(''); // 🆕 エラーメッセージ用

const getEmbedUrl = (uuid: string) => {
  return `https://${instanceStore.selectedInstanceUrl}/videos/embed/${uuid}`;
};

const handleVideoLoad = () => {
  isPlaying.value = true;
};

// 全画面追加解除時に呼ばれる
const onFullScreenChange = async () => {
  const fs = document.fullscreenElement || (document as any).webkitFullscreenElement;
  const isFS = !!fs;

  if (Capacitor.getPlatform() !== 'web') {
    try {
      await ScreenOrientation.lock({ orientation: isFS ? 'landscape' : 'portrait' });
    } catch (e) {
      // 向き制御失敗は致命的ではないので、エラーを表示しない
    }
  } else {
    try {
      const orientation = window.screen.orientation as any;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock(isFS ? 'landscape-primary' : 'portrait-primary');
      }
    } catch (e) {
      // ブラウザでの向き制御失敗は想定内
    }
  }
};

// 動画情報と説明文を取得
async function fetchVideo() {
  try {
    const vid = route.params.videoId as string;
    const resp = await axios.get(
      `https://${instanceStore.selectedInstanceUrl}/api/v1/videos/${vid}`,
      { timeout: 10000 }
    );
    
    video.value = resp.data;

    // 説明文を処理
    const rawDesc = resp.data.description || '';

    if (rawDesc.trim()) {
      try {
        // 1. Markdown → HTML
        let html = await marked(rawDesc);
        
        // 2. 改行を <br> に変換
        html = html.replace(/\n+/g, '<br>');
        
        // 3. 🆕 統一されたサニタイズ関数を使用
        descHtml.value = sanitizeHtml(html);
      } catch (markdownError) {
        // Markdownのパースに失敗した場合はプレーンテキストとして表示
        descHtml.value = sanitizeHtml(rawDesc.replace(/\n/g, '<br>'));
      }
    } else {
      descHtml.value = '<p><em>' + t('menu.getVideo') + '</em></p>';
    }

    // PeerTube Player初期化
    await nextTick();
    if (iframeRef.value) {
      try {
        player = new PeerTubePlayer(iframeRef.value);
        await player.ready;
      } catch (playerError) {
        // プレーヤー初期化失敗は動画再生には影響しない
      }
    }
  } catch (e) {
    // 🆕 エラーハンドリングを改善
    if (axios.isAxiosError(e)) {
      if (e.code === 'ECONNABORTED') {
        errorMessage.value = t('errors.timeout');
      } else if (e.response) {
        errorMessage.value = t('errors.httpError', { 
          status: e.response.status, 
          statusText: e.response.statusText 
        });
      } else if (e.request) {
        errorMessage.value = t('errors.networkError');
      } else {
        errorMessage.value = t('errors.requestError');
      }
    } else {
      errorMessage.value = t('errors.unexpected');
    }
    
    // エラー時も動画は表示を試みる（iframeで直接読み込めるかもしれないため）
    video.value = { 
      uuid: route.params.videoId as string,
      name: t('menu.videolist')
    };
  }
}

onMounted(async () => {
  try {
    // 全画面イベントリスナー登録
    document.addEventListener('fullscreenchange', onFullScreenChange);
    document.addEventListener('webkitfullscreenchange', onFullScreenChange);

    // 初期状態: 縦向きに固定
    if (Capacitor.getPlatform() !== 'web') {
      try {
        await ScreenOrientation.lock({ orientation: 'portrait' });
      } catch (e) {
        // 初期向き固定失敗は致命的ではない
      }
    }

    // 動画情報を取得
    await fetchVideo();
  } catch (e) {
    errorMessage.value = t('errors.unexpected');
  }
});

onBeforeUnmount(async () => {
  document.removeEventListener('fullscreenchange', onFullScreenChange);
  document.removeEventListener('webkitfullscreenchange', onFullScreenChange);
  try {
    await ScreenOrientation.unlock();
  } catch (e) {
    // アンロック失敗は無視
  }
});
</script>

<style scoped>
.notion {
  margin-top: 1rem;
  margin-left: 1rem;
  font-size: 1.2rem;
}
.iframeWrap {
  position: relative;
  width: 100%;
}
.iframeWrap iframe {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
}

.description {
  margin: 1.2rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.description :deep(a) {
  color: #007bff;
  text-decoration: underline;
}

.description :deep(p) {
  margin-bottom: 0.5rem;
}
</style>
