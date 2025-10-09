// src/stores/settingsStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '@/i18n'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref('light')
  const availableThemes = ['light', 'dark', 'sepia', 'grape', 'yajuu']
  const notificationsEnabled = ref(true)
  const itemsPerPage = ref(20)
  const defaultInstanceUrl = ref('810video.com')
  const locale = ref('ja')
  const displayMode = ref<'list' | 'grid'>('list')

  const setTheme = (newTheme: string) => {
    theme.value = newTheme
    document.body.setAttribute('data-theme', newTheme)
  }

  const changeLanguage = (newLocale: string) => {
    locale.value = newLocale
    i18n.global.locale.value = newLocale as 'ja' | 'en' | 'de'
    localStorage.setItem('locale', newLocale)
  }

  const setDefaultInstanceUrl = (url: string) => {
    defaultInstanceUrl.value = url
  }
  
  // 表示設定 リスト方式 or グリッド表示
  function setDisplayMode(mode: 'list' | 'grid') {
    displayMode.value = mode
  }
  
  // 🔄 初期化処理を削除（main.ts で行うため）
  // const savedLocale = localStorage.getItem('locale')
  // if (savedLocale) {
  //   locale.value = savedLocale
  //   i18n.global.locale.value = savedLocale as 'ja' | 'en' | 'de'
  // }

  return {
    theme,
    availableThemes,
    notificationsEnabled,
    itemsPerPage,
    defaultInstanceUrl,
    locale,
    setTheme,
    changeLanguage,
    setDefaultInstanceUrl,
    displayMode,
    setDisplayMode
  }
}, {
  persist: true
})