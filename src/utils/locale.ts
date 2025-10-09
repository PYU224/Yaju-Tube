import { Device } from '@capacitor/device'

/**
 * デバイスのシステム言語を取得
 * @returns 'ja' | 'en' | 'de'
 */
export async function getDeviceLanguage(): Promise<string> {
  try {
    const info = await Device.getLanguageCode()
    const langCode = info.value.toLowerCase()
    
    // 言語コードから対応言語を判定
    if (langCode.startsWith('ja')) {
      return 'ja'
    } else if (langCode.startsWith('de')) {
      return 'de'
    }
    
    // デフォルトは英語
    return 'en'
  } catch (error) {
    console.error('Failed to get device language:', error)
    // エラー時はブラウザの言語設定を使用
    const browserLang = navigator.language.toLowerCase()
    if (browserLang.startsWith('ja')) return 'ja'
    if (browserLang.startsWith('de')) return 'de'
    return 'en'
  }
}

/**
 * 保存された言語設定を取得（なければデバイス言語）
 */
export async function getInitialLocale(): Promise<string> {
  // 既に保存されている言語設定があればそれを使用
  const savedLocale = localStorage.getItem('locale')
  if (savedLocale) {
    return savedLocale
  }
  
  // 保存されていない場合はデバイス言語を取得
  return await getDeviceLanguage()
}