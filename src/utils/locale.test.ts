import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDeviceLanguage, getInitialLocale } from './locale'

const mocks = vi.hoisted(() => ({
  getLanguageCode: vi.fn(),
}))

vi.mock('@capacitor/device', () => ({
  Device: {
    getLanguageCode: mocks.getLanguageCode,
  },
}))

function setNavigatorLanguage(language: string) {
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: language,
  })
}

describe('locale utilities', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.getLanguageCode.mockReset()
    setNavigatorLanguage('en-US')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps supported Capacitor device language codes to app locales', async () => {
    mocks.getLanguageCode.mockResolvedValueOnce({ value: 'ja-JP' })
    await expect(getDeviceLanguage()).resolves.toBe('ja')

    mocks.getLanguageCode.mockResolvedValueOnce({ value: 'de-DE' })
    await expect(getDeviceLanguage()).resolves.toBe('de')

    mocks.getLanguageCode.mockResolvedValueOnce({ value: 'fr-FR' })
    await expect(getDeviceLanguage()).resolves.toBe('en')
  })

  it('falls back to the browser language when Capacitor language detection fails', async () => {
    mocks.getLanguageCode.mockRejectedValueOnce(new Error('Capacitor unavailable'))
    setNavigatorLanguage('ja-JP')
    await expect(getDeviceLanguage()).resolves.toBe('ja')

    mocks.getLanguageCode.mockRejectedValueOnce(new Error('Capacitor unavailable'))
    setNavigatorLanguage('de-DE')
    await expect(getDeviceLanguage()).resolves.toBe('de')

    mocks.getLanguageCode.mockRejectedValueOnce(new Error('Capacitor unavailable'))
    setNavigatorLanguage('fr-FR')
    await expect(getDeviceLanguage()).resolves.toBe('en')
  })

  it('uses a saved locale before consulting device language', async () => {
    localStorage.setItem('locale', 'de')

    await expect(getInitialLocale()).resolves.toBe('de')
    expect(mocks.getLanguageCode).not.toHaveBeenCalled()
  })

  it('uses device language when no locale has been saved', async () => {
    mocks.getLanguageCode.mockResolvedValueOnce({ value: 'ja-JP' })

    await expect(getInitialLocale()).resolves.toBe('ja')
  })
})
