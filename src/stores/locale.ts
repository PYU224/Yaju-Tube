import { defineStore } from 'pinia'

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    locale: localStorage.getItem('app-locale') || 'ja'
  }),
  actions: {
    setLocale(newLocale: string) {
      this.locale = newLocale
      localStorage.setItem('app-locale', newLocale)
    }
  }
})
