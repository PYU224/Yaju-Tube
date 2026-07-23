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
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton, IonIcon, onIonViewDidEnter, onIonViewWillLeave } from '@ionic/vue';
import { ref, onMounted, onBeforeUnmount, nextTick, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
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

// 🆕 このページのルートパス。下部タブバー等での画面遷移を確実に検知するため、
// マウント時のvideoIdを固定で保持する（離脱後はroute.paramsが変化するため）
const routeVideoId = String(route.params['videoId'] ?? '');
const videoRoutePath = `/tabs/video/${routeVideoId}`;

const video = ref<any>(null);
const isPlaying = ref(false);
const isFullScreen = ref(false);
const loopPlayback = ref(false);
let player: PeerTubePlayer | null = null;
const iframeRef = ref<HTMLIFrameElement | null>(null);
const loopRestartThresholdSeconds = 1;

// 🆕 続きから再生の判定に使うしきい値（公式PeerTubeアプリの _shouldResume に準拠）
// - 動画長がこれ未満なら続きから再生しない（短すぎる動画は毎回先頭でよい）
const resumeMinDurationSeconds = 30;
// - 保存位置が「動画長 - この秒数」以降なら、ほぼ見終わっているので先頭から再生する
const resumeEndThresholdSeconds = 10;

// 🆕 埋め込みプレイヤーを開始する再生位置（秒）。0なら先頭から。
// 動画読み込み時に履歴から一度だけ算出し、以降は再生中に変化させない
// （iframeのsrcが変わって動画がリロードされるのを防ぐため）。
const resumeStartSeconds = ref(0);

// 🆕 進行状況の定期保存用
let progressInterval: number | null = null;

// 🆕 アプリのフォアグラウンド/バックグラウンド遷移リスナー
let appStateListener: PluginListenerHandle | null = null;

// 🆕 このビューが前面に表示されているか（Ionicのキャッシュで背面に残っている間はfalse）
let isViewActive = true;

// 🆕 アプリ自体がフォアグラウンドにあるか
let isAppActive = true;

// 🆕 アンマウント後に完了する非同期処理を無効化するためのフラグ
let isUnmounted = false;

// 🆕 停止後に完了した実行中ポーリングを無効化するための世代カウンタ
let progressTrackingGeneration = 0;

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
  const base = `https://${embedInstanceUrl.value}/videos/embed/${uuid}`;

  // 🆕 保存された再生位置がある場合は start パラメータで頭出しする。
  // PeerTubeの埋め込みは ?start=秒数 でネイティブに開始位置を指定できるため、
  // 再生開始前は効かない seek() よりも確実に「続きから再生」を実現できる。
  if (resumeStartSeconds.value > 0) {
    return `${base}?start=${resumeStartSeconds.value}`;
  }

  return base;
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

// 🆕 進行状況トラッキングを停止
const stopProgressTracking = () => {
  // 実行中の古いポーリングコールバックも世代カウンタで無効化する
  progressTrackingGeneration += 1;

  if (progressInterval !== null) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
};

// 🆕 現在の再生位置を即座に履歴へ保存（バックグラウンド移行時・画面離脱時用）
const saveCurrentProgress = async () => {
  if (!player || !video.value) {
    return;
  }

  const generation = progressTrackingGeneration;

  try {
    const currentTime = await player.getCurrentTime();
    const duration = await player.getDuration();

    // 待機中に新しいトラッキングが始まっていたら、古い値で履歴を上書きしない
    if (generation !== progressTrackingGeneration) {
      return;
    }

    if (currentTime > 0 && duration > 0) {
      historyStore.updateProgress(video.value.uuid, currentTime, duration);
    }
  } catch (e) {
    // 離脱中はプレイヤーが応答しないことがあるため失敗は無視
    console.debug('Saving progress failed:', e);
  }
};

// 🆕 画面が背面に回ったら再生を停止し、再生位置を保存する
const suspendPlayback = async () => {
  stopProgressTracking();

  if (player) {
    // 音声を即座に止めるため停止要求を先に送る（応答は待たない）
    void player.pause().catch((e) => {
      console.debug('Pausing playback failed:', e);
    });
  }

  await saveCurrentProgress();
};

// 🆕 画面へ戻ってきたら進行状況トラッキングを再開する（再生自体は自動再開しない）
// このページが前面にあり、かつアプリがフォアグラウンドの時だけ開始する
const resumeProgressTracking = () => {
  if (player && isViewActive && isAppActive) {
    startProgressTracking(player);
  }
};

// 🆕 再生位置を定期的に保存
const startProgressTracking = (activePlayer: PeerTubePlayer) => {
  stopProgressTracking(); // 二重起動を防止
  const generation = progressTrackingGeneration;

  progressInterval = window.setInterval(async () => {
    try {
      const currentTime = await activePlayer.getCurrentTime();
      const duration = await activePlayer.getDuration();

      // 待機中に停止された古いポーリングは何もしない
      // （suspend後にループ再生分岐でseek/playが走るのを防ぐ）
      if (generation !== progressTrackingGeneration) {
        return;
      }

      if (video.value && currentTime > 0 && duration > 0) {
        if (loopPlayback.value && currentTime >= duration - loopRestartThresholdSeconds) {
          await activePlayer.seek(0);

          if (generation !== progressTrackingGeneration) {
            return;
          }

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

// 🆕 保存された再生位置から「続きから再生」すべきか判定する（公式アプリ準拠）
const shouldResumeFrom = (savedPosition: number, duration: number): boolean => {
  if (!Number.isFinite(savedPosition) || !Number.isFinite(duration)) {
    return false;
  }

  // 保存位置がない（先頭）なら続きから再生しない
  if (savedPosition <= 0) {
    return false;
  }

  // 短すぎる動画は続きから再生しない
  if (duration < resumeMinDurationSeconds) {
    return false;
  }

  // ほぼ見終わっている（残り resumeEndThresholdSeconds 秒以内）なら先頭から再生する
  if (savedPosition >= duration - resumeEndThresholdSeconds) {
    return false;
  }

  return true;
};

// 🆕 履歴から続きから再生の開始位置（秒）を算出する。続きから再生しない場合は0。
const computeResumeStart = (videoId: string, apiDuration?: unknown): number => {
  const historyItem = historyStore.getHistoryItem(videoId);
  const savedProgress = historyItem?.progress ?? 0;

  // 動画長はAPIの値（常に存在し信頼できる）を優先し、無ければ履歴の値を使う
  const parsedApiDuration = Number(apiDuration);
  const duration = Number.isFinite(parsedApiDuration) && parsedApiDuration > 0
    ? parsedApiDuration
    : historyItem?.duration ?? 0;

  if (!shouldResumeFrom(savedProgress, duration)) {
    return 0;
  }

  return Math.floor(savedProgress);
};

// 🆕 保存された再生位置から再開する。
// 開始位置は既に埋め込みURLの start パラメータで指定済みだが、
// プレイヤーが seek に対応している場合の補強として明示的にも頭出しする。
const resumeFromHistory = async (activePlayer: PeerTubePlayer) => {
  if (resumeStartSeconds.value <= 0) {
    return;
  }

  try {
    await activePlayer.seek(resumeStartSeconds.value);
  } catch (e) {
    console.warn('Failed to seek to saved position:', e);
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
    
    // 🆕 iframeを描画する前に続きから再生の開始位置を確定させる。
    // これにより getEmbedUrl が start パラメータ付きの安定したURLを返し、
    // 再生中に履歴が更新されてもiframeがリロードされない。
    resumeStartSeconds.value = computeResumeStart(resp.data.uuid, resp.data.duration);

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

        // 🆕 プレイヤー準備待ちの間に画面が破棄されていたら何もしない
        if (isUnmounted) {
          return;
        }

        // 🆕 保存された位置から再開（開始位置は既に resumeStartSeconds に確定済み）
        await resumeFromHistory(player);

        // 🆕 セットアップ中に画面が破棄されていたらトラッキングは開始しない
        if (isUnmounted) {
          return;
        }

        // 🆕 進行状況のトラッキング開始
        // （ページが背面・アプリがバックグラウンドの間は開始せず、
        //   ionViewDidEnterやappStateChangeの復帰時に再開される）
        resumeProgressTracking();

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

// 🆕 解除できるように名前付きハンドラで登録する
const handleEnterPiP = () => {
  console.log('Entered PiP mode');
};

const handleLeavePiP = () => {
  console.log('Left PiP mode');
};

const setupPiPListeners = () => {
  if (Capacitor.getPlatform() === 'web') {
    document.addEventListener('enterpictureinpicture', handleEnterPiP);
    document.addEventListener('leavepictureinpicture', handleLeavePiP);
  }
};

// 🆕 別画面へ遷移してもIonicはこのページをキャッシュしたまま残すため、
// 背面に回るタイミングで再生を停止して位置を保存する
onIonViewWillLeave(() => {
  isViewActive = false;
  void suspendPlayback();
});

// 🆕 背面から画面へ戻ってきたら進行状況トラッキングを再開する
onIonViewDidEnter(() => {
  isViewActive = true;
  resumeProgressTracking();
});

// 🆕 下部タブバーなどでの画面遷移対策。
// このページは /tabs 配下でタブと同じrouter-outletにpushされるため、
// タブボタンで別タブへ切り替えるとIonicはページをキャッシュしたまま
// 残す一方でonIonViewWillLeaveが発火しないことがある。その結果、
// iframeの音声が停止されず裏で流れ続け、しかも画面から離れているため
// 操作もできない状態になっていた。
// Ionicのビューライフサイクルに依存せず、Vue Routerのパス変化を直接
// 監視することで、あらゆる離脱・復帰を確実に捕捉する。
watch(
  () => route.path,
  (newPath, oldPath) => {
    const nowOnVideoPage = newPath === videoRoutePath;
    const wasOnVideoPage = oldPath === videoRoutePath;

    if (wasOnVideoPage && !nowOnVideoPage) {
      // 動画ページから離脱：再生を停止して再生位置を保存する
      isViewActive = false;
      void suspendPlayback();
    } else if (!wasOnVideoPage && nowOnVideoPage) {
      // 動画ページへ復帰：進行状況トラッキングを再開（再生は自動再開しない）
      isViewActive = true;
      resumeProgressTracking();
    }
  },
);

onMounted(async () => {
  try {
    document.addEventListener('fullscreenchange', onFullScreenChange);
    document.addEventListener('webkitfullscreenchange', onFullScreenChange);

    // 🆕 アプリ自体がバックグラウンドへ移行したら再生を停止し、復帰したらトラッキングを再開する
    appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
      isAppActive = isActive;

      if (isActive) {
        // 背面キャッシュ中のページで隠れ再生・トラッキングが始まらないよう
        // resumeProgressTracking側で前面判定してから再開する
        resumeProgressTracking();
      } else if (isViewActive) {
        // 背面キャッシュ中のページは離脱時に既に停止・保存済みのため対象外
        // （watchedAtが更新され、見ていない動画が履歴の先頭に浮上するのを防ぐ）
        void suspendPlayback();
      }
    });

    // 🆕 リスナー登録完了より先にアンマウントされていたら、即座に解除して以降の処理は行わない
    if (isUnmounted) {
      void appStateListener.remove().catch(() => {
        // リスナー解除失敗は無視
      });
      appStateListener = null;
      return;
    }

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
  // 🆕 進行中の非同期セットアップ（リスナー登録など）を無効化
  isUnmounted = true;

  // 🆕 進行状況トラッキングを停止し、最後の再生位置を保存（ベストエフォート）
  stopProgressTracking();
  void saveCurrentProgress();

  document.removeEventListener('fullscreenchange', onFullScreenChange);
  document.removeEventListener('webkitfullscreenchange', onFullScreenChange);

  if (Capacitor.getPlatform() === 'web') {
    document.removeEventListener('enterpictureinpicture', handleEnterPiP);
    document.removeEventListener('leavepictureinpicture', handleLeavePiP);
  }

  // 🆕 アプリ状態リスナーを解除
  if (appStateListener) {
    void appStateListener.remove().catch(() => {
      // リスナー解除失敗は無視
    });
    appStateListener = null;
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
