import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { type HistoryItem, useHistoryStore } from '@/stores/historyStore'
import Tab4Page from './Tab4Page.vue'

type AlertButton = {
  text: string
  role?: string
  handler?: () => void
}

type AlertOptions = {
  header: string
  message: string
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
const ONE_DAY_MS = 24 * 60 * 60 * 1000

const ionicStubs = {
  IonPage: { template: '<main><slot /></main>' },
  IonHeader: { template: '<header><slot /></header>' },
  IonToolbar: { template: '<div><slot /></div>' },
  IonTitle: { template: '<h1><slot /></h1>' },
  IonContent: { template: '<section><slot /></section>' },
  IonList: { template: '<div><slot /></div>' },
  IonListHeader: { template: '<h2><slot /></h2>' },
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
    template: '<button aria-label="clear-history" @click="$emit(\'click\', $event)"><slot /></button>',
  },
}

function historyItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    videoId: 'video-1',
    videoName: 'Test History Video',
    thumbnailPath: '/lazy-static/thumbnails/video-1.jpg',
    channelName: 'History Channel',
    instanceUrl: '810video.com',
    watchedAt: NOW.getTime(),
    ...overrides,
  }
}

async function mountTab4Page(setupHistory?: (historyStore: ReturnType<typeof useHistoryStore>) => void) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const historyStore = useHistoryStore()
  setupHistory?.(historyStore)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tabs/tab4', component: { template: '<div />' } },
      { path: '/tabs/video/:videoId', component: { template: '<div />' } },
    ],
  })
  await router.push('/tabs/tab4')
  await router.isReady()

  const wrapper = mount(Tab4Page, {
    global: {
      plugins: [pinia, router, i18n],
      stubs: ionicStubs,
    },
  })
  await flushPromises()

  return { historyStore, router, wrapper }
}

describe('Tab4Page', () => {
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

  it('renders the empty history state without the clear button', async () => {
    const { wrapper } = await mountTab4Page()

    expect(wrapper.get('h1').text()).toBe(i18n.global.t('menu.history'))
    expect(wrapper.text()).toContain(i18n.global.t('menu.noHistory'))
    expect(wrapper.find('[aria-label="clear-history"]').exists()).toBe(false)
  })

  it('renders grouped history entries with thumbnails, relative dates, and progress bars', async () => {
    const { wrapper } = await mountTab4Page((historyStore) => {
      historyStore.history = [
        historyItem({
          videoId: 'today',
          videoName: 'Today Video',
          watchedAt: NOW.getTime() - 30_000,
          progress: 60,
          duration: 120,
        }),
        historyItem({
          videoId: 'minutes-ago',
          videoName: 'Minutes Ago Video',
          watchedAt: NOW.getTime() - 5 * 60_000,
        }),
        historyItem({
          videoId: 'hours-ago',
          videoName: 'Hours Ago Video',
          watchedAt: NOW.getTime() - 2 * 60 * 60 * 1000,
        }),
        historyItem({
          videoId: 'yesterday',
          videoName: 'Yesterday Video',
          watchedAt: NOW.getTime() - 36 * 60 * 60 * 1000,
          progress: 15,
          duration: 60,
        }),
        historyItem({
          videoId: 'week',
          videoName: 'This Week Video',
          watchedAt: NOW.getTime() - 3 * ONE_DAY_MS,
          progress: 30,
          duration: 60,
        }),
        historyItem({
          videoId: 'month',
          videoName: 'This Month Video',
          watchedAt: NOW.getTime() - 10 * ONE_DAY_MS,
          progress: 45,
          duration: 60,
        }),
        historyItem({
          videoId: 'older',
          videoName: 'Older Video',
          watchedAt: NOW.getTime() - 40 * ONE_DAY_MS,
          progress: 60,
          duration: 60,
        }),
      ]
    })

    expect(wrapper.text()).toContain(i18n.global.t('history.today'))
    expect(wrapper.text()).toContain(i18n.global.t('history.yesterday'))
    expect(wrapper.text()).toContain(i18n.global.t('history.thisWeek'))
    expect(wrapper.text()).toContain(i18n.global.t('history.thisMonth'))
    expect(wrapper.text()).toContain(i18n.global.t('history.older'))
    expect(wrapper.text()).toContain('Today Video')
    expect(wrapper.text()).toContain(i18n.global.t('history.justNow'))
    expect(wrapper.text()).toContain(i18n.global.t('history.minutesAgo', { n: 5 }))
    expect(wrapper.text()).toContain(i18n.global.t('history.hoursAgo', { n: 2 }))
    expect(wrapper.get('img').attributes('src')).toBe('https://810video.com/lazy-static/thumbnails/video-1.jpg')
    expect(wrapper.get('.progress-fill').attributes('style')).toContain('width: 50%;')
  })

  it('opens watched videos from every history group', async () => {
    const { router, wrapper } = await mountTab4Page((historyStore) => {
      historyStore.history = [
        historyItem({ videoId: 'yesterday', videoName: 'Yesterday Video', watchedAt: NOW.getTime() - 36 * 60 * 60 * 1000 }),
        historyItem({ videoId: 'week', videoName: 'This Week Video', watchedAt: NOW.getTime() - 3 * ONE_DAY_MS }),
        historyItem({ videoId: 'month', videoName: 'This Month Video', watchedAt: NOW.getTime() - 10 * ONE_DAY_MS }),
        historyItem({ videoId: 'older', videoName: 'Older Video', watchedAt: NOW.getTime() - 40 * ONE_DAY_MS }),
      ]
    })

    const expectedRoutes = [
      ['Yesterday Video', '/tabs/video/yesterday'],
      ['This Week Video', '/tabs/video/week'],
      ['This Month Video', '/tabs/video/month'],
      ['Older Video', '/tabs/video/older'],
    ] as const

    for (const [label, route] of expectedRoutes) {
      const item = wrapper
        .findAll('[role="button"]')
        .find((button) => button.text().includes(label))

      expect(item).toBeTruthy()
      await item?.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe(route)
    }
  })

  it('removes entries from every non-today history group', async () => {
    const { historyStore, wrapper } = await mountTab4Page((historyStore) => {
      historyStore.history = [
        historyItem({ videoId: 'yesterday', videoName: 'Yesterday Video', watchedAt: NOW.getTime() - 36 * 60 * 60 * 1000 }),
        historyItem({ videoId: 'week', videoName: 'This Week Video', watchedAt: NOW.getTime() - 3 * ONE_DAY_MS }),
        historyItem({ videoId: 'month', videoName: 'This Month Video', watchedAt: NOW.getTime() - 10 * ONE_DAY_MS }),
        historyItem({ videoId: 'older', videoName: 'Older Video', watchedAt: NOW.getTime() - 40 * ONE_DAY_MS }),
      ]
    })

    for (const expectedRemaining of [
      ['week', 'month', 'older'],
      ['month', 'older'],
      ['older'],
      [],
    ]) {
      const deleteButton = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('menu.delete'))

      expect(deleteButton).toBeTruthy()
      await deleteButton?.trigger('click')
      await wrapper.vm.$nextTick()
      expect(historyStore.history.map((item) => item.videoId)).toEqual(expectedRemaining)
    }
  })

  it('opens a watched video from history using the saved instance URL', async () => {
    const { router, wrapper } = await mountTab4Page((historyStore) => {
      historyStore.history = [
        historyItem({
          videoId: 'resume-video',
          videoName: 'Resume Video',
          instanceUrl: 'video.example',
        }),
      ]
    })

    await wrapper.get('[role="button"]').trigger('click')
    await flushPromises()

    expect(sessionStorage.getItem('tempInstanceUrl')).toBe('video.example')
    expect(router.currentRoute.value.fullPath).toBe('/tabs/video/resume-video')
  })

  it('removes individual history entries', async () => {
    const { historyStore, wrapper } = await mountTab4Page((historyStore) => {
      historyStore.history = [
        historyItem({ videoId: 'keep-video', videoName: 'Keep Video' }),
        historyItem({ videoId: 'delete-video', videoName: 'Delete Video' }),
      ]
    })

    const deleteButton = wrapper
      .findAll('button')
      .find((button) => button.text() === i18n.global.t('menu.delete'))
    expect(deleteButton).toBeTruthy()
    await deleteButton?.trigger('click')

    expect(historyStore.history).toHaveLength(1)
    expect(historyStore.history[0]?.videoId).toBe('delete-video')
  })

  it('clears all history through the confirmation alert destructive action', async () => {
    const { historyStore, wrapper } = await mountTab4Page((historyStore) => {
      historyStore.history = [
        historyItem({ videoId: 'video-1' }),
        historyItem({ videoId: 'video-2' }),
      ]
    })

    await wrapper.get('[aria-label="clear-history"]').trigger('click')
    await flushPromises()

    expect(alertMocks.create).toHaveBeenCalledWith({
      header: i18n.global.t('history.clearAll'),
      message: i18n.global.t('history.clearConfirm'),
      buttons: [
        {
          text: i18n.global.t('menu.cancel'),
          role: 'cancel',
        },
        {
          text: i18n.global.t('menu.delete'),
          role: 'destructive',
          handler: expect.any(Function),
        },
      ],
    })
    expect(alertMocks.present).toHaveBeenCalled()

    alertMocks.latestOptions?.buttons.find((button) => button.role === 'destructive')?.handler?.()

    expect(historyStore.history).toEqual([])
  })
})
