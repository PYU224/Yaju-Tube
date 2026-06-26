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

    expect(store.pending).toBeNull()
    expect(store.hasPending).toBe(false)
  })

  it('sets, updates progress on, and clears a pending upload', () => {
    const store = useUploadStore()

    store.setPending(pending())
    expect(store.hasPending).toBe(true)
    expect(store.pending?.uploadId).toBe('UP-1')

    store.updateProgress(1024)
    expect(store.pending?.uploadedBytes).toBe(1024)

    store.clearPending()
    expect(store.pending).toBeNull()
    expect(store.hasPending).toBe(false)
  })

  it('ignores progress updates when there is no pending upload', () => {
    const store = useUploadStore()

    expect(() => store.updateProgress(500)).not.toThrow()
    expect(store.pending).toBeNull()
  })
})
