// src/stores/mining.ts
import { defineStore } from 'pinia'

export const useMiningStore = defineStore('mining', {
  state: () => ({
    threads: 0  // 0=OFF、1=1コア、2=2コアでマイニング
  }),
  persist: true
})
