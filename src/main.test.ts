import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const app = {
    mount: vi.fn(),
    use: vi.fn(),
  }
  const pinia = {
    use: vi.fn(),
  }
  const router = {
    afterEach: vi.fn(),
    isReady: vi.fn(),
  }
  const settingsStore = {
    locale: 'ja',
    theme: 'light',
  }

  return {
    app,
    pinia,
    router,
    settingsStore,
    App: { name: 'AppRoot' },
    IonicVue: { name: 'IonicVuePlugin' },
    createApp: vi.fn(),
    createPinia: vi.fn(),
    i18n: { global: { locale: { value: 'ja' } } },
    initializeAppSettings: vi.fn(),
    piniaPluginPersistedstate: vi.fn(),
    registerFocusRestoration: vi.fn(),
    useSettingsStore: vi.fn(),
    watchThemeNativeChrome: vi.fn(),
  }
})

vi.mock('vue', () => ({
  createApp: mocks.createApp,
}))

vi.mock('pinia', () => ({
  createPinia: mocks.createPinia,
}))

vi.mock('pinia-plugin-persistedstate', () => ({
  default: mocks.piniaPluginPersistedstate,
}))

vi.mock('./App.vue', () => ({
  default: mocks.App,
}))

vi.mock('./router', () => ({
  default: mocks.router,
}))

vi.mock('@ionic/vue', () => ({
  IonicVue: mocks.IonicVue,
}))

vi.mock('./i18n', () => ({
  default: mocks.i18n,
}))

vi.mock('./appBootstrap', () => ({
  initializeAppSettings: mocks.initializeAppSettings,
  registerFocusRestoration: mocks.registerFocusRestoration,
  watchThemeNativeChrome: mocks.watchThemeNativeChrome,
}))

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: mocks.useSettingsStore,
}))

describe('main entrypoint', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.app.use.mockReturnValue(mocks.app)
    mocks.createApp.mockReturnValue(mocks.app)
    mocks.createPinia.mockReturnValue(mocks.pinia)
    mocks.initializeAppSettings.mockResolvedValue(undefined)
    mocks.router.isReady.mockResolvedValue(undefined)
    mocks.useSettingsStore.mockReturnValue(mocks.settingsStore)
  })

  it('installs app plugins, waits for the router, initializes settings, and mounts', async () => {
    await import('./main')
    const readyPromise = mocks.router.isReady.mock.results[0]?.value
    if (!readyPromise) {
      throw new Error('Expected router readiness promise to be captured')
    }
    await readyPromise
    await Promise.resolve()

    expect(mocks.createPinia).toHaveBeenCalledOnce()
    expect(mocks.pinia.use).toHaveBeenCalledWith(mocks.piniaPluginPersistedstate)
    expect(mocks.createApp).toHaveBeenCalledWith(mocks.App)
    expect(mocks.app.use).toHaveBeenNthCalledWith(1, mocks.router)
    expect(mocks.app.use).toHaveBeenNthCalledWith(2, mocks.pinia)
    expect(mocks.app.use).toHaveBeenNthCalledWith(3, mocks.IonicVue, {
      innerHTMLTemplatesEnabled: true,
    })
    expect(mocks.app.use).toHaveBeenNthCalledWith(4, mocks.i18n)
    expect(mocks.registerFocusRestoration).toHaveBeenCalledWith(mocks.router)
    expect(mocks.router.isReady).toHaveBeenCalledOnce()
    expect(mocks.useSettingsStore).toHaveBeenCalledOnce()
    expect(mocks.initializeAppSettings).toHaveBeenCalledWith(mocks.settingsStore)
    expect(mocks.app.mount).toHaveBeenCalledWith('#app')
    expect(mocks.watchThemeNativeChrome).toHaveBeenCalledWith(mocks.settingsStore)
  })
})
