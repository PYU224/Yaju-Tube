import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { type PendingUpload, useUploadStore } from './uploadStore'

function pending(overrides: Partial<PendingUpload> = {}): PendingUpload {
  return {
    host: 'peertube.example',
    username: 'alice',
    uploadId: 'UP-1',
    name: 'My Video',
    channelId: 3,
    privacy: 1,
    description: '',
    fileName: 'clip.mp4',
    fileSize: 2048,
    fileLastModified: 1_700_000_000_000,
    uploadedBytes: 0,
    ...overrides,
  }
}

describe('uploadStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty', () => {
    const store = useUploadStore()

    expect(store.pendingFor('peertube.example', 'alice')).toBeNull()
  })

  it('sets, updates progress on, and clears a pending upload per account', () => {
    const store = useUploadStore()

    store.setPending(pending())
    expect(store.pendingFor('peertube.example', 'alice')?.uploadId).toBe('UP-1')

    store.updateProgress('peertube.example', 'alice', 1024)
    expect(store.pendingFor('peertube.example', 'alice')?.uploadedBytes).toBe(1024)

    store.clearPending('peertube.example', 'alice')
    expect(store.pendingFor('peertube.example', 'alice')).toBeNull()
  })

  it('keeps uploads for different accounts on the same host separate', () => {
    const store = useUploadStore()

    store.setPending(pending({ username: 'alice', uploadId: 'UP-A' }))
    store.setPending(pending({ username: 'bob', uploadId: 'UP-B' }))

    expect(store.pendingFor('peertube.example', 'alice')?.uploadId).toBe('UP-A')
    expect(store.pendingFor('peertube.example', 'bob')?.uploadId).toBe('UP-B')

    // Clearing one account must not disturb the other account's pending upload.
    store.clearPending('peertube.example', 'alice')
    expect(store.pendingFor('peertube.example', 'alice')).toBeNull()
    expect(store.pendingFor('peertube.example', 'bob')?.uploadId).toBe('UP-B')
  })

  it('ignores progress updates when there is no matching pending upload', () => {
    const store = useUploadStore()

    expect(() => store.updateProgress('peertube.example', 'nobody', 500)).not.toThrow()
    expect(store.pendingFor('peertube.example', 'nobody')).toBeNull()
  })
})
