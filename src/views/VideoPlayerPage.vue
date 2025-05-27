<template>
  <ion-page>
    <ion-header v-if="!isPlaying">
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
      </div>
      <div v-else class="notion">動画情報を取得中...</div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter } from '@ionic/vue';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { useInstanceStore } from '@/stores/instanceStore';
import { PeerTubePlayer } from '@peertube/embed-api';
import '../theme/variables.css';

const route = useRoute();
const instanceStore = useInstanceStore();
const video = ref<any>(null);
const isPlaying = ref(false);
let player: PeerTubePlayer | null = null;
const iframeRef = ref<HTMLIFrameElement | null>(null);

const getEmbedUrl = (uuid: string) => {
  return `https://${instanceStore.selectedInstanceUrl}/videos/embed/${uuid}`;
};

const handleVideoLoad = () => {
  isPlaying.value = true;
};

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
  window.addEventListener('resize', handleOrientationChange);
  handleOrientationChange(); // 初回表示時に判定実行

  const videoId = route.params.videoId as string;
  try {
    const response = await axios.get(`https://${instanceStore.selectedInstanceUrl}/api/v1/videos/${videoId}`);
    video.value = response.data;

    // プレイヤーの初期化
    if (iframeRef.value) {
      player = new PeerTubePlayer(iframeRef.value);
      await player.ready;
      // 必要に応じてプレイヤーを制御できます
      // 例: player.play();
    }
  } catch (error) {
    console.error('動画情報の取得に失敗しました:', error);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleOrientationChange);
  const tabBar = document.getElementById('app-tab-bar');
  if (tabBar) {
    tabBar.style.display = 'flex';
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
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
}
.iframeWrap iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
