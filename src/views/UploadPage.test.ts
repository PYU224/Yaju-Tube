import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import type { VideoChannel } from '@/api/peertube'
import { VIDEO_PRIVACY } from '@/api/peertube'
import * as peertube from '@/api/peertube'
import UploadPage from './UploadPage.vue'

vi.mock('@/api/peertube', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/peertube')>()

  return {
    ...actual,
    login: vi.fn(),
    getMyAccount: vi.fn(),
    uploadVideo: vi.fn(),
    cancelUpload: vi.fn(),
  }
})

const ionicStubs = {
  IonPage: { template: '<main><slot /></main>' },
  IonHeader: { template: '<header><slot /></header>' },
  IonToolbar: { template: '<div><slot /></div>' },
  IonTitle: { template: '<h1><slot /></h1>' },
  IonContent: { template: '<section><slot /></section>' },
  IonList: { template: '<div><slot /></div>' },
  IonItem: { template: '<div><slot /></div>' },
  IonLabel: { template: '<span><slot /></span>' },
  IonIcon: { template: '<span />' },
  IonInput: {
    name: 'IonInput',
    props: ['modelValue', 'type'],
    emits: ['update:modelValue'],
    template:
      '<input :type="type" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  IonTextarea: {
    name: 'IonTextarea',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  IonSelect: {
    name: 'IonSelect',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<select><slot /></select>',
  },
  IonSelectOption: { template: '<option><slot /></option>' },
  IonProgressBar: {
    name: 'IonProgressBar',
    props: ['value'],
    template: '<progress :value="value" />',
  },
  IonButton: {
    name: 'IonButton',
    emits: ['click'],
    props: ['ariaLabel', 'disabled'],
    template:
      '<button :aria-label="ariaLabel" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  },
}

function channel(overrides: Partial<VideoChannel> = {}): VideoChannel {
  return {
    id: 1,
    name: 'my_channel',
    displayName: 'My Channel',
    ...overrides,
  }
}

async function mountUploadPage(setup?: (stores: {
  authStore: ReturnType<typeof useAuthStore>
}) => void) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  setup?.({ authStore })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tabs/tab6', component: { template: '<div />' } },
      { path: '/tabs/video/:videoId', component: { template: '<div />' } },
    ],
  })
  await router.push('/tabs/tab6')
  await router.isReady()

  const wrapper = mount(UploadPage, {
    global: {
      plugins: [pinia, router, i18n],
      stubs: ionicStubs,
    },
  })
  await flushPromises()

  return { authStore, router, wrapper }
}

const mockedLogin = vi.mocked(peertube.login)
const mockedGetMyAccount = vi.mocked(peertube.getMyAccount)
const mockedUploadVideo = vi.mocked(peertube.uploadVideo)
const mockedCancelUpload = vi.mocked(peertube.cancelUpload)

describe('UploadPage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the login form when logged out', async () => {
    const { wrapper } = await mountUploadPage()

    expect(wrapper.find('[aria-label="login"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="start-upload"]').exists()).toBe(false)
  })

  it('logs in, calls setSession, and reveals the upload form', async () => {
    mockedLogin.mockResolvedValue({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      tokenType: 'Bearer',
    })
    mockedGetMyAccount.mockResolvedValue({
      username: 'yaju',
      channels: [channel()],
    })

    const { authStore, wrapper } = await mountUploadPage()

    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('810video.com')
    await inputs[1]!.setValue('yaju')
    await inputs[2]!.setValue('secret')

    await wrapper.get('[aria-label="login"]').trigger('click')
    await flushPromises()

    expect(mockedLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '810video.com',
        username: 'yaju',
        password: 'secret',
      }),
    )
    expect(authStore.accessToken).toBe('token-123')
    expect(authStore.username).toBe('yaju')
    expect(authStore.host).toBe('810video.com')
    expect(authStore.channels).toHaveLength(1)
    expect(wrapper.find('[aria-label="start-upload"]').exists()).toBe(true)
  })

  it('renders channels for a logged-in user', async () => {
    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel({ displayName: 'Channel A' }), channel({ id: 2, displayName: 'Channel B' })],
      })
    })

    expect(wrapper.text()).toContain('Channel A')
    expect(wrapper.text()).toContain('Channel B')
  })

  it('defaults the video name when a file is selected', async () => {
    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
    })

    const file = new File(['data'], 'my-cool-video.mp4', { type: 'video/mp4' })
    const fileInput = wrapper.get('[data-testid="file-input"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await flushPromises()

    const nameInput = wrapper.findAll('input').find(
      (input) => (input.element as HTMLInputElement).value === 'my-cool-video',
    )
    expect(nameInput).toBeTruthy()
  })

  it('starts an upload, shows success, and exposes a view-video button', async () => {
    mockedUploadVideo.mockResolvedValue({ uuid: 'uuid-abc' })

    const { router, wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
    })

    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
    const fileInput = wrapper.get('[data-testid="file-input"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await flushPromises()

    await wrapper.get('[aria-label="start-upload"]').trigger('click')
    await flushPromises()

    expect(mockedUploadVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '810video.com',
        token: 'token',
        file,
        name: 'clip',
        channelId: 1,
        privacy: VIDEO_PRIVACY.PUBLIC,
      }),
    )
    expect(wrapper.text()).toContain(i18n.global.t('upload.success'))

    expect(wrapper.find('[aria-label="view-video"]').exists()).toBe(true)
    const viewButton = wrapper.get('[aria-label="view-video"]')

    await viewButton.trigger('click')
    await flushPromises()

    expect(sessionStorage.getItem('tempInstanceUrl')).toBe('810video.com')
    expect(router.currentRoute.value.fullPath).toBe('/tabs/video/uuid-abc')
  })

  it('blocks upload and shows the no-channel message when the account has no channel', async () => {
    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [],
      })
    })

    expect(wrapper.text()).toContain(i18n.global.t('upload.noChannels'))
    const startButton = wrapper.get('[aria-label="start-upload"]')
    expect((startButton.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('cancels the server-side upload when cancel is tapped mid-upload', async () => {
    mockedCancelUpload.mockResolvedValue(undefined)
    let resolveUpload!: (result: { uuid: string }) => void
    mockedUploadVideo.mockImplementation((params) => {
      params.onInit?.('UPID-1')

      return new Promise((resolve) => {
        resolveUpload = resolve
      })
    })

    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
    })

    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
    const fileInput = wrapper.get('[data-testid="file-input"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await flushPromises()

    await wrapper.get('[aria-label="start-upload"]').trigger('click')
    await flushPromises()

    await wrapper.get('[aria-label="cancel-upload"]').trigger('click')
    await flushPromises()

    expect(mockedCancelUpload).toHaveBeenCalledWith(
      expect.objectContaining({ host: '810video.com', token: 'token', uploadId: 'UPID-1' }),
    )

    resolveUpload({ uuid: 'done' })
    await flushPromises()
  })

  it('logs out and resets the store', async () => {
    const { authStore, wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
    })

    await wrapper.get('[aria-label="logout"]').trigger('click')
    await flushPromises()

    expect(authStore.accessToken).toBeNull()
    expect(authStore.username).toBeNull()
    expect(authStore.host).toBeNull()
    expect(authStore.channels).toEqual([])
    expect(wrapper.find('[aria-label="login"]').exists()).toBe(true)
  })
})
