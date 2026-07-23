import { flushPromises, mount } from '@vue/test-utils'
import axios, { type AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { useHistoryStore } from '@/stores/historyStore'
import { useInstanceStore } from '@/stores/instanceStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { axiosError, createTestRouter, testGlobal } from '@/testUtils'
import VideoPlayerPage from './VideoPlayerPage.vue'

const peerTubeMocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  constructorError: undefined as Error | undefined,
  getCurrentTime: vi.fn(),
  getDuration: vi.fn(),
  pause: vi.fn(),
  play: vi.fn(),
  ready: Promise.resolve(),
  seek: vi.fn(),
}))

const appMocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  removeListener: vi.fn(),
  triggerAppStateChange: undefined as ((state: { isActive: boolean }) => void) | undefined,
}))

const ionicLifecycleMocks = vi.hoisted(() => ({
  didEnter: [] as Array<() => void>,
  willLeave: [] as Array<() => void>,
}))

const capacitorMocks = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'web'),
  lock: vi.fn(),
  unlock: vi.fn(),
}))

const markedMocks = vi.hoisted(() => ({
  marked: vi.fn((source: string) => Promise.resolve(source.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'))),
}))

vi.mock('axios', () => {
  const mockedAxios = {
    get: vi.fn(),
    isAxiosError: vi.fn((error: unknown) => Boolean((error as { isAxiosError?: boolean }).isAxiosError)),
  }

  return {
    default: mockedAxios,
    ...mockedAxios,
  }
})

vi.mock('@/utils/peerTubePlayer', () => ({
  PeerTubePlayer: vi.fn((iframe: HTMLIFrameElement) => {
    if (peerTubeMocks.constructorError) {
      throw peerTubeMocks.constructorError
    }

    peerTubeMocks.constructor(iframe)

    return {
      getCurrentTime: peerTubeMocks.getCurrentTime,
      getDuration: peerTubeMocks.getDuration,
      pause: peerTubeMocks.pause,
      play: peerTubeMocks.play,
      ready: peerTubeMocks.ready,
      seek: peerTubeMocks.seek,
    }
  }),
}))

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: appMocks.addListener,
  },
}))

vi.mock('@ionic/vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ionic/vue')>()),
  onIonViewDidEnter: (callback: () => void) => {
    ionicLifecycleMocks.didEnter.push(callback)
  },
  onIonViewWillLeave: (callback: () => void) => {
    ionicLifecycleMocks.willLeave.push(callback)
  },
}))

vi.mock('marked', () => ({
  marked: markedMocks.marked,
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: capacitorMocks.getPlatform,
  },
}))

vi.mock('@capacitor/screen-orientation', () => ({
  ScreenOrientation: {
    lock: capacitorMocks.lock,
    unlock: capacitorMocks.unlock,
  },
}))

type VideoResponse = {
  uuid: string
  name: string
  description?: string
  thumbnailPath?: string
  previewPath?: string
  channel?: {
    displayName?: string
    name?: string
  }
}

const videoResponse: VideoResponse = {
  uuid: 'video-1',
  name: 'Playable PeerTube Video',
  description: 'Hello **PeerTube**\n<script>alert("xss")</script>',
  thumbnailPath: '/lazy-static/thumbnails/video-1.jpg',
  channel: {
    displayName: 'Display Channel',
    name: 'channel-name',
  },
}

const ionicStubs = {
  IonPage: { template: '<main><slot /></main>' },
  IonHeader: { template: '<header><slot /></header>' },
  IonToolbar: { template: '<div><slot /></div>' },
  IonTitle: { template: '<h1><slot /></h1>' },
  IonContent: { template: '<section><slot /></section>' },
  IonButtons: { template: '<div><slot /></div>' },
  IonBackButton: { template: '<button type="button"><slot /></button>' },
  IonButton: {
    emits: ['click'],
    props: ['ariaLabel', 'color'],
    template: '<button type="button" :aria-label="ariaLabel" :color="color" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  IonIcon: {
    props: ['icon', 'ariaHidden'],
    template: '<span :data-icon="icon" :aria-hidden="ariaHidden" />',
  },
}

function mockVideo(response: VideoResponse = videoResponse) {
  vi.mocked(axios.get).mockResolvedValue({
    data: response,
  } as AxiosResponse<VideoResponse>)
}

async function mountVideoPlayerPage(
  setupStores?: (stores: {
    historyStore: ReturnType<typeof useHistoryStore>
    instanceStore: ReturnType<typeof useInstanceStore>
    playlistStore: ReturnType<typeof usePlaylistStore>
  }) => void,
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const historyStore = useHistoryStore()
  const instanceStore = useInstanceStore()
  const playlistStore = usePlaylistStore()
  setupStores?.({ historyStore, instanceStore, playlistStore })

  const router = createTestRouter([
    { path: '/tabs/tab2', component: { template: '<div />' } },
    { path: '/tabs/video/:videoId', component: VideoPlayerPage },
  ])
  await router.push('/tabs/video/video-1')
  await router.isReady()

  const wrapper = mount(VideoPlayerPage, {
    global: testGlobal(pinia, router, ionicStubs),
  })
  await flushPromises()

  return { historyStore, instanceStore, playlistStore, router, wrapper }
}

describe('VideoPlayerPage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    capacitorMocks.getPlatform.mockReturnValue('web')
    capacitorMocks.lock.mockResolvedValue(undefined)
    capacitorMocks.unlock.mockResolvedValue(undefined)
    peerTubeMocks.ready = Promise.resolve()
    peerTubeMocks.constructorError = undefined
    peerTubeMocks.pause.mockResolvedValue(undefined)
    peerTubeMocks.play.mockResolvedValue(undefined)
    peerTubeMocks.seek.mockResolvedValue(undefined)
    peerTubeMocks.getCurrentTime.mockResolvedValue(45)
    peerTubeMocks.getDuration.mockResolvedValue(120)
    ionicLifecycleMocks.didEnter.length = 0
    ionicLifecycleMocks.willLeave.length = 0
    appMocks.triggerAppStateChange = undefined
    appMocks.addListener.mockImplementation(
      (_eventName: string, callback: (state: { isActive: boolean }) => void) => {
        appMocks.triggerAppStateChange = callback
        return Promise.resolve({ remove: appMocks.removeListener })
      },
    )
    appMocks.removeListener.mockResolvedValue(undefined)
    markedMocks.marked.mockImplementation((source: string) =>
      Promise.resolve(source.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')),
    )
    mockVideo()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (document as Partial<Document> & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: undefined,
    })
  })

  it('loads the routed video, sanitizes its description, records history, resumes progress, and tracks playback', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T12:00:00.000Z'))
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      configurable: true,
      value: true,
    })
    const screenOrientationLock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: {
        lock: screenOrientationLock,
      },
    })
    sessionStorage.setItem('tempInstanceUrl', 'history.example')

    const { historyStore, wrapper } = await mountVideoPlayerPage(({ historyStore }) => {
      historyStore.history = [
        {
          videoId: 'video-1',
          videoName: 'Earlier Title',
          thumbnailPath: '/old-thumbnail.jpg',
          channelName: 'Earlier Channel',
          instanceUrl: '810video.com',
          watchedAt: Date.now() - 60_000,
          progress: 30,
          duration: 120,
        },
      ]
    })

    expect(axios.get).toHaveBeenCalledWith('https://history.example/api/v1/videos/video-1', { timeout: 10000 })
    expect(wrapper.get('h1').text()).toBe('Playable PeerTube Video')
    expect(wrapper.get('iframe').attributes('src')).toBe('https://history.example/videos/embed/video-1')
    expect(sessionStorage.getItem('tempInstanceUrl')).toBeNull()
    expect(wrapper.html()).toContain('<strong>PeerTube</strong>')
    expect(wrapper.html()).not.toContain('<script>')
    expect(peerTubeMocks.constructor).toHaveBeenCalledWith(wrapper.get('iframe').element)
    expect(peerTubeMocks.seek).toHaveBeenCalledWith(30)
    expect(historyStore.history[0]).toMatchObject({
      videoId: 'video-1',
      videoName: 'Playable PeerTube Video',
      thumbnailPath: '/lazy-static/thumbnails/video-1.jpg',
      channelName: 'Display Channel',
      instanceUrl: 'history.example',
      progress: 30,
      duration: 120,
    })

    await wrapper.get('iframe').trigger('load')
    document.dispatchEvent(new Event('enterpictureinpicture'))
    document.dispatchEvent(new Event('leavepictureinpicture'))

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.body,
    })
    document.dispatchEvent(new Event('fullscreenchange'))
    await flushPromises()

    screenOrientationLock.mockRejectedValueOnce(new Error('orientation unavailable'))
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })
    document.dispatchEvent(new Event('fullscreenchange'))
    await flushPromises()

    expect(screenOrientationLock).toHaveBeenCalledWith('landscape-primary')

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).toHaveBeenCalled()
    expect(peerTubeMocks.getDuration).toHaveBeenCalled()
    expect(historyStore.getHistoryItem('video-1')).toMatchObject({
      progress: 45,
      duration: 120,
    })

    wrapper.unmount()
    expect(capacitorMocks.unlock).toHaveBeenCalled()
  })

  it('falls back to sanitized plain text when markdown parsing fails', async () => {
    markedMocks.marked.mockRejectedValueOnce(new Error('markdown failed'))
    mockVideo({
      uuid: 'video-1',
      name: 'Fallback Description Video',
      description: 'Line 1\n<script>alert("xss")</script>',
      thumbnailPath: '/thumbnail.jpg',
      channel: {
        name: 'plain-channel',
      },
    })

    const { wrapper } = await mountVideoPlayerPage()

    expect(wrapper.html()).toContain('Line 1<br>')
    expect(wrapper.html()).not.toContain('<script>')
  })

  it('shows a loading description while markdown rendering is pending', async () => {
    let resolveMarkdown: (html: string) => void = () => {}
    markedMocks.marked.mockReturnValueOnce(new Promise<string>((resolve) => {
      resolveMarkdown = resolve
    }))

    const { wrapper } = await mountVideoPlayerPage()

    expect(wrapper.text()).toContain(i18n.global.t('menu.getLoading'))

    resolveMarkdown('<p>Loaded description</p>')
    await flushPromises()

    expect(wrapper.html()).toContain('Loaded description')
  })

  it('uses fallback metadata when the video has no description, thumbnail, or channel names', async () => {
    mockVideo({
      uuid: 'video-1',
      name: 'Metadata Fallback Video',
      description: '',
      previewPath: '/lazy-static/previews/video-1.jpg',
      channel: {},
    })

    const { historyStore, wrapper } = await mountVideoPlayerPage()

    expect(wrapper.html()).toContain(i18n.global.t('menu.getVideo'))
    expect(historyStore.history[0]).toMatchObject({
      videoId: 'video-1',
      videoName: 'Metadata Fallback Video',
      thumbnailPath: '/lazy-static/previews/video-1.jpg',
      channelName: 'Unknown',
    })
  })

  it('uses an empty thumbnail when video metadata has no thumbnail or preview', async () => {
    mockVideo({
      uuid: 'video-1',
      name: 'No Thumbnail Video',
      description: '',
      channel: {
        name: 'plain-channel',
      },
    })

    const { historyStore } = await mountVideoPlayerPage()

    expect(historyStore.history[0]).toMatchObject({
      videoId: 'video-1',
      thumbnailPath: '',
    })
  })

  it('keeps playback when seeking to saved progress fails', async () => {
    peerTubeMocks.seek.mockRejectedValueOnce(new Error('seek unavailable'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mountVideoPlayerPage(({ historyStore }) => {
      historyStore.history = [
        {
          videoId: 'video-1',
          videoName: 'Earlier Title',
          thumbnailPath: '/old-thumbnail.jpg',
          channelName: 'Earlier Channel',
          instanceUrl: '810video.com',
          watchedAt: Date.now() - 60_000,
          progress: 30,
          duration: 120,
        },
      ]
    })

    expect(warn).toHaveBeenCalledWith(
      'Failed to seek to saved position:',
      expect.objectContaining({ message: 'seek unavailable' }),
    )
    warn.mockRestore()
  })

  it('toggles loop playback and restarts the player near the end of the video', async () => {
    vi.useFakeTimers()
    peerTubeMocks.getCurrentTime.mockResolvedValue(119.5)
    peerTubeMocks.getDuration.mockResolvedValue(120)

    const { historyStore, wrapper } = await mountVideoPlayerPage()

    expect(wrapper.get('[aria-label="ループ再生を有効にする"]').attributes('color')).toBe('medium')

    await wrapper.get('[aria-label="ループ再生を有効にする"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[aria-label="ループ再生を無効にする"]').attributes('color')).toBe('primary')

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(peerTubeMocks.seek).toHaveBeenCalledWith(0)
    expect(peerTubeMocks.play).toHaveBeenCalled()
    expect(historyStore.getHistoryItem('video-1')).toMatchObject({
      progress: 0,
      duration: 120,
    })

    wrapper.unmount()
  })

  it('adds and removes the loaded video from the playlist', async () => {
    const { playlistStore, wrapper } = await mountVideoPlayerPage()

    expect(wrapper.get('[aria-label="マイリストに追加"]').attributes('color')).toBe('medium')

    await wrapper.get('[aria-label="マイリストに追加"]').trigger('click')
    await flushPromises()

    expect(playlistStore.playlist[0]).toMatchObject({
      videoId: 'video-1',
      videoName: 'Playable PeerTube Video',
      thumbnailPath: '/lazy-static/thumbnails/video-1.jpg',
      channelName: 'Display Channel',
      instanceUrl: '810video.com',
    })
    expect(wrapper.get('[aria-label="マイリストから削除"]').attributes('color')).toBe('primary')

    await wrapper.get('[aria-label="マイリストから削除"]').trigger('click')
    await flushPromises()

    expect(playlistStore.playlist).toEqual([])
  })

  it.each([
    ['timeout', axiosError({ code: 'ECONNABORTED' }), i18n.global.t('errors.timeout')],
    [
      'HTTP response',
      axiosError({ response: { status: 404, statusText: 'Not Found' } }),
      i18n.global.t('errors.httpError', { status: 404, statusText: 'Not Found' }),
    ],
    ['network', axiosError({ request: {} }), i18n.global.t('errors.networkError')],
    ['request setup', axiosError(), i18n.global.t('errors.requestError')],
    ['unexpected', new Error('boom'), i18n.global.t('errors.unexpected')],
  ])('shows the %s error state instead of an iframe when video loading fails', async (_label, error, expectedMessage) => {
    vi.mocked(axios.get).mockRejectedValue(error)

    const { historyStore, wrapper } = await mountVideoPlayerPage()

    expect(wrapper.text()).toContain(expectedMessage)
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(historyStore.history).toEqual([])
  })

  it('locks and unlocks native orientation on Android', async () => {
    capacitorMocks.getPlatform.mockReturnValue('android')
    capacitorMocks.lock.mockRejectedValueOnce(new Error('initial orientation unavailable'))

    const { wrapper } = await mountVideoPlayerPage()

    expect(capacitorMocks.lock).toHaveBeenCalledWith({ orientation: 'portrait' })

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.body,
    })
    document.dispatchEvent(new Event('fullscreenchange'))
    await flushPromises()

    expect(capacitorMocks.lock).toHaveBeenCalledWith({ orientation: 'landscape' })

    capacitorMocks.lock.mockRejectedValueOnce(new Error('native orientation unavailable'))
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })
    document.dispatchEvent(new Event('fullscreenchange'))
    await flushPromises()

    wrapper.unmount()
    await flushPromises()

    expect(capacitorMocks.unlock).toHaveBeenCalled()
  })

  it('locks portrait orientation on Android when initial orientation setup succeeds', async () => {
    capacitorMocks.getPlatform.mockReturnValue('android')

    const { wrapper } = await mountVideoPlayerPage()

    expect(capacitorMocks.lock).toHaveBeenCalledWith({ orientation: 'portrait' })

    wrapper.unmount()
  })

  it('continues after player ready timeout and ignores progress polling failures', async () => {
    vi.useFakeTimers()
    peerTubeMocks.ready = new Promise(() => {})
    peerTubeMocks.getCurrentTime.mockRejectedValueOnce(new Error('position unavailable'))
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { wrapper } = await mountVideoPlayerPage()
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(warn).toHaveBeenCalledWith(
      'Player ready timeout, continuing anyway:',
      expect.objectContaining({ message: 'Player ready timeout' }),
    )
    expect(debug).toHaveBeenCalledWith(
      'Progress tracking failed:',
      expect.objectContaining({ message: 'position unavailable' }),
    )

    wrapper.unmount()
    debug.mockRestore()
    warn.mockRestore()
  })

  it('pauses playback, saves the position, and stops tracking when the player screen goes to the background', async () => {
    vi.useFakeTimers()

    const { historyStore, wrapper } = await mountVideoPlayerPage()

    peerTubeMocks.getCurrentTime.mockResolvedValue(62)

    ionicLifecycleMocks.willLeave.forEach((callback) => callback())
    await flushPromises()

    expect(peerTubeMocks.pause).toHaveBeenCalled()
    expect(historyStore.getHistoryItem('video-1')).toMatchObject({
      progress: 62,
      duration: 120,
    })

    peerTubeMocks.getCurrentTime.mockClear()
    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).not.toHaveBeenCalled()

    ionicLifecycleMocks.didEnter.forEach((callback) => callback())
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('stops playback and saves the position when leaving via router navigation (bottom tab bar), even without the Ionic view hook', async () => {
    // 回帰テスト: 下部タブバーでの遷移では Ionic がページをキャッシュしたまま残し
    // onIonViewWillLeave が発火しないことがある。その場合でも iframe の音声が
    // 裏で流れ続けないよう、Vue Router のパス変化だけで停止・保存されること。
    vi.useFakeTimers()

    const { historyStore, router, wrapper } = await mountVideoPlayerPage()

    peerTubeMocks.pause.mockClear()
    peerTubeMocks.getCurrentTime.mockResolvedValue(88)

    // Ionic のライフサイクルフックは意図的に呼ばず、実際のルート遷移のみ発生させる
    await router.push('/tabs/tab2')
    await flushPromises()

    expect(peerTubeMocks.pause).toHaveBeenCalled()
    expect(historyStore.getHistoryItem('video-1')).toMatchObject({
      progress: 88,
      duration: 120,
    })

    // 離脱後は進行状況トラッキングが停止していること
    peerTubeMocks.getCurrentTime.mockClear()
    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).not.toHaveBeenCalled()

    // 動画ページへ戻るとトラッキングが再開すること（再生自体は自動再開しない）
    await router.push('/tabs/video/video-1')
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).toHaveBeenCalled()
    expect(peerTubeMocks.play).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('pauses playback and saves the position when the app goes to the background, then resumes tracking', async () => {
    vi.useFakeTimers()

    const { historyStore, wrapper } = await mountVideoPlayerPage()

    expect(appMocks.addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function))

    peerTubeMocks.getCurrentTime.mockResolvedValue(78)

    appMocks.triggerAppStateChange?.({ isActive: false })
    await flushPromises()

    expect(peerTubeMocks.pause).toHaveBeenCalled()
    expect(historyStore.getHistoryItem('video-1')).toMatchObject({
      progress: 78,
      duration: 120,
    })

    peerTubeMocks.getCurrentTime.mockClear()
    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).not.toHaveBeenCalled()

    appMocks.triggerAppStateChange?.({ isActive: true })
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).toHaveBeenCalled()

    wrapper.unmount()
    expect(appMocks.removeListener).toHaveBeenCalled()
  })

  it('does not resume tracking on app foreground while the page itself stays in the background', async () => {
    vi.useFakeTimers()

    const { wrapper } = await mountVideoPlayerPage()

    ionicLifecycleMocks.willLeave.forEach((callback) => callback())
    await flushPromises()

    peerTubeMocks.getCurrentTime.mockClear()
    appMocks.triggerAppStateChange?.({ isActive: true })
    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).not.toHaveBeenCalled()

    ionicLifecycleMocks.didEnter.forEach((callback) => callback())
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('removes the app state listener when registration resolves after unmount', async () => {
    let resolveListener: (handle: { remove: () => Promise<void> }) => void = () => {}
    appMocks.addListener.mockImplementation(
      () => new Promise<{ remove: () => Promise<void> }>((resolve) => {
        resolveListener = resolve
      }),
    )

    const { wrapper } = await mountVideoPlayerPage()
    wrapper.unmount()

    expect(appMocks.removeListener).not.toHaveBeenCalled()

    resolveListener({ remove: appMocks.removeListener })
    await flushPromises()

    expect(appMocks.removeListener).toHaveBeenCalled()
  })

  it('ignores an in-flight progress poll that completes after playback was suspended', async () => {
    vi.useFakeTimers()
    peerTubeMocks.getDuration.mockResolvedValue(120)

    const { wrapper } = await mountVideoPlayerPage()

    await wrapper.get('[aria-label="ループ再生を有効にする"]').trigger('click')
    await flushPromises()

    let resolveInFlightPosition: (value: number) => void = () => {}
    peerTubeMocks.getCurrentTime.mockImplementationOnce(
      () => new Promise<number>((resolve) => {
        resolveInFlightPosition = resolve
      }),
    )
    peerTubeMocks.getCurrentTime.mockResolvedValue(119.5)

    await vi.advanceTimersByTimeAsync(5000)

    ionicLifecycleMocks.willLeave.forEach((callback) => callback())
    await flushPromises()

    expect(peerTubeMocks.pause).toHaveBeenCalled()

    resolveInFlightPosition(119.5)
    await flushPromises()

    expect(peerTubeMocks.seek).not.toHaveBeenCalledWith(0)
    expect(peerTubeMocks.play).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('does not start tracking when the component unmounts during player setup', async () => {
    vi.useFakeTimers()
    peerTubeMocks.ready = new Promise(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { wrapper } = await mountVideoPlayerPage()
    wrapper.unmount()

    // player.readyのタイムアウト経過でセットアップの続きが実行される
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    peerTubeMocks.getCurrentTime.mockClear()

    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not start tracking when the page went to the background during player setup', async () => {
    vi.useFakeTimers()
    peerTubeMocks.ready = new Promise(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { wrapper } = await mountVideoPlayerPage()

    ionicLifecycleMocks.willLeave.forEach((callback) => callback())
    await flushPromises()

    // player.readyのタイムアウト経過でセットアップの続きが実行される
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    peerTubeMocks.getCurrentTime.mockClear()

    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).not.toHaveBeenCalled()

    ionicLifecycleMocks.didEnter.forEach((callback) => callback())
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).toHaveBeenCalled()

    wrapper.unmount()
    warn.mockRestore()
  })

  it('does not start tracking when the app went to the background during player setup', async () => {
    vi.useFakeTimers()
    peerTubeMocks.ready = new Promise(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { wrapper } = await mountVideoPlayerPage()

    appMocks.triggerAppStateChange?.({ isActive: false })
    await flushPromises()

    // player.readyのタイムアウト経過でセットアップの続きが実行される
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    peerTubeMocks.getCurrentTime.mockClear()

    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).not.toHaveBeenCalled()

    appMocks.triggerAppStateChange?.({ isActive: true })
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(peerTubeMocks.getCurrentTime).toHaveBeenCalled()

    wrapper.unmount()
    warn.mockRestore()
  })

  it('does not re-suspend cached background pages when the app goes to the background', async () => {
    const { historyStore, wrapper } = await mountVideoPlayerPage()

    ionicLifecycleMocks.willLeave.forEach((callback) => callback())
    await flushPromises()

    const watchedAtAfterLeave = historyStore.getHistoryItem('video-1')?.watchedAt
    peerTubeMocks.pause.mockClear()
    peerTubeMocks.getCurrentTime.mockClear()

    appMocks.triggerAppStateChange?.({ isActive: false })
    await flushPromises()

    // 離脱時に停止・保存済みの背面ページには何もしない
    // （watchedAtが更新されて履歴の先頭に浮上するのを防ぐ）
    expect(peerTubeMocks.pause).not.toHaveBeenCalled()
    expect(peerTubeMocks.getCurrentTime).not.toHaveBeenCalled()
    expect(historyStore.getHistoryItem('video-1')?.watchedAt).toBe(watchedAtAfterLeave)

    wrapper.unmount()
  })

  it('does not let a stale background save overwrite progress from resumed tracking', async () => {
    vi.useFakeTimers()

    const { historyStore, wrapper } = await mountVideoPlayerPage()

    let resolveStaleSave: (value: number) => void = () => {}
    peerTubeMocks.getCurrentTime.mockImplementationOnce(
      () => new Promise<number>((resolve) => {
        resolveStaleSave = resolve
      }),
    )

    // バックグラウンド保存が再生位置の取得待ちで止まっている間に…
    ionicLifecycleMocks.willLeave.forEach((callback) => callback())
    await flushPromises()

    // …画面へ戻ってトラッキングが再開され、より新しい進捗が保存される
    peerTubeMocks.getCurrentTime.mockResolvedValue(90)
    ionicLifecycleMocks.didEnter.forEach((callback) => callback())
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(historyStore.getHistoryItem('video-1')).toMatchObject({ progress: 90 })

    // 古い保存が遅れて完了しても、新しい進捗を巻き戻さない
    resolveStaleSave(45)
    await flushPromises()

    expect(historyStore.getHistoryItem('video-1')).toMatchObject({ progress: 90 })

    wrapper.unmount()
  })

  it('ignores pause and position failures while suspending playback in the background', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    peerTubeMocks.pause.mockRejectedValueOnce(new Error('pause unavailable'))
    peerTubeMocks.getCurrentTime.mockRejectedValueOnce(new Error('position unavailable'))

    const { historyStore, wrapper } = await mountVideoPlayerPage()

    ionicLifecycleMocks.willLeave.forEach((callback) => callback())
    await flushPromises()

    expect(debug).toHaveBeenCalledWith(
      'Pausing playback failed:',
      expect.objectContaining({ message: 'pause unavailable' }),
    )
    expect(debug).toHaveBeenCalledWith(
      'Saving progress failed:',
      expect.objectContaining({ message: 'position unavailable' }),
    )
    expect(historyStore.getHistoryItem('video-1')?.progress).toBeUndefined()

    wrapper.unmount()
    debug.mockRestore()
  })

  it('logs player initialization failures without adding history', async () => {
    peerTubeMocks.constructorError = new Error('player unavailable')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { historyStore } = await mountVideoPlayerPage()

    expect(error).toHaveBeenCalledWith(
      'Player initialization failed:',
      expect.objectContaining({ message: 'player unavailable' }),
    )
    expect(historyStore.history).toEqual([])

    error.mockRestore()
  })

  it('renders an unexpected error when lifecycle setup fails and ignores unlock failures', async () => {
    const originalAddEventListener = document.addEventListener.bind(document)
    const addEventListener = vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'fullscreenchange') {
        throw new Error('listener unavailable')
      }

      return originalAddEventListener(type, listener, options)
    })

    const { wrapper } = await mountVideoPlayerPage()
    expect(wrapper.text()).toContain(i18n.global.t('errors.unexpected'))
    addEventListener.mockRestore()

    capacitorMocks.unlock.mockRejectedValueOnce(new Error('unlock unavailable'))
    wrapper.unmount()
    await flushPromises()

    expect(capacitorMocks.unlock).toHaveBeenCalled()
  })
})
