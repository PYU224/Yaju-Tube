<template>
  <ion-page>
    <ion-header v-if="!isFullScreen">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/tab2"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ video?.name || $t('menu.videolist') }}</ion-title>
        <ion-buttons slot="end">
          <!-- PiP機能は現在開発中のため一時的に非表示 -->
          <!-- <ion-button @click="togglePiP" v-if="pipSupported" :disabled="!isPlayerReady">
            <ion-icon :icon="videocam"></ion-icon>
          </ion-button> -->
        </ion-buttons>
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
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonBackButton, IonIcon } from '@ionic/vue';
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { useInstanceStore } from '@/stores/instanceStore';
import { useHistoryStore } from '@/stores/historyStore'; // 🆕 履歴ストア追加
import { PeerTubePlayer } from '@peertube/embed-api';
import { marked } from 'marked';
import { useI18n } from 'vue-i18n';
import { sanitizeHtml } from '@/utils/sanitize';
import '../theme/variables.css';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';
import { videocam } from 'ionicons/icons';

const route = useRoute();
const instanceStore = useInstanceStore();
const historyStore = useHistoryStore(); // 🆕 履歴ストア
const { t } = useI18n();

const video = ref<any>(null);
const isPlaying = ref(false);
const isFullScreen = ref(false);
const isPlayerReady = ref(false);
let player: PeerTubePlayer | null = null;
const iframeRef = ref<HTMLIFrameElement | null>(null);

// 🆕 進行状況の定期保存用
let progressInterval: number | null = null;

const descHtml = ref<string>('');
const errorMessage = ref<string>('');

const pipSupported = computed(() => {
  if (Capacitor.getPlatform() === 'web') {
    return 'pictureInPictureEnabled' in document;
  }
  return Capacitor.getPlatform() === 'android';
});

const getEmbedUrl = (uuid: string) => {
  // セッションストレージから一時的なインスタンスURLを取得（履歴から来た場合）
  const tempInstance = sessionStorage.getItem('tempInstanceUrl');
  const instanceUrl = tempInstance || instanceStore.selectedInstanceUrl;
  
  // 使用後は削除
  if (tempInstance) {
    sessionStorage.removeItem('tempInstanceUrl');
  }
  
  return `https://${instanceUrl}/videos/embed/${uuid}`;
};

const handleVideoLoad = () => {
  isPlaying.value = true;
};

// 🆕 視聴履歴に追加
const addToHistory = () => {
  if (!video.value) return;
  
  const channelName = video.value.channel?.displayName || video.value.channel?.name || 'Unknown';
  
  historyStore.addToHistory({
    videoId: video.value.uuid,
    videoName: video.value.name,
    thumbnailPath: video.value.thumbnailPath || video.value.previewPath || '',
    channelName: channelName,
    instanceUrl: instanceStore.selectedInstanceUrl
  });
};

// 🆕 再生位置を定期的に保存
const startProgressTracking = async () => {
  if (!player) return;
  
  progressInterval = window.setInterval(async () => {
    try {
      // 型定義にないメソッドなので型アサーションを使用
      const currentTime = await (player as any).getCurrentPosition();
      const duration = await (player as any).getDuration();
      
      if (video.value && currentTime > 0 && duration > 0) {
        historyStore.updateProgress(
          video.value.uuid,
          currentTime,
          duration
        );
      }
    } catch (e) {
      // プレイヤーの状態取得失敗は無視
      console.debug('Progress tracking failed:', e);
    }
  }, 5000); // 5秒ごとに保存
};

// 🆕 保存された再生位置から再開
const resumeFromHistory = async () => {
  if (!player || !video.value) return;
  
  const historyItem = historyStore.getHistoryItem(video.value.uuid);
  if (historyItem && historyItem.progress && historyItem.duration) {
    // 90%以上視聴済みの場合は最初から再生
    const progress = (historyItem.progress / historyItem.duration) * 100;
    if (progress < 90) {
      try {
        // 型定義にないメソッドなので型アサーションを使用
        await (player as any).seek(historyItem.progress);
      } catch (e) {
        console.warn('Failed to seek to saved position:', e);
      }
    }
  }
};

const togglePiP = async () => {
  if (!player || !isPlayerReady.value) {
    console.warn('Player not ready');
    return;
  }

  try {
    if (Capacitor.getPlatform() === 'web') {
      const iframe = iframeRef.value;
      if (!iframe) return;

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        console.log('PiP requested');
      }
    } else if (Capacitor.getPlatform() === 'android') {
      try {
        const { App } = await import('@capacitor/app');
        console.log('Android PiP mode requested');
      } catch (e) {
        console.warn('PiP not available on this device', e);
      }
    }
  } catch (err) {
    console.error('Failed to toggle PiP:', err);
  }
};

const onFullScreenChange = async () => {
  const fs = document.fullscreenElement || (document as any).webkitFullscreenElement;
  const isFS = !!fs;

  if (Capacitor.getPlatform() !== 'web') {
    try {
      await ScreenOrientation.lock({ orientation: isFS ? 'landscape' : 'portrait' });
    } catch (e) {
      // 向き制御失敗は致命的ではない
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

async function fetchVideo() {
  try {
    const vid = route.params.videoId as string;
    const resp = await axios.get(
      `https://${instanceStore.selectedInstanceUrl}/api/v1/videos/${vid}`,
      { timeout: 10000 }
    );
    
    video.value = resp.data;

    const rawDesc = resp.data.description || '';

    if (rawDesc.trim()) {
      try {
        let html = await marked(rawDesc);
        html = html.replace(/\n+/g, '<br>');
        descHtml.value = sanitizeHtml(html);
      } catch (markdownError) {
        descHtml.value = sanitizeHtml(rawDesc.replace(/\n/g, '<br>'));
      }
    } else {
      descHtml.value = '<p><em>' + t('menu.getVideo') + '</em></p>';
    }

    await nextTick();
    if (iframeRef.value) {
      try {
        player = new PeerTubePlayer(iframeRef.value);
        
        // 🆕 視聴履歴に追加（player.readyを待つ前に実行）
        // プレイヤーの初期化を待たなくても履歴は追加できる
        addToHistory();
        
        // タイムアウト付きでplayer.readyを待機
        const readyTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Player ready timeout')), 5000)
        );
        
        try {
          await Promise.race([player.ready, readyTimeout]);
          isPlayerReady.value = true;
          console.log('Player is ready');
        } catch (timeoutError) {
          console.warn('Player ready timeout, continuing anyway:', timeoutError);
          // タイムアウトしても処理を続行
          isPlayerReady.value = true;
        }
        
        // 🆕 保存された位置から再開
        await resumeFromHistory();
        
        // 🆕 進行状況のトラッキング開始
        startProgressTracking();
        
        if (pipSupported.value) {
          setupPiPListeners();
        }
      } catch (playerError) {
        console.error('Player initialization failed:', playerError);
        // エラーが発生しても履歴追加は既に完了している
      }
    }
  } catch (e) {
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
    
    video.value = { 
      uuid: route.params.videoId as string,
      name: t('menu.videolist')
    };
  }
}

const setupPiPListeners = () => {
  if (Capacitor.getPlatform() === 'web') {
    document.addEventListener('enterpictureinpicture', () => {
      console.log('Entered PiP mode');
    });
    
    document.addEventListener('leavepictureinpicture', () => {
      console.log('Left PiP mode');
    });
  }
};

onMounted(async () => {
  try {
    document.addEventListener('fullscreenchange', onFullScreenChange);
    document.addEventListener('webkitfullscreenchange', onFullScreenChange);

    if (Capacitor.getPlatform() !== 'web') {
      try {
        await ScreenOrientation.lock({ orientation: 'portrait' });
      } catch (e) {
        // 初期向き固定失敗は致命的ではない
      }
    }

    await fetchVideo();
  } catch (e) {
    errorMessage.value = t('errors.unexpected');
  }
});

onBeforeUnmount(async () => {
  // 🆕 進行状況トラッキング停止
  if (progressInterval) {
    clearInterval(progressInterval);
  }
  
  document.removeEventListener('fullscreenchange', onFullScreenChange);
  document.removeEventListener('webkitfullscreenchange', onFullScreenChange);
  
  if (Capacitor.getPlatform() === 'web') {
    document.removeEventListener('enterpictureinpicture', () => {});
    document.removeEventListener('leavepictureinpicture', () => {});
  }
  
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