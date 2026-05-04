import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { useSettingsStore } from './settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.body.removeAttribute('data-theme')
    i18n.global.locale.value = 'ja'
  })

  it('exposes the default application settings', () => {
    const store = useSettingsStore()

    expect(store.theme).toBe('light')
    expect(store.availableThemes).toEqual(['light', 'dark', 'sepia', 'grape', 'yajuu'])
    expect(store.notificationsEnabled).toBe(true)
    expect(store.itemsPerPage).toBe(20)
    expect(store.defaultInstanceUrl).toBe('810video.com')
    expect(store.locale).toBe('ja')
    expect(store.displayMode).toBe('list')
  })

  it('updates the document theme attribute', () => {
    const store = useSettingsStore()

    store.setTheme('dark')

    expect(store.theme).toBe('dark')
    expect(document.body.getAttribute('data-theme')).toBe('dark')
  })

  it('updates the active locale and persists the language choice', () => {
    const store = useSettingsStore()

    store.changeLanguage('de')

    expect(store.locale).toBe('de')
    expect(i18n.global.locale.value).toBe('de')
    expect(localStorage.getItem('locale')).toBe('de')
  })

  it('updates default instance URL and display mode preferences', () => {
    const store = useSettingsStore()

    store.setDefaultInstanceUrl('video.example')
    store.setDisplayMode('grid')

    expect(store.defaultInstanceUrl).toBe('video.example')
    expect(store.displayMode).toBe('grid')
  })
})
