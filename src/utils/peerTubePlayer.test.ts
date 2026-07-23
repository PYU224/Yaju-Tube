import { describe, expect, it, vi } from 'vitest'
import { PeerTubePlayer, type PeerTubeChannel, type PeerTubeChannelFactory } from './peerTubePlayer'

function createChannel() {
  const handlers = new Map<string, (transaction: unknown, params?: unknown) => void>()
  const calls: Array<{
    method: string
    params?: unknown
    success(result: unknown): void
    error(error: unknown): void
  }> = []
  const channel: PeerTubeChannel = {
    bind: vi.fn((method, handler) => {
      handlers.set(method, handler)
    }),
    call: vi.fn((options) => {
      calls.push(options)
    }),
  }

  return { calls, channel, handlers }
}

describe('PeerTubePlayer', () => {
  it('builds a scoped jschannel connection and resolves readiness from isReady', async () => {
    const { calls, channel } = createChannel()
    const contentWindow = window
    const channelFactory: PeerTubeChannelFactory = {
      build: vi.fn(() => channel),
    }
    const remove = vi.fn()
    const iframe = { contentWindow, remove } as unknown as HTMLIFrameElement

    const player = new PeerTubePlayer(iframe, { channelFactory, scope: 'custom-scope' })
    calls[0]?.success(true)
    player.destroy()

    await expect(player.ready).resolves.toBeUndefined()
    expect(remove).toHaveBeenCalledOnce()
    expect(channelFactory.build).toHaveBeenCalledWith({
      window: contentWindow,
      origin: '*',
      scope: 'custom-scope',
    })
    expect(channel.bind).toHaveBeenCalledWith('playbackStatusUpdate', expect.any(Function))
    expect(channel.bind).toHaveBeenCalledWith('ready', expect.any(Function))
    expect(channel.call).toHaveBeenCalledWith(expect.objectContaining({ method: 'isReady' }))
  })

  it('resolves and rejects readiness from ready events', async () => {
    const readyChannel = createChannel()
    const failingChannel = createChannel()

    const readyPlayer = new PeerTubePlayer(
      { contentWindow: window, remove: vi.fn() } as unknown as HTMLIFrameElement,
      { channelFactory: { build: () => readyChannel.channel } },
    )
    readyChannel.handlers.get('ready')?.({}, true)
    await expect(readyPlayer.ready).resolves.toBeUndefined()

    const failingPlayer = new PeerTubePlayer(
      { contentWindow: window, remove: vi.fn() } as unknown as HTMLIFrameElement,
      { channelFactory: { build: () => failingChannel.channel } },
    )
    failingChannel.handlers.get('ready')?.({}, false)
    await expect(failingPlayer.ready).rejects.toThrow('PeerTube player failed to become ready')
  })

  it('sends player commands through jschannel calls', async () => {
    const { calls, channel } = createChannel()
    const player = new PeerTubePlayer(
      { contentWindow: window, remove: vi.fn() } as unknown as HTMLIFrameElement,
      { channelFactory: { build: () => channel } },
    )

    const currentTime = player.getCurrentTime()
    calls[1]?.success(42)
    await expect(currentTime).resolves.toBe(42)

    const seek = player.seek(30)
    calls[2]?.success(undefined)
    await expect(seek).resolves.toBeUndefined()

    const play = player.play()
    calls[3]?.success(undefined)
    await expect(play).resolves.toBeUndefined()

    const pause = player.pause()
    calls[4]?.success(undefined)
    await expect(pause).resolves.toBeUndefined()

    expect(calls.map((call) => call.method)).toEqual([
      'isReady',
      'getCurrentTime',
      'seek',
      'play',
      'pause',
    ])
    expect(calls[2]).toMatchObject({ params: 30 })
  })

  it('serves playback time and duration from playbackStatusUpdate events', async () => {
    const { calls, channel, handlers } = createChannel()
    const player = new PeerTubePlayer(
      { contentWindow: window, remove: vi.fn() } as unknown as HTMLIFrameElement,
      { channelFactory: { build: () => channel } },
    )

    // ステータス未受信の間はdurationを解決できない
    await expect(player.getDuration()).rejects.toThrow('Playback status has not been received yet')

    // durationは実際の埋め込みと同様に文字列でも受け付ける
    handlers.get('playbackStatusUpdate')?.({}, { position: 42.5, duration: '120.5' })

    await expect(player.getCurrentTime()).resolves.toBe(42.5)
    await expect(player.getDuration()).resolves.toBe(120.5)
    // キャッシュから解決するためチャンネル呼び出しはisReadyのみ
    expect(calls.map((call) => call.method)).toEqual(['isReady'])
  })

  it('ignores malformed playback status payloads and normalizes invalid numbers', async () => {
    const { channel, handlers } = createChannel()
    const player = new PeerTubePlayer(
      { contentWindow: window, remove: vi.fn() } as unknown as HTMLIFrameElement,
      { channelFactory: { build: () => channel } },
    )

    handlers.get('playbackStatusUpdate')?.({}, 'not-an-object')
    handlers.get('playbackStatusUpdate')?.({}, undefined)
    await expect(player.getDuration()).rejects.toThrow('Playback status has not been received yet')

    handlers.get('playbackStatusUpdate')?.({}, { position: 'invalid', duration: 'invalid' })
    await expect(player.getCurrentTime()).resolves.toBe(0)
    await expect(player.getDuration()).resolves.toBe(0)
  })

  it('rejects failed player commands and requires an iframe content window', async () => {
    const { calls, channel } = createChannel()
    const player = new PeerTubePlayer(
      { contentWindow: window, remove: vi.fn() } as unknown as HTMLIFrameElement,
      { channelFactory: { build: () => channel } },
    )

    const currentTime = player.getCurrentTime()
    calls[1]?.error(new Error('current time unavailable'))

    await expect(currentTime).rejects.toThrow('current time unavailable')
    expect(() => new PeerTubePlayer({ contentWindow: null } as unknown as HTMLIFrameElement)).toThrow(
      'PeerTube iframe contentWindow is unavailable',
    )
  })
})
