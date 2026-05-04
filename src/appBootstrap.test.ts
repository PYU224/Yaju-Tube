import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Style } from '@capacitor/status-bar'
import {
  applyNavBarColor,
  createNativeChromeDeps,
  initializeAppSettings,
  registerFocusRestoration,
  restoreFocusAfterNavigation,
  watchThemeNativeChrome,
} from './appBootstrap'

describe('app bootstrap helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('tabindex')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes theme and changes language when the detected locale differs', async () => {
    const store = {
      theme: 'dark',
      locale: 'ja',
      changeLanguage: vi.fn(),
    }

    await initializeAppSettings(store, {
      getLocale: async () => 'de',
    })

    expect(document.body.getAttribute('data-theme')).toBe('dark')
    expect(store.changeLanguage).toHaveBeenCalledWith('de')
  })

  it('syncs i18n directly when the detected locale already matches settings', async () => {
    const store = {
      theme: 'light',
      locale: 'en',
      changeLanguage: vi.fn(),
    }
    const i18nRef = {
      global: {
        locale: {
          value: 'ja',
        },
      },
    }

    await initializeAppSettings(store, {
      getLocale: async () => 'en',
      i18nRef: i18nRef as never,
    })

    expect(store.changeLanguage).not.toHaveBeenCalled()
    expect(i18nRef.global.locale.value).toBe('en')
  })

  it('restores focus after navigation without leaving a body tabindex', async () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    const blur = vi.spyOn(button, 'blur')
    const focusBody = vi.spyOn(document.body, 'focus')

    await restoreFocusAfterNavigation(document)

    expect(blur).toHaveBeenCalled()
    expect(focusBody).toHaveBeenCalled()
    expect(document.body.hasAttribute('tabindex')).toBe(false)
  })

  it('ignores focus restoration failures', async () => {
    const brokenDocument = {
      get activeElement() {
        throw new Error('active element unavailable')
      },
      body: document.body,
    }

    await expect(restoreFocusAfterNavigation(brokenDocument as unknown as Document)).resolves.toBeUndefined()
  })

  it('registers focus restoration on router navigation', async () => {
    const router = {
      afterEach: vi.fn(),
    }
    const focusBody = vi.spyOn(document.body, 'focus')

    registerFocusRestoration(router as never, document)
    const afterEachCallback = router.afterEach.mock.calls[0]?.[0]
    if (!afterEachCallback) {
      throw new Error('Expected router afterEach callback to be registered')
    }
    afterEachCallback()
    await nextTick()
    await Promise.resolve()

    expect(router.afterEach).toHaveBeenCalledOnce()
    expect(afterEachCallback).toEqual(expect.any(Function))
    expect(focusBody).toHaveBeenCalled()
  })

  it('applies light native chrome colors on Android', async () => {
    const deps = {
      getPlatform: vi.fn(() => 'android'),
      setEdgeToEdgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      setStatusBarStyle: vi.fn().mockResolvedValue(undefined),
      setStatusBarOverlaysWebView: vi.fn().mockResolvedValue(undefined),
    }

    await applyNavBarColor('sepia', deps)

    expect(deps.setEdgeToEdgeBackgroundColor).toHaveBeenCalledWith({ color: '#EEEEEE' })
    expect(deps.setStatusBarStyle).toHaveBeenCalledWith({ style: Style.Dark })
    expect(deps.setStatusBarOverlaysWebView).toHaveBeenCalledWith({ overlay: true })
  })

  it('creates native chrome deps from plugin references', async () => {
    const plugins = {
      capacitor: {
        getPlatform: vi.fn(() => 'android'),
      },
      edgeToEdge: {
        setBackgroundColor: vi.fn().mockResolvedValue(undefined),
      },
      statusBar: {
        setStyle: vi.fn().mockResolvedValue(undefined),
        setOverlaysWebView: vi.fn().mockResolvedValue(undefined),
      },
    }

    const deps = createNativeChromeDeps(plugins)

    expect(deps.getPlatform()).toBe('android')
    await deps.setEdgeToEdgeBackgroundColor({ color: '#111111' })
    await deps.setStatusBarStyle({ style: Style.Light })
    await deps.setStatusBarOverlaysWebView({ overlay: true })

    expect(plugins.capacitor.getPlatform).toHaveBeenCalledOnce()
    expect(plugins.edgeToEdge.setBackgroundColor).toHaveBeenCalledWith({ color: '#111111' })
    expect(plugins.statusBar.setStyle).toHaveBeenCalledWith({ style: Style.Light })
    expect(plugins.statusBar.setOverlaysWebView).toHaveBeenCalledWith({ overlay: true })
  })

  it('applies dark status bar colors on iOS without edge-to-edge calls', async () => {
    const deps = {
      getPlatform: vi.fn(() => 'ios'),
      setEdgeToEdgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      setStatusBarStyle: vi.fn().mockResolvedValue(undefined),
      setStatusBarOverlaysWebView: vi.fn().mockResolvedValue(undefined),
    }

    await applyNavBarColor('grape', deps)

    expect(deps.setEdgeToEdgeBackgroundColor).not.toHaveBeenCalled()
    expect(deps.setStatusBarStyle).toHaveBeenCalledWith({ style: Style.Light })
    expect(deps.setStatusBarOverlaysWebView).toHaveBeenCalledWith({ overlay: true })
  })

  it('skips native chrome calls on web and swallows native failures', async () => {
    const webDeps = {
      getPlatform: vi.fn(() => 'web'),
      setEdgeToEdgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      setStatusBarStyle: vi.fn().mockResolvedValue(undefined),
      setStatusBarOverlaysWebView: vi.fn().mockResolvedValue(undefined),
    }
    const failingDeps = {
      getPlatform: vi.fn(() => 'android'),
      setEdgeToEdgeBackgroundColor: vi.fn().mockRejectedValue(new Error('edge failed')),
      setStatusBarStyle: vi.fn().mockRejectedValue(new Error('status failed')),
      setStatusBarOverlaysWebView: vi.fn().mockResolvedValue(undefined),
    }

    await applyNavBarColor('light', webDeps)
    await expect(applyNavBarColor('dark', failingDeps)).resolves.toBeUndefined()

    expect(webDeps.setEdgeToEdgeBackgroundColor).not.toHaveBeenCalled()
    expect(webDeps.setStatusBarStyle).not.toHaveBeenCalled()
    expect(webDeps.setStatusBarOverlaysWebView).not.toHaveBeenCalled()
  })

  it('watches theme changes and ignores apply failures', async () => {
    const store = reactive({ theme: 'light' })
    const applyTheme = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('native unavailable'))

    const stop = watchThemeNativeChrome(store, applyTheme)
    await nextTick()
    await Promise.resolve()

    store.theme = 'dark'
    await nextTick()
    await Promise.resolve()

    expect(applyTheme).toHaveBeenNthCalledWith(1, 'light')
    expect(applyTheme).toHaveBeenNthCalledWith(2, 'dark')

    stop()
  })
})
