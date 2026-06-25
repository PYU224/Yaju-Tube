import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type PlaylistExportSettings,
  type PlaylistItem,
  usePlaylistStore,
} from './playlistStore'

const NOW = new Date('2026-05-04T12:00:00.000Z')

function playlistItem(overrides: Partial<Omit<PlaylistItem, 'addedAt'>> = {}): Omit<PlaylistItem, 'addedAt'> {
  return {
    videoId: 'video-1',
    videoName: 'Test Playlist Video',
    thumbnailPath: '/lazy-static/thumbnails/video-1.jpg',
    channelName: 'Playlist Channel',
    instanceUrl: '810video.com',
    ...overrides,
  }
}

const exportSettings: PlaylistExportSettings = {
  defaultInstanceUrl: '810video.com',
  displayMode: 'grid',
  itemsPerPage: 20,
  locale: 'ja',
  theme: 'dark',
}

describe('playlistStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds playlist items newest first and deduplicates by instance and video id', () => {
    const store = usePlaylistStore()

    store.addToPlaylist(playlistItem({ videoName: 'Original Video' }))
    vi.setSystemTime(new Date('2026-05-04T12:05:00.000Z'))
    store.addToPlaylist(playlistItem({ videoName: 'Updated Video' }))
    store.addToPlaylist(playlistItem({ instanceUrl: 'video.example', videoName: 'Remote Copy' }))

    expect(store.playlist).toHaveLength(2)
    expect(store.playlist[0]).toMatchObject({
      videoId: 'video-1',
      videoName: 'Remote Copy',
      instanceUrl: 'video.example',
    })
    expect(store.playlist[1]).toMatchObject({
      videoId: 'video-1',
      videoName: 'Updated Video',
      instanceUrl: '810video.com',
      addedAt: new Date('2026-05-04T12:05:00.000Z').getTime(),
    })
    expect(store.isInPlaylist('video-1', '810video.com')).toBe(true)
    expect(store.isInPlaylist('video-1', 'missing.example')).toBe(false)
  })

  it('removes individual items, clears the playlist, and finds saved items', () => {
    const store = usePlaylistStore()
    store.playlist = [
      { ...playlistItem({ videoId: 'video-1' }), addedAt: NOW.getTime() },
      { ...playlistItem({ videoId: 'video-2', instanceUrl: 'video.example' }), addedAt: NOW.getTime() - 1000 },
    ]

    expect(store.getPlaylistItem('video-2', 'video.example')).toMatchObject({ videoId: 'video-2' })

    store.removeFromPlaylist('video-1', '810video.com')
    expect(store.playlist.map((item) => `${item.instanceUrl}/${item.videoId}`)).toEqual(['video.example/video-2'])

    store.clearPlaylist()
    expect(store.playlist).toEqual([])
    expect(store.getPlaylistItem('video-2', 'video.example')).toBeUndefined()
  })

  it('exports playlist items with app settings and imports them newest first', () => {
    const store = usePlaylistStore()
    store.playlist = [
      { ...playlistItem({ videoId: 'video-1' }), addedAt: NOW.getTime() - 1000 },
      { ...playlistItem({ videoId: 'video-2', instanceUrl: 'video.example' }), addedAt: NOW.getTime() },
    ]

    const exported = store.exportPlaylist(exportSettings)

    expect(exported).toEqual({
      version: 1,
      exportedAt: NOW.toISOString(),
      settings: exportSettings,
      items: store.playlist,
    })

    store.clearPlaylist()
    const importedSettings = store.importPlaylist(JSON.stringify({
      ...exported,
      items: [...exported.items].reverse(),
    }))

    expect(importedSettings).toEqual(exportSettings)
    expect(store.playlist.map((item) => item.videoId)).toEqual(['video-2', 'video-1'])
  })

  it('rejects malformed imports and normalizes duplicate imported items', () => {
    const store = usePlaylistStore()

    expect(() => store.importPlaylist('{')).toThrow('Invalid playlist export')
    expect(() => store.importPlaylist({ version: 2, exportedAt: NOW.toISOString(), settings: exportSettings, items: [] }))
      .toThrow('Unsupported playlist export version')
    expect(() => store.importPlaylist({ version: 1, exportedAt: NOW.toISOString(), settings: exportSettings, items: [{}] }))
      .toThrow('Invalid playlist item')

    const importedSettings = store.importPlaylist({
      version: 1,
      exportedAt: NOW.toISOString(),
      settings: exportSettings,
      items: [
        { ...playlistItem({ videoName: 'Older Duplicate' }), addedAt: NOW.getTime() - 1000 },
        { ...playlistItem({ videoName: 'Newest Duplicate' }), addedAt: NOW.getTime() },
      ],
    })

    expect(importedSettings).toEqual(exportSettings)
    expect(store.playlist).toHaveLength(1)
    expect(store.playlist[0]).toMatchObject({
      videoId: 'video-1',
      videoName: 'Newest Duplicate',
    })
  })
})
