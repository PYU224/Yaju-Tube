<template>
  <ion-page>
    <ion-header v-if="!isFullScreen">
      <ion-toolbar>
        <ion-title>{{ video?.name || '動画再生' }}</ion-title>
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
      <div v-else class="notion">{{ $t('menu.getVideoInfo') }}</div>
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
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useI18n } from 'vue-i18n';
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
      console.warn('ネイティブ向き制御失敗:', e);
    }
  } else {
    try {
      const orientation = window.screen.orientation as any;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock(isFS ? 'landscape-primary' : 'portrait-primary');
      } else {
        console.warn('ブラウザ: screen.orientation.lock はサポートされていません');
      }
    } catch (e) {
      console.warn('ブラウザ向き制御失敗:', e);
    }
  }
};

/*
DOMPurify.addHook を使い、サニタイズの前後で <a> タグを調整
target="_blank" を一時属性に保存(before)
sanitize 後に復元し、rel="noopener noreferrer"を追加(after)
*/
DOMPurify.addHook('beforeSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('target')) {
    node.setAttribute('data-temp-target', node.getAttribute('target')!);
  }
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('data-temp-target')) {
    const t = node.getAttribute('data-temp-target')!;
    node.setAttribute('target', t);
    node.setAttribute('rel', 'noopener noreferrer');
    node.removeAttribute('data-temp-target');
  }
});

// 動画情報と説明文を取得
async function fetchVideo() {
  try {
    console.log('Fetching video info...');
    const vid = route.params.videoId as string;
    const resp = await axios.get(
      `https://${instanceStore.selectedInstanceUrl}/api/v1/videos/${vid}`,
      { timeout: 10000 }
    );
    
    video.value = resp.data;
    console.log('Video data loaded:', video.value.name);

    // 説明文を処理
    const rawDesc = resp.data.description || '';
    console.log('Raw description length:', rawDesc.length);

    if (rawDesc.trim()) {
      try {
        // 1. Markdown → HTML
        let html = await marked(rawDesc);
        console.log('Markdown parsed');
        
        // 2. 改行を <br> に変換
        html = html.replace(/\n+/g, '<br>');
        
        // 3. サニタイズしてリンク安全化
        descHtml.value = DOMPurify.sanitize(html);
        console.log('Description sanitized, length:', descHtml.value.length);
      } catch (markdownError) {
        console.error('Markdown parsing error:', markdownError);
        // Markdownのパースに失敗した場合はプレーンテキストとして表示
        descHtml.value = DOMPurify.sanitize(rawDesc.replace(/\n/g, '<br>'));
      }
    } else {
      console.log('No description available');
      descHtml.value = '<p><em>' + t('menu.getVideo') + '</em></p>';
    }

    // PeerTube Player初期化
    await nextTick();
    if (iframeRef.value) {
      try {
        player = new PeerTubePlayer(iframeRef.value);
        await player.ready;
        console.log('PeerTube player ready');
      } catch (playerError) {
        console.error('PeerTube player initialization error:', playerError);
      }
    }
  } catch (e) {
    console.error('Failed to fetch video:', e);
    if (axios.isAxiosError(e)) {
      if (e.code === 'ECONNABORTED') {
        console.error('Request timeout');
      } else if (e.response) {
        console.error('HTTP error:', e.response.status, e.response.statusText);
      } else if (e.request) {
        console.error('Network error');
      }
    }
    // エラー時もvideo.valueをnullにしない（iframe表示のため）
    descHtml.value = '<p><em>説明文の読み込みに失敗しました</em></p>';
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
        console.warn('初期向き固定失敗:', e);
      }
    }

    // 動画情報を取得
    await fetchVideo();
  } catch (e) {
    console.error('onMounted内部で例外:', e);
  }
});

onBeforeUnmount(async () => {
  document.removeEventListener('fullscreenchange', onFullScreenChange);
  document.removeEventListener('webkitfullscreenchange', onFullScreenChange);
  try {
    await ScreenOrientation.unlock();
  } catch (e) {
    console.warn('向きアンロック失敗:', e);
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