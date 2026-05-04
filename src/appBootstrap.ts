import { nextTick, watch, type WatchStopHandle } from 'vue'
import type { Router } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support'
import { StatusBar, Style } from '@capacitor/status-bar'
import i18n from './i18n'
import { getInitialLocale } from './utils/locale'

type SupportedLocale = 'ja' | 'en' | 'de'

interface SettingsStoreLike {
  theme: string
  locale: string
  changeLanguage(locale: string): void
}

export interface NativeChromeDeps {
  getPlatform(): string
  setEdgeToEdgeBackgroundColor(options: { color: string }): Promise<void>
  setStatusBarStyle(options: { style: Style }): Promise<void>
  setStatusBarOverlaysWebView(options: { overlay: boolean }): Promise<void>
}

interface NativeChromePluginRefs {
  capacitor: {
    getPlatform(): string
  }
  edgeToEdge: {
    setBackgroundColor(options: { color: string }): Promise<void>
  }
  statusBar: {
    setStyle(options: { style: Style }): Promise<void>
    setOverlaysWebView(options: { overlay: boolean }): Promise<void>
  }
}

export function createNativeChromeDeps(
  plugins: NativeChromePluginRefs = {
    capacitor: Capacitor,
    edgeToEdge: EdgeToEdge,
    statusBar: StatusBar,
  },
): NativeChromeDeps {
  return {
    getPlatform: () => plugins.capacitor.getPlatform(),
    setEdgeToEdgeBackgroundColor: (options) => plugins.edgeToEdge.setBackgroundColor(options),
    setStatusBarStyle: (options) => plugins.statusBar.setStyle(options),
    setStatusBarOverlaysWebView: (options) => plugins.statusBar.setOverlaysWebView(options),
  }
}

const nativeChromeDeps = createNativeChromeDeps()

export async function initializeAppSettings(
  settingsStore: SettingsStoreLike,
  options: {
    getLocale?: () => Promise<string>
    documentRef?: Document
    i18nRef?: typeof i18n
  } = {},
) {
  const {
    getLocale = getInitialLocale,
    documentRef = document,
    i18nRef = i18n,
  } = options

  documentRef.body.setAttribute('data-theme', settingsStore.theme)

  const initialLocale = await getLocale()

  if (settingsStore.locale !== initialLocale) {
    settingsStore.changeLanguage(initialLocale)
    return
  }

  i18nRef.global.locale.value = settingsStore.locale as SupportedLocale
}

export async function restoreFocusAfterNavigation(documentRef: Document = document) {
  await nextTick()

  try {
    const active = documentRef.activeElement as HTMLElement | null
    active?.blur?.()
    documentRef.body.tabIndex = 0
    documentRef.body.focus()
    documentRef.body.removeAttribute('tabindex')
  } catch {
    // Focus restoration is best-effort and should never block navigation.
  }
}

export function registerFocusRestoration(
  router: Pick<Router, 'afterEach'>,
  documentRef: Document = document,
) {
  router.afterEach(() => {
    void restoreFocusAfterNavigation(documentRef)
  })
}

export async function applyNavBarColor(
  theme: string,
  deps: NativeChromeDeps = nativeChromeDeps,
) {
  const isLight = theme === 'light' || theme === 'sepia'
  const backgroundColor = isLight ? '#EEEEEE' : '#222222'
  const platform = deps.getPlatform()

  if (platform === 'android') {
    try {
      await deps.setEdgeToEdgeBackgroundColor({ color: backgroundColor })
    } catch {
      // Native chrome styling is optional on unsupported devices.
    }
  }

  if (platform === 'android' || platform === 'ios') {
    try {
      await deps.setStatusBarStyle({ style: isLight ? Style.Dark : Style.Light })
      await deps.setStatusBarOverlaysWebView({ overlay: true })
    } catch {
      // Native chrome styling is optional on unsupported devices.
    }
  }
}

export function watchThemeNativeChrome(
  settingsStore: Pick<SettingsStoreLike, 'theme'>,
  applyTheme: (theme: string) => Promise<void> = applyNavBarColor,
): WatchStopHandle {
  return watch(
    () => settingsStore.theme,
    async (theme) => {
      try {
        await applyTheme(theme)
      } catch {
        // Theme changes must not be blocked by native API failures.
      }
    },
    { immediate: true },
  )
}
