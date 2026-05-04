import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PlaylistItem {
  videoId: string
  videoName: string
  thumbnailPath: string
  channelName: string
  instanceUrl: string
  addedAt: number
}

export interface PlaylistExportSettings {
  defaultInstanceUrl: string
  displayMode: 'list' | 'grid'
  itemsPerPage: number
  locale: string
  theme: string
}

export interface PlaylistExport {
  version: 1
  exportedAt: string
  settings: PlaylistExportSettings
  items: PlaylistItem[]
}

type PlaylistInput = Omit<PlaylistItem, 'addedAt'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]

  if (typeof value !== 'string') {
    throw new Error('Invalid playlist item')
  }

  return value
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Invalid playlist item')
  }

  return value
}

function playlistKey(videoId: string, instanceUrl: string): string {
  return `${instanceUrl}/${videoId}`
}

function parseSettings(value: unknown): PlaylistExportSettings {
  if (!isRecord(value)) {
    throw new Error('Invalid playlist export')
  }

  const displayMode = value['displayMode']

  if (displayMode !== 'list' && displayMode !== 'grid') {
    throw new Error('Invalid playlist export')
  }

  const itemsPerPage = value['itemsPerPage']

  if (typeof itemsPerPage !== 'number' || !Number.isFinite(itemsPerPage)) {
    throw new Error('Invalid playlist export')
  }

  return {
    defaultInstanceUrl: requireExportString(value, 'defaultInstanceUrl'),
    displayMode,
    itemsPerPage,
    locale: requireExportString(value, 'locale'),
    theme: requireExportString(value, 'theme'),
  }
}

function requireExportString(record: Record<string, unknown>, key: string): string {
  const value = record[key]

  if (typeof value !== 'string') {
    throw new Error('Invalid playlist export')
  }

  return value
}

function parsePlaylistItem(value: unknown): PlaylistItem {
  if (!isRecord(value)) {
    throw new Error('Invalid playlist item')
  }

  return {
    videoId: requireString(value, 'videoId'),
    videoName: requireString(value, 'videoName'),
    thumbnailPath: requireString(value, 'thumbnailPath'),
    channelName: requireString(value, 'channelName'),
    instanceUrl: requireString(value, 'instanceUrl'),
    addedAt: requireNumber(value, 'addedAt'),
  }
}

function parsePlaylistExport(payload: unknown): PlaylistExport {
  let value = payload

  if (typeof payload === 'string') {
    try {
      value = JSON.parse(payload) as unknown
    } catch {
      throw new Error('Invalid playlist export')
    }
  }

  if (!isRecord(value)) {
    throw new Error('Invalid playlist export')
  }

  if (value['version'] !== 1) {
    throw new Error('Unsupported playlist export version')
  }

  const exportedAt = value['exportedAt']

  if (typeof exportedAt !== 'string') {
    throw new Error('Invalid playlist export')
  }

  const rawItems = value['items']

  if (!Array.isArray(rawItems)) {
    throw new Error('Invalid playlist export')
  }

  return {
    version: 1,
    exportedAt,
    settings: parseSettings(value['settings']),
    items: rawItems.map(parsePlaylistItem),
  }
}

function normalizeItems(items: PlaylistItem[]): PlaylistItem[] {
  const byKey = new Map<string, PlaylistItem>()

  for (const item of items) {
    const key = playlistKey(item.videoId, item.instanceUrl)
    const existing = byKey.get(key)

    if (!existing || item.addedAt >= existing.addedAt) {
      byKey.set(key, item)
    }
  }

  return [...byKey.values()].sort((a, b) => b.addedAt - a.addedAt)
}

export const usePlaylistStore = defineStore('playlist', () => {
  const playlist = ref<PlaylistItem[]>([])

  const addToPlaylist = (item: PlaylistInput) => {
    const key = playlistKey(item.videoId, item.instanceUrl)
    playlist.value = playlist.value.filter((candidate) => playlistKey(candidate.videoId, candidate.instanceUrl) !== key)
    playlist.value.unshift({
      ...item,
      addedAt: Date.now(),
    })
  }

  const removeFromPlaylist = (videoId: string, instanceUrl: string) => {
    const key = playlistKey(videoId, instanceUrl)
    playlist.value = playlist.value.filter((item) => playlistKey(item.videoId, item.instanceUrl) !== key)
  }

  const clearPlaylist = () => {
    playlist.value = []
  }

  const getPlaylistItem = (videoId: string, instanceUrl: string) => {
    const key = playlistKey(videoId, instanceUrl)
    return playlist.value.find((item) => playlistKey(item.videoId, item.instanceUrl) === key)
  }

  const isInPlaylist = (videoId: string, instanceUrl: string) => {
    return Boolean(getPlaylistItem(videoId, instanceUrl))
  }

  const exportPlaylist = (settings: PlaylistExportSettings): PlaylistExport => {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...settings },
      items: playlist.value.map((item) => ({ ...item })),
    }
  }

  const importPlaylist = (payload: unknown): PlaylistExportSettings => {
    const parsed = parsePlaylistExport(payload)
    playlist.value = normalizeItems(parsed.items)
    return parsed.settings
  }

  return {
    playlist,
    addToPlaylist,
    removeFromPlaylist,
    clearPlaylist,
    getPlaylistItem,
    isInPlaylist,
    exportPlaylist,
    importPlaylist,
  }
}, {
  persist: true,
})
