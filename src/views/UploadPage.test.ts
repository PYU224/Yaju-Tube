import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useUploadStore } from '@/stores/uploadStore'
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
    resumeUpload: vi.fn(),
    cancelUpload: vi.fn(),
    refreshAccessToken: vi.fn(),
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
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', Number($event.target.value))"><slot /></select>',
  },
  IonSelectOption: {
    props: ['value'],
    template: '<option :value="value"><slot /></option>',
  },
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
const mockedResumeUpload = vi.mocked(peertube.resumeUpload)
const mockedCancelUpload = vi.mocked(peertube.cancelUpload)
const mockedRefresh = vi.mocked(peertube.refreshAccessToken)

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
      clientId: 'cid',
      clientSecret: 'secret',
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

  it('refreshes an expiring access token before uploading', async () => {
    mockedRefresh.mockResolvedValue({
      accessToken: 'fresh-token',
      refreshToken: 'fresh-refresh',
      tokenType: 'Bearer',
      expiresIn: 3600,
    })
    mockedUploadVideo.mockResolvedValue({ uuid: 'uuid-refreshed' })

    const { authStore, wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'stale-token',
        refreshToken: 'r',
        tokenType: 'Bearer',
        clientId: 'cid',
        clientSecret: 'secret',
        expiresAt: 1, // already in the past -> refresh required
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

    expect(mockedRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '810video.com',
        clientId: 'cid',
        clientSecret: 'secret',
        refreshToken: 'r',
      }),
    )
    expect(authStore.accessToken).toBe('fresh-token')
    expect(mockedUploadVideo).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fresh-token' }),
    )
  })

  it('resumes a pending upload once the matching file is re-selected', async () => {
    mockedResumeUpload.mockResolvedValue({ uuid: 'resumed-uuid' })

    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
      useUploadStore().setPending({
        host: '810video.com',
        username: 'yaju',
        uploadId: 'UP-RESUME',
        name: 'Half done',
        channelId: 1,
        privacy: VIDEO_PRIVACY.PUBLIC,
        description: '',
        fileName: 'clip.mp4',
        fileSize: 8,
        fileLastModified: 1_700_000_000_000,
        uploadedBytes: 4,
      })
    })

    const resumeButton = wrapper.get('[aria-label="resume-upload"]')
    // resume stays disabled until the same file (name + size + mtime) is provided
    expect((resumeButton.element as HTMLButtonElement).disabled).toBe(true)

    const file = new File([new Uint8Array(8)], 'clip.mp4', {
      type: 'video/mp4',
      lastModified: 1_700_000_000_000,
    })
    const fileInput = wrapper.get('[data-testid="file-input"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await flushPromises()

    expect((wrapper.get('[aria-label="resume-upload"]').element as HTMLButtonElement).disabled).toBe(false)

    await wrapper.get('[aria-label="resume-upload"]').trigger('click')
    await flushPromises()

    expect(mockedResumeUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '810video.com',
        token: 'token',
        uploadId: 'UP-RESUME',
        file,
      }),
    )
    expect(wrapper.text()).toContain(i18n.global.t('upload.success'))
  })

  it('keeps resume disabled when a same-name/size file has a different mtime', async () => {
    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
      useUploadStore().setPending({
        host: '810video.com',
        username: 'yaju',
        uploadId: 'UP-RESUME',
        name: 'Half done',
        channelId: 1,
        privacy: VIDEO_PRIVACY.PUBLIC,
        description: '',
        fileName: 'clip.mp4',
        fileSize: 8,
        fileLastModified: 1_700_000_000_000,
        uploadedBytes: 4,
      })
    })

    // Same name and byte length, but a different modification time -> not the
    // same file, so resume must stay disabled.
    const file = new File([new Uint8Array(8)], 'clip.mp4', {
      type: 'video/mp4',
      lastModified: 1_700_000_999_999,
    })
    const fileInput = wrapper.get('[data-testid="file-input"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await flushPromises()

    expect((wrapper.get('[aria-label="resume-upload"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('discards a pending upload server-side and hides the resume banner', async () => {
    mockedCancelUpload.mockResolvedValue(undefined)

    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
      useUploadStore().setPending({
        host: '810video.com',
        username: 'yaju',
        uploadId: 'UP-DISCARD',
        name: 'X',
        channelId: 1,
        privacy: VIDEO_PRIVACY.PUBLIC,
        description: '',
        fileName: 'a.mp4',
        fileSize: 10,
        fileLastModified: 1_700_000_000_000,
        uploadedBytes: 5,
      })
    })

    await wrapper.get('[aria-label="discard-upload"]').trigger('click')
    await flushPromises()

    expect(mockedCancelUpload).toHaveBeenCalledWith(
      expect.objectContaining({ uploadId: 'UP-DISCARD' }),
    )
    expect(wrapper.find('[aria-label="resume-upload"]').exists()).toBe(false)
  })

  it('hides the view-video button for a private upload', async () => {
    mockedUploadVideo.mockResolvedValue({ uuid: 'uuid-private' })

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
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })
    await fileInput.trigger('change')
    await flushPromises()

    // Select Private in the privacy select (the last <select> on the page).
    const selects = wrapper.findAll('select')
    const privacySelect = selects[selects.length - 1]!
    ;(privacySelect.element as HTMLSelectElement).value = String(VIDEO_PRIVACY.PRIVATE)
    await privacySelect.trigger('change')

    await wrapper.get('[aria-label="start-upload"]').trigger('click')
    await flushPromises()

    expect(mockedUploadVideo).toHaveBeenCalledWith(
      expect.objectContaining({ privacy: VIDEO_PRIVACY.PRIVATE }),
    )
    expect(wrapper.text()).toContain(i18n.global.t('upload.success'))
    // Private videos can't load through the public embed, so no view link.
    expect(wrapper.find('[aria-label="view-video"]').exists()).toBe(false)
  })

  it('disables Start upload while a pending upload exists', async () => {
    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
      useUploadStore().setPending({
        host: '810video.com',
        username: 'yaju',
        uploadId: 'UP-OLD',
        name: 'Old clip',
        channelId: 1,
        privacy: VIDEO_PRIVACY.PUBLIC,
        description: '',
        fileName: 'old.mp4',
        fileSize: 4,
        fileLastModified: 1_700_000_000_000,
        uploadedBytes: 2,
      })
    })

    // The user must Resume or Discard the pending upload before starting another.
    expect((wrapper.get('[aria-label="start-upload"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables logout while an upload is in progress', async () => {
    let resolveUpload!: (result: { uuid: string }) => void
    mockedUploadVideo.mockImplementation(
      () => new Promise((resolve) => { resolveUpload = resolve }),
    )

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
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })
    await fileInput.trigger('change')
    await flushPromises()

    await wrapper.get('[aria-label="start-upload"]').trigger('click')
    await flushPromises()

    expect((wrapper.get('[aria-label="logout"]').element as HTMLButtonElement).disabled).toBe(true)

    resolveUpload({ uuid: 'uuid-done' })
    await flushPromises()

    expect((wrapper.get('[aria-label="logout"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps the pending upload when discard fails with a non-404 error', async () => {
    mockedCancelUpload.mockRejectedValue({ response: { status: 500 } })

    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
      useUploadStore().setPending({
        host: '810video.com',
        username: 'yaju',
        uploadId: 'UP-KEEP',
        name: 'Keep me',
        channelId: 1,
        privacy: VIDEO_PRIVACY.PUBLIC,
        description: '',
        fileName: 'k.mp4',
        fileSize: 4,
        fileLastModified: 1_700_000_000_000,
        uploadedBytes: 2,
      })
    })

    await wrapper.get('[aria-label="discard-upload"]').trigger('click')
    await flushPromises()

    expect(mockedCancelUpload).toHaveBeenCalledWith(
      expect.objectContaining({ uploadId: 'UP-KEEP' }),
    )
    // Cancellation failed, so the banner stays for a retry.
    expect(wrapper.find('[aria-label="resume-upload"]').exists()).toBe(true)
  })

  it('does not show a pending upload that belongs to a different account', async () => {
    const { wrapper } = await mountUploadPage(({ authStore }) => {
      authStore.setSession({
        accessToken: 'token',
        username: 'yaju',
        host: '810video.com',
        channels: [channel()],
      })
      useUploadStore().setPending({
        host: '810video.com',
        username: 'someone-else',
        uploadId: 'UP-OTHER',
        name: 'Their clip',
        channelId: 1,
        privacy: VIDEO_PRIVACY.PUBLIC,
        description: '',
        fileName: 'x.mp4',
        fileSize: 4,
        fileLastModified: 1_700_000_000_000,
        uploadedBytes: 2,
      })
    })

    expect(wrapper.find('[aria-label="resume-upload"]').exists()).toBe(false)
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
