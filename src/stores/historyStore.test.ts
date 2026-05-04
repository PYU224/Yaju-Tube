import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type HistoryItem, useHistoryStore } from './historyStore'

const NOW = new Date('2026-05-04T12:00:00.000Z')
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function makeHistoryItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    videoId: 'video-1',
    videoName: 'Test Video',
    thumbnailPath: '/thumbnail.jpg',
    channelName: 'Test Channel',
    instanceUrl: '810video.com',
    watchedAt: NOW.getTime(),
    ...overrides,
  }
}

describe('historyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds new history items newest first, deduplicates videos, and keeps the latest 100 entries', () => {
    const store = useHistoryStore()

    for (let index = 0; index < 101; index += 1) {
      store.addToHistory({
        videoId: `video-${index}`,
        videoName: `Video ${index}`,
        thumbnailPath: `/thumbnail-${index}.jpg`,
        channelName: 'Test Channel',
        instanceUrl: '810video.com',
      })
    }

    expect(store.history).toHaveLength(100)
    expect(store.history[0]).toMatchObject({
      videoId: 'video-100',
      watchedAt: NOW.getTime(),
    })
    expect(store.history.some((item) => item.videoId === 'video-0')).toBe(false)

    store.addToHistory({
      videoId: 'video-50',
      videoName: 'Updated Video 50',
      thumbnailPath: '/updated-thumbnail.jpg',
      channelName: 'Updated Channel',
      instanceUrl: 'video.example',
    })

    expect(store.history).toHaveLength(100)
    expect(store.history[0]).toMatchObject({
      videoId: 'video-50',
      videoName: 'Updated Video 50',
      thumbnailPath: '/updated-thumbnail.jpg',
      channelName: 'Updated Channel',
      instanceUrl: 'video.example',
    })
    expect(store.history.filter((item) => item.videoId === 'video-50')).toHaveLength(1)
  })

  it('updates playback progress and watched time for existing history entries', () => {
    const store = useHistoryStore()
    store.history = [makeHistoryItem({ watchedAt: NOW.getTime() - ONE_DAY_MS })]

    const updatedAt = new Date('2026-05-04T12:05:00.000Z')
    vi.setSystemTime(updatedAt)
    store.updateProgress('video-1', 120, 300)

    expect(store.history[0]).toMatchObject({
      progress: 120,
      duration: 300,
      watchedAt: updatedAt.getTime(),
    })

    store.updateProgress('missing-video', 20, 40)
    expect(store.history).toHaveLength(1)

    store.updateProgress('video-1', 180)
    expect(store.history[0]).toMatchObject({
      progress: 180,
      duration: 300,
    })
  })

  it('keeps saved playback progress when refreshing an existing history entry', () => {
    const store = useHistoryStore()
    store.history = [
      makeHistoryItem({
        progress: 75,
        duration: 300,
        watchedAt: NOW.getTime() - ONE_DAY_MS,
      }),
    ]

    store.addToHistory({
      videoId: 'video-1',
      videoName: 'Updated Video',
      thumbnailPath: '/updated-thumbnail.jpg',
      channelName: 'Updated Channel',
      instanceUrl: 'video.example',
    })

    expect(store.history).toHaveLength(1)
    expect(store.history[0]).toMatchObject({
      videoId: 'video-1',
      videoName: 'Updated Video',
      thumbnailPath: '/updated-thumbnail.jpg',
      channelName: 'Updated Channel',
      instanceUrl: 'video.example',
      progress: 75,
      duration: 300,
      watchedAt: NOW.getTime(),
    })
  })

  it('removes individual entries, clears all history, and returns items by video id', () => {
    const store = useHistoryStore()
    store.history = [
      makeHistoryItem({ videoId: 'video-1' }),
      makeHistoryItem({ videoId: 'video-2' }),
    ]

    expect(store.getHistoryItem('video-2')).toMatchObject({ videoId: 'video-2' })

    store.removeFromHistory('video-1')
    expect(store.history.map((item) => item.videoId)).toEqual(['video-2'])

    store.clearHistory()
    expect(store.history).toEqual([])
    expect(store.getHistoryItem('video-2')).toBeUndefined()
  })

  it('groups history by relative watch date', () => {
    const store = useHistoryStore()
    store.history = [
      makeHistoryItem({ videoId: 'today', watchedAt: NOW.getTime() - 60 * 60 * 1000 }),
      makeHistoryItem({ videoId: 'yesterday', watchedAt: NOW.getTime() - 25 * 60 * 60 * 1000 }),
      makeHistoryItem({ videoId: 'this-week', watchedAt: NOW.getTime() - 3 * ONE_DAY_MS }),
      makeHistoryItem({ videoId: 'this-month', watchedAt: NOW.getTime() - 10 * ONE_DAY_MS }),
      makeHistoryItem({ videoId: 'older', watchedAt: NOW.getTime() - 40 * ONE_DAY_MS }),
    ]

    expect(store.groupedHistory.today.map((item) => item.videoId)).toEqual(['today'])
    expect(store.groupedHistory.yesterday.map((item) => item.videoId)).toEqual(['yesterday'])
    expect(store.groupedHistory.thisWeek.map((item) => item.videoId)).toEqual(['this-week'])
    expect(store.groupedHistory.thisMonth.map((item) => item.videoId)).toEqual(['this-month'])
    expect(store.groupedHistory.older.map((item) => item.videoId)).toEqual(['older'])
  })

  it('calculates watch percentage only when progress and duration are available', () => {
    const store = useHistoryStore()
    store.history = [
      makeHistoryItem({ videoId: 'complete-data', progress: 45, duration: 90 }),
      makeHistoryItem({ videoId: 'missing-progress', duration: 90 }),
      makeHistoryItem({ videoId: 'missing-duration', progress: 45 }),
    ]

    expect(store.getWatchProgress('complete-data')).toBe(50)
    expect(store.getWatchProgress('missing-progress')).toBe(0)
    expect(store.getWatchProgress('missing-duration')).toBe(0)
    expect(store.getWatchProgress('unknown-video')).toBe(0)
  })
})
