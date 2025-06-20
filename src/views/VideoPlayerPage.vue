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
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent} from '@ionic/vue';
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { useInstanceStore } from '@/stores/instanceStore';
import { PeerTubePlayer } from '@peertube/embed-api';
import DOMPurify from 'dompurify';
import { marked } from 'marked'
import '../theme/variables.css';

// 動画齊瀬画面のの向き設定
import { ScreenOrientation } from '@capacitor/screen-orientation';

const route = useRoute();
const instanceStore = useInstanceStore();
const video = ref<any>(null);
const isPlaying = ref(false);
const isFullScreen = ref(false);
let player: PeerTubePlayer | null = null;
const iframeRef = ref<HTMLIFrameElement | null>(null);

// 動画説明文宣言
const descHtml = ref<string>('')

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
      const orientation = window.screen.orientation;
      if (orientation?.lock) {
        await orientation.lock(isFS ? 'landscape' : 'portrait');
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
target="_blank" を一時属性に保存（before）
sanitize 後に復元し、rel="noopener noreferrer"を追加（after）
*/
DOMPurify.addHook('beforeSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('target')) {
    node.setAttribute('data-temp-target', node.getAttribute('target')!)
  }
})

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('data-temp-target')) {
    const t = node.getAttribute('data-temp-target')!
    node.setAttribute('target', t)
    node.setAttribute('rel', 'noopener noreferrer')
    node.removeAttribute('data-temp-target')
  }
})

async function fetchVideo() {
  const resp = await axios.get(`https://${instanceStore.selectedInstanceUrl}/api/v1/videos/${route.params.videoId}`)
  video.value = resp.data
  const rawDesc = resp.data.description || ''

  // 1. Markdown → HTML
  let html = marked(rawDesc)
  // 2. 改行を <br> に変換
  html = html.replace(/\n+/g, '<br>')
  // 3. サニタイズしてリンク安全化
  descHtml.value = DOMPurify.sanitize(html)

  await nextTick()
  if (iframeRef.value) {
    player = new PeerTubePlayer(iframeRef.value)
    await player.ready
  }
}

const handleOrientationChange = () => {
  const tabBar = document.getElementById('app-tab-bar');
  if (!tabBar) return;

  if (window.matchMedia('(orientation: landscape)').matches) {
    // 横向きの場合、タブバーを非表示
    tabBar.style.display = 'none';
  } else {
    // 縦向きの場合、タブバーを表示
    tabBar.style.display = 'flex';
  }
};

onMounted(async () => {

  // 説明文呼び出し
  fetchVideo()

  try {
    const vid = route.params.videoId as string;
    const resp = await axios.get(`https://${instanceStore.selectedInstanceUrl}/api/v1/videos/${vid}`);
    video.value = resp.data;
    await nextTick();
    if (iframeRef.value) {
      const player = new PeerTubePlayer(iframeRef.value);
      await player.ready;
    }

    document.addEventListener('fullscreenchange', onFullScreenChange);
    document.addEventListener('webkitfullscreenchange', onFullScreenChange);

    // 初期状態: 縦向きに固定（例外保護付き）
    if (Capacitor.getPlatform() !== 'web') {
      try {
        await ScreenOrientation.lock({ orientation: 'portrait' });
      } catch (e) {
        console.warn('初期向き固定失敗:', e);
      }
    }
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
/*
  display: flex;
  justify-content: center;
  align-items: center;
*/
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.iframeWrap iframe {
  width: 100%;
  /* max-width: 640px; 必要に応じて最大幅を設定 */
  height: auto;
  aspect-ratio: 16 / 9; /* アスペクト比を維持 */
}

.description {
  margin : 1.2rem ;
}
</style>
