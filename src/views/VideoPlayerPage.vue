<template>
  <ion-page>
    <ion-header v-if="!isFullScreen">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/tab2"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ video?.name || $t('menu.videolist') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            v-if="video"
            fill="clear"
            :aria-label="isSavedToPlaylist ? t('aria.removeFromPlaylist') : t('aria.addToPlaylist')"
            :color="isSavedToPlaylist ? 'primary' : 'medium'"
            @click="togglePlaylistItem"
          >
            <ion-icon
              slot="icon-only"
              :icon="isSavedToPlaylist ? bookmark : bookmarkOutline"
              aria-hidden="true"
            ></ion-icon>
          </ion-button>
          <ion-button
            fill="clear"
            :aria-label="loopPlayback ? t('aria.disableLoopPlayback') : t('aria.enableLoopPlayback')"
            :color="loopPlayback ? 'primary' : 'medium'"
            @click="toggleLoopPlayback"
          >
            <ion-icon
              slot="icon-only"
              :icon="repeat"
              aria-hidden="true"
            ></ion-icon>
          </ion-button>
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
        <!-- 動画説明文 -->
        <div v-if="descHtml" class="description" v-html="descHtml"></div>
        <div v-else class="description">{{ $t('menu.getLoading') }}</div>
      </div>
      <div v-else class="notion">
        {{ errorMessage || $t('menu.getVideoInfo') }}
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton, IonIcon } from '@ionic/vue';
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { useInstanceStore } from '@/stores/instanceStore';
import { useHistoryStore } from '@/stores/historyStore'; // 🆕 履歴ストア追加
import { usePlaylistStore } from '@/stores/playlistStore';
import { PeerTubePlayer } from '@/utils/peerTubePlayer';
import { marked } from 'marked';
import { useI18n } from 'vue-i18n';
import { sanitizeHtml } from '@/utils/sanitize';
import '../theme/variables.css';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';
import { bookmark, bookmarkOutline, repeat } from 'ionicons/icons';

const route = useRoute();
const instanceStore = useInstanceStore();
const historyStore = useHistoryStore(); // 🆕 履歴ストア
const playlistStore = usePlaylistStore();
const { t } = useI18n();

const video = ref<any>(null);
const isPlaying = ref(false);
const isFullScreen = ref(false);
const loopPlayback = ref(false);
let player: PeerTubePlayer | null = null;
const iframeRef = ref<HTMLIFrameElement | null>(null);
const loopRestartThresholdSeconds = 1;

// 🆕 進行状況の定期保存用
let progressInterval: number | null = null;

const descHtml = ref<string>('');
const errorMessage = ref<string>('');
const tempInstanceUrl = sessionStorage.getItem('tempInstanceUrl');
const embedInstanceUrl = ref(tempInstanceUrl || instanceStore.selectedInstanceUrl);

if (tempInstanceUrl) {
  sessionStorage.removeItem('tempInstanceUrl');
}

const pipSupported = computed(() => {
  if (Capacitor.getPlatform() === 'web') {
    return 'pictureInPictureEnabled' in document;
  }
  return Capacitor.getPlatform() === 'android';
});

const getEmbedUrl = (uuid: string) => {
  return `https://${embedInstanceUrl.value}/videos/embed/${uuid}`;
};

const getVideoChannelName = () => {
  return video.value.channel?.displayName || video.value.channel?.name || 'Unknown';
};

const isSavedToPlaylist = computed(() => {
  if (!video.value) {
    return false;
  }

  return playlistStore.isInPlaylist(video.value.uuid, embedInstanceUrl.value);
});

const handleVideoLoad = () => {
  isPlaying.value = true;
};

const toggleLoopPlayback = () => {
  loopPlayback.value = !loopPlayback.value;
};

const togglePlaylistItem = () => {
  if (!video.value) {
    return;
  }

  if (isSavedToPlaylist.value) {
    playlistStore.removeFromPlaylist(video.value.uuid, embedInstanceUrl.value);
    return;
  }

  playlistStore.addToPlaylist({
    videoId: video.value.uuid,
    videoName: video.value.name,
    thumbnailPath: video.value.thumbnailPath || video.value.previewPath || '',
    channelName: getVideoChannelName(),
    instanceUrl: embedInstanceUrl.value
  });
};

// 🆕 視聴履歴に追加
const addToHistory = () => {
  historyStore.addToHistory({
    videoId: video.value.uuid,
    videoName: video.value.name,
    thumbnailPath: video.value.thumbnailPath || video.value.previewPath || '',
    channelName: getVideoChannelName(),
    instanceUrl: embedInstanceUrl.value
  });
};

// 🆕 再生位置を定期的に保存
const startProgressTracking = (activePlayer: PeerTubePlayer) => {
  progressInterval = window.setInterval(async () => {
    try {
      const currentTime = await activePlayer.getCurrentPosition();
      const duration = await activePlayer.getDuration();
      
      if (video.value && currentTime > 0 && duration > 0) {
        if (loopPlayback.value && currentTime >= duration - loopRestartThresholdSeconds) {
          await activePlayer.seek(0);
          await activePlayer.play();
          historyStore.updateProgress(video.value.uuid, 0, duration);
          return;
        }

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
const resumeFromHistory = async (activePlayer: PeerTubePlayer, videoId: string) => {
  const historyItem = historyStore.getHistoryItem(videoId);
  if (historyItem && historyItem.progress && historyItem.duration) {
    // 90%以上視聴済みの場合は最初から再生
    const progress = (historyItem.progress / historyItem.duration) * 100;
    if (progress < 90) {
      try {
        await activePlayer.seek(historyItem.progress);
      } catch (e) {
        console.warn('Failed to seek to saved position:', e);
      }
    }
  }
};

const onFullScreenChange = async () => {
  const fs = document.fullscreenElement || (document as any).webkitFullscreenElement;
  const isFS = !!fs;

  if (Capacitor.getPlatform() !== 'web') {
    try {
      await ScreenOrientation.lock({ orientation: isFS ? 'landscape' : 'portrait' });
    } catch {
      // 向き制御失敗は致命的ではない
    }
  } else {
    try {
      const orientation = window.screen.orientation as any;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock(isFS ? 'landscape-primary' : 'portrait-primary');
      }
    } catch {
      // ブラウザでの向き制御失敗は想定内
    }
  }
};

async function fetchVideo() {
  try {
    const vid = route.params['videoId'] as string;
    const resp = await axios.get(
      `https://${embedInstanceUrl.value}/api/v1/videos/${vid}`,
      { timeout: 10000 }
    );
    
    video.value = resp.data;

    const rawDesc = resp.data.description || '';

    if (rawDesc.trim()) {
      try {
        let html = await marked(rawDesc);
        html = html.replace(/\n+/g, '<br>');
        descHtml.value = sanitizeHtml(html);
      } catch {
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
          console.log('Player is ready');
        } catch (timeoutError) {
          console.warn('Player ready timeout, continuing anyway:', timeoutError);
          // タイムアウトしても処理を続行
        }
        
        // 🆕 保存された位置から再開
        await resumeFromHistory(player, video.value.uuid);
        
        // 🆕 進行状況のトラッキング開始
        startProgressTracking(player);
        
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
    
    video.value = null;
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
      } catch {
        // 初期向き固定失敗は致命的ではない
      }
    }

    await fetchVideo();
  } catch {
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
  } catch {
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
