import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import {
  type PlaylistExport,
  type PlaylistItem,
  usePlaylistStore,
} from '@/stores/playlistStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { createTestRouter, testGlobal } from '@/testUtils'
import Tab5Page from './Tab5Page.vue'

type AlertButton = {
  text: string
  role?: string
  handler?: (data?: { playlistJson?: string }) => void
}

type AlertInput = {
  name: string
  type: string
  value?: string
}

type AlertOptions = {
  header: string
  message?: string
  inputs?: AlertInput[]
  buttons: AlertButton[]
}

const alertMocks = vi.hoisted(() => ({
  create: vi.fn(),
  latestOptions: undefined as AlertOptions | undefined,
  present: vi.fn(),
}))

vi.mock('@ionic/vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/vue')>()

  return {
    ...actual,
    alertController: {
      create: alertMocks.create,
    },
  }
})

const NOW = new Date('2026-05-04T12:00:00.000Z')

const ionicStubs = {
  IonPage: { template: '<main><slot /></main>' },
  IonHeader: { template: '<header><slot /></header>' },
  IonToolbar: { template: '<div><slot /></div>' },
  IonTitle: { template: '<h1><slot /></h1>' },
  IonContent: { template: '<section><slot /></section>' },
  IonList: { template: '<div><slot /></div>' },
  IonItem: {
    name: 'IonItem',
    emits: ['click'],
    template: '<div role="button" @click="$emit(\'click\', $event)"><slot /></div>',
  },
  IonItemSliding: { template: '<div><slot /></div>' },
  IonItemOptions: { template: '<div><slot /></div>' },
  IonItemOption: {
    name: 'IonItemOption',
    emits: ['click'],
    template: '<button @click="$emit(\'click\', $event)"><slot /></button>',
  },
  IonLabel: { template: '<span><slot /></span>' },
  IonThumbnail: { template: '<div><slot /></div>' },
  IonIcon: { template: '<span />' },
  IonButtons: { template: '<div><slot /></div>' },
  IonButton: {
    name: 'IonButton',
    emits: ['click'],
    props: ['ariaLabel'],
    template: '<button :aria-label="ariaLabel" @click="$emit(\'click\', $event)"><slot /></button>',
  },
}

function playlistItem(overrides: Partial<PlaylistItem> = {}): PlaylistItem {
  return {
    videoId: 'video-1',
    videoName: 'Saved Playlist Video',
    thumbnailPath: '/lazy-static/thumbnails/video-1.jpg',
    channelName: 'Playlist Channel',
    instanceUrl: '810video.com',
    addedAt: NOW.getTime(),
    ...overrides,
  }
}

async function mountTab5Page(setup?: (stores: {
  playlistStore: ReturnType<typeof usePlaylistStore>
  settingsStore: ReturnType<typeof useSettingsStore>
}) => void) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const playlistStore = usePlaylistStore()
  const settingsStore = useSettingsStore()
  setup?.({ playlistStore, settingsStore })

  const router = createTestRouter([
    { path: '/tabs/tab5', component: { template: '<div />' } },
    { path: '/tabs/video/:videoId', component: { template: '<div />' } },
  ])
  await router.push('/tabs/tab5')
  await router.isReady()

  const wrapper = mount(Tab5Page, {
    global: testGlobal(pinia, router, ionicStubs),
  })
  await flushPromises()

  return { playlistStore, router, settingsStore, wrapper }
}

describe('Tab5Page', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    alertMocks.latestOptions = undefined
    alertMocks.present = vi.fn().mockResolvedValue(undefined)
    alertMocks.create.mockImplementation(async (options: AlertOptions) => {
      alertMocks.latestOptions = options

      return {
        present: alertMocks.present,
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders the empty playlist state and keeps export disabled by omission', async () => {
    const { wrapper } = await mountTab5Page()

    expect(wrapper.get('h1').text()).toBe(i18n.global.t('menu.playlist'))
    expect(wrapper.text()).toContain(i18n.global.t('playlist.empty'))
    expect(wrapper.find('[aria-label="export-playlist"]').exists()).toBe(false)
  })

  it('renders playlist entries, opens saved videos, and removes entries', async () => {
    const { playlistStore, router, wrapper } = await mountTab5Page(({ playlistStore }) => {
      playlistStore.playlist = [
        playlistItem(),
        playlistItem({
          videoId: 'video-2',
          videoName: 'Second Playlist Video',
          instanceUrl: 'video.example',
        }),
      ]
    })

    expect(wrapper.text()).toContain('Saved Playlist Video')
    expect(wrapper.text()).toContain('Playlist Channel')
    expect(wrapper.get('img').attributes('src')).toBe('https://810video.com/lazy-static/thumbnails/video-1.jpg')

    await wrapper.get('[role="button"]').trigger('click')
    await flushPromises()

    expect(sessionStorage.getItem('tempInstanceUrl')).toBe('810video.com')
    expect(router.currentRoute.value.fullPath).toBe('/tabs/video/video-1')

    const deleteButton = wrapper
      .findAll('button')
      .find((button) => button.text() === i18n.global.t('menu.delete'))

    expect(deleteButton).toBeTruthy()
    await deleteButton?.trigger('click')

    expect(playlistStore.playlist.map((item) => item.videoId)).toEqual(['video-2'])
  })

  it('exports playlist JSON with current settings', async () => {
    const { wrapper } = await mountTab5Page(({ playlistStore, settingsStore }) => {
      playlistStore.playlist = [playlistItem()]
      settingsStore.setTheme('dark')
      settingsStore.changeLanguage('en')
      settingsStore.setDefaultInstanceUrl('video.example')
      settingsStore.itemsPerPage = 40
      settingsStore.setDisplayMode('grid')
    })

    await wrapper.get('[aria-label="export-playlist"]').trigger('click')
    await flushPromises()

    const exported = JSON.parse(alertMocks.latestOptions?.inputs?.[0]?.value ?? '') as PlaylistExport
    expect(exported).toMatchObject({
      version: 1,
      exportedAt: NOW.toISOString(),
      settings: {
        defaultInstanceUrl: 'video.example',
        displayMode: 'grid',
        itemsPerPage: 40,
        locale: 'en',
        theme: 'dark',
      },
      items: [
        {
          videoId: 'video-1',
          instanceUrl: '810video.com',
        },
      ],
    })
    expect(alertMocks.present).toHaveBeenCalled()
  })

  it('imports playlist JSON and applies bundled settings', async () => {
    const { playlistStore, settingsStore, wrapper } = await mountTab5Page()
    const imported: PlaylistExport = {
      version: 1,
      exportedAt: NOW.toISOString(),
      settings: {
        defaultInstanceUrl: 'video.example',
        displayMode: 'grid',
        itemsPerPage: 40,
        locale: 'de',
        theme: 'dark',
      },
      items: [playlistItem({ videoId: 'imported-video', videoName: 'Imported Video' })],
    }

    await wrapper.get('[aria-label="import-playlist"]').trigger('click')
    await flushPromises()

    alertMocks.latestOptions?.buttons.find((button) => button.role === 'confirm')?.handler?.({
      playlistJson: JSON.stringify(imported),
    })
    await flushPromises()

    expect(playlistStore.playlist.map((item) => item.videoId)).toEqual(['imported-video'])
    expect(settingsStore.defaultInstanceUrl).toBe('video.example')
    expect(settingsStore.displayMode).toBe('grid')
    expect(settingsStore.itemsPerPage).toBe(40)
    expect(settingsStore.locale).toBe('de')
    expect(settingsStore.theme).toBe('dark')
  })

  it('shows import errors without replacing the current playlist', async () => {
    const { playlistStore, wrapper } = await mountTab5Page(({ playlistStore }) => {
      playlistStore.playlist = [playlistItem()]
    })

    await wrapper.get('[aria-label="import-playlist"]').trigger('click')
    await flushPromises()

    alertMocks.latestOptions?.buttons.find((button) => button.role === 'confirm')?.handler?.({
      playlistJson: '{',
    })
    await flushPromises()

    expect(playlistStore.playlist.map((item) => item.videoId)).toEqual(['video-1'])
    expect(wrapper.text()).toContain(i18n.global.t('playlist.importError'))
  })
})
