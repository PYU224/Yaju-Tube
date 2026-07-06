import { flushPromises, mount } from '@vue/test-utils'
import type { AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import API from '@/api'
import i18n from '@/i18n'
import { useInstanceStore } from '@/stores/instanceStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Video, VideoListResponse } from '@/types/video'
import { axiosError, createTestRouter, testGlobal } from '@/testUtils'
import Tab2Page from './Tab2Page.vue'

vi.mock('@/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

const sampleVideo: Video = {
  uuid: 'video-1',
  name: 'PeerTube Test Video',
  thumbnailPath: '/lazy-static/thumbnails/video-1.jpg',
  channel: {
    name: 'remote-creator',
    displayName: 'Remote Creator',
    host: 'remote.example',
  },
  publishedAt: '2026-05-04T00:00:00.000Z',
}

const localVideo: Video = {
  uuid: 'video-2',
  name: 'Local Channel Video',
  thumbnailPath: '/lazy-static/thumbnails/video-2.jpg',
  channel: {
    name: 'local-channel',
    host: '810video.com',
  },
  publishedAt: '2026-05-04T01:00:00.000Z',
}

const ionicStubs = {
  IonPage: { template: '<main><slot /></main>' },
  IonHeader: { template: '<header><slot /></header>' },
  IonToolbar: { template: '<div><slot /></div>' },
  IonTitle: { template: '<h1><slot /></h1>' },
  IonContent: { template: '<section><slot /></section>' },
  IonFooter: { template: '<footer><slot /></footer>' },
  IonList: { template: '<div><slot /></div>' },
  IonItem: {
    name: 'IonItem',
    emits: ['click'],
    template: '<div role="button" @click="$emit(\'click\', $event)"><slot /></div>',
  },
  IonThumbnail: { template: '<div><slot /></div>' },
  IonLabel: { template: '<span><slot /></span>' },
  IonButton: {
    name: 'IonButton',
    props: ['disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  IonInput: {
    name: 'IonInput',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
  },
  IonSearchbar: {
    name: 'IonSearchbar',
    props: ['modelValue'],
    emits: ['update:modelValue', 'ionInput'],
    template: '<input :value="modelValue" />',
  },
  IonSelect: {
    name: 'IonSelect',
    props: ['modelValue'],
    emits: ['update:modelValue', 'ionChange'],
    template: '<select><slot /></select>',
  },
  IonSelectOption: { template: '<option><slot /></option>' },
  IonSegment: {
    name: 'IonSegment',
    props: ['modelValue'],
    emits: ['update:modelValue', 'ionChange'],
    template: '<div><slot /></div>',
  },
  IonSegmentButton: { template: '<button><slot /></button>' },
  IonAccordion: { template: '<div><slot /></div>' },
  IonAccordionGroup: { template: '<div><slot /></div>' },
  IonIcon: { template: '<span />' },
  IonCard: { template: '<article><slot /></article>' },
  IonCardHeader: { template: '<header><slot /></header>' },
  IonCardTitle: { template: '<h2><slot /></h2>' },
  IonCardSubtitle: { template: '<p><slot /></p>' },
  RecycleScroller: {
    name: 'RecycleScroller',
    props: ['items'],
    template: `
      <div data-testid="recycle-scroller">
        <template v-for="item in items" :key="item.uuid">
          <slot :item="item" />
        </template>
      </div>
    `,
  },
}

function mockVideoList(videos: Video[] = [sampleVideo], total = videos.length) {
  vi.mocked(API.get).mockResolvedValue({
    data: {
      data: videos,
      total,
    } satisfies VideoListResponse,
  } as AxiosResponse<VideoListResponse>)
}

function mockRawVideoListData(data: Partial<VideoListResponse>) {
  vi.mocked(API.get).mockResolvedValue({
    data,
  } as AxiosResponse<Partial<VideoListResponse>>)
}

async function mountTab2Page() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const instanceStore = useInstanceStore()
  const settingsStore = useSettingsStore()
  const router = createTestRouter([
    { path: '/tabs/tab2', component: { template: '<div />' } },
    { path: '/tabs/video/:videoId', component: { template: '<div />' } },
  ])
  await router.push('/tabs/tab2')
  await router.isReady()

  const wrapper = mount(Tab2Page, {
    global: testGlobal(pinia, router, ionicStubs),
  })
  await flushPromises()

  return { instanceStore, router, settingsStore, wrapper }
}

describe('Tab2Page', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockVideoList([sampleVideo], 45)
  })

  it('loads and renders the first page of videos for the selected instance', async () => {
    const { wrapper } = await mountTab2Page()

    expect(API.get).toHaveBeenCalledWith('https://810video.com/api/v1/videos', {
      params: { sort: '-publishedAt', start: 0, count: 20 },
      timeout: 10000,
    })
    expect(wrapper.text()).toContain('PeerTube Test Video')
    expect(wrapper.text()).toContain('Remote Creator@remote.example')
    expect(wrapper.get('img').attributes('src')).toBe('https://810video.com/lazy-static/thumbnails/video-1.jpg')
  })

  it('renders same-instance channel names without a remote host suffix', async () => {
    mockVideoList([localVideo], 1)

    const { wrapper } = await mountTab2Page()

    expect(wrapper.text()).toContain('Local Channel Video')
    expect(wrapper.text()).toContain('local-channel')
    expect(wrapper.text()).not.toContain('local-channel@810video.com')
  })

  it('navigates to the selected video detail route', async () => {
    const { router, wrapper } = await mountTab2Page()

    await wrapper.get('.video-item').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/tabs/video/video-1')
  })

  it('reloads videos with search, sort, local filter, and page parameters', async () => {
    const { wrapper } = await mountTab2Page()
    vi.mocked(API.get).mockClear()

    const searchbar = wrapper.getComponent({ name: 'IonSearchbar' })
    searchbar.vm.$emit('update:modelValue', '  peertube  ')
    await wrapper.vm.$nextTick()
    searchbar.vm.$emit('ionInput')
    await flushPromises()

    const sortSelect = wrapper.getComponent({ name: 'IonSelect' })
    sortSelect.vm.$emit('update:modelValue', '-views')
    await wrapper.vm.$nextTick()
    sortSelect.vm.$emit('ionChange')
    await flushPromises()

    const filterSegment = wrapper.getComponent({ name: 'IonSegment' })
    filterSegment.vm.$emit('update:modelValue', 'local')
    await wrapper.vm.$nextTick()
    filterSegment.vm.$emit('ionChange')
    await flushPromises()

    const nextButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '＞')
    expect(nextButton).toBeTruthy()
    await nextButton?.trigger('click')
    await flushPromises()

    expect(API.get).toHaveBeenLastCalledWith('https://810video.com/api/v1/videos', {
      params: {
        sort: '-views',
        start: 20,
        count: 20,
        isLocal: true,
        search: 'peertube',
      },
      timeout: 10000,
    })

    const prevButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '＜')
    expect(prevButton).toBeTruthy()
    await prevButton?.trigger('click')
    await flushPromises()

    expect(API.get).toHaveBeenLastCalledWith('https://810video.com/api/v1/videos', {
      params: {
        sort: '-views',
        start: 0,
        count: 20,
        isLocal: true,
        search: 'peertube',
      },
      timeout: 10000,
    })

    const pageInput = wrapper.getComponent({ name: 'IonInput' })
    pageInput.vm.$emit('update:modelValue', 2)
    await wrapper.vm.$nextTick()

    const goButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'ページ')
    expect(goButton).toBeTruthy()
    await goButton?.trigger('click')
    await flushPromises()

    expect(API.get).toHaveBeenLastCalledWith('https://810video.com/api/v1/videos', {
      params: {
        sort: '-views',
        start: 20,
        count: 20,
        isLocal: true,
        search: 'peertube',
      },
      timeout: 10000,
    })
  })

  it('switches display modes and falls back when thumbnails fail to load', async () => {
    const { router, settingsStore, wrapper } = await mountTab2Page()

    const gridButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Grid'))
    expect(gridButton).toBeTruthy()
    await gridButton?.trigger('click')
    await wrapper.vm.$nextTick()

    const image = wrapper.get('img')
    await image.trigger('error')

    expect(settingsStore.displayMode).toBe('grid')
    expect(wrapper.find('.video-card').exists()).toBe(true)
    expect(image.attributes('src')).toBe('/placeholder.png')
    expect(image.attributes('alt')).toBe('サムネイル画像が利用できません')

    await wrapper.get('.video-card').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/tabs/video/video-1')

    const listButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('List'))
    expect(listButton).toBeTruthy()
    await listButton?.trigger('click')
    await wrapper.vm.$nextTick()

    expect(settingsStore.displayMode).toBe('list')
    expect(wrapper.find('[data-testid="recycle-scroller"]').exists()).toBe(true)
  })

  it('reloads from the first page when the page size changes', async () => {
    const { settingsStore } = await mountTab2Page()
    vi.mocked(API.get).mockClear()

    settingsStore.itemsPerPage = 10
    await flushPromises()

    expect(API.get).toHaveBeenLastCalledWith('https://810video.com/api/v1/videos', {
      params: { sort: '-publishedAt', start: 0, count: 10 },
      timeout: 10000,
    })
  })

  it('renders the default empty state when the API omits video data and totals', async () => {
    mockRawVideoListData({})

    const { wrapper } = await mountTab2Page()

    expect(wrapper.text()).toContain(i18n.global.t('menu.getVideo'))
  })

  it.each([
    ['timeout', axiosError({ code: 'ECONNABORTED' }), i18n.global.t('errors.timeout')],
    [
      'HTTP response',
      axiosError({ response: { status: 500, statusText: 'Server Error' } }),
      i18n.global.t('errors.httpError', { status: 500, statusText: 'Server Error' }),
    ],
    ['network', axiosError({ request: {} }), i18n.global.t('errors.networkError')],
    ['request setup', axiosError(), i18n.global.t('errors.requestError')],
    ['unexpected', new Error('boom'), i18n.global.t('errors.unexpected')],
  ])('renders the %s loading error state', async (_label, error, expectedMessage) => {
    vi.mocked(API.get).mockRejectedValue(error)

    const { wrapper } = await mountTab2Page()

    expect(wrapper.text()).toContain(expectedMessage)
  })
})
