import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import ja from './locales/ja.json'
import de from './locales/de.json'

const i18n = createI18n({
  legacy: false, // Composition API を使用する場合は false
  globalInjection: true, // $t をグローバルに使用可能にする
  locale: 'ja', // デフォルトの言語
  fallbackLocale: 'en',
  messages: {
    en,
    ja,
    de,
  }
})

export default i18n
