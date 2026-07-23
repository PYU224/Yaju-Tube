import Channel from 'jschannel'

export interface PeerTubeChannelCall {
  method: string
  params?: unknown
  success(result: unknown): void
  error(error: unknown): void
}

// jschannelのバインドハンドラは(トランザクション, パラメータ)の2引数で呼ばれ、
// 通知のデータは第2引数に入る
export interface PeerTubeChannel {
  bind(method: string, handler: (transaction: unknown, params?: unknown) => void): void
  call(options: PeerTubeChannelCall): void
}

export interface PeerTubeChannelFactory {
  build(options: {
    window: Window
    origin: string
    scope: string
  }): PeerTubeChannel
}

interface PeerTubePlayerOptions {
  channelFactory?: PeerTubeChannelFactory
  origin?: string
  scope?: string
}

interface PlaybackStatus {
  position: number
  duration: number
}

const defaultChannelFactory = Channel as PeerTubeChannelFactory

export class PeerTubePlayer {
  private readonly channel: PeerTubeChannel
  private readonly embedElement: HTMLIFrameElement
  private readonly readyPromise: Promise<void>
  // 埋め込み側から約500msごとに通知されるplaybackStatusUpdateの最新値。
  // 埋め込みAPIには再生時刻・動画長の取得メソッドが揃っていないため
  // （getCurrentPositionはプレイリスト内の位置、getDurationは存在しない）、
  // このキャッシュを一次情報として使う
  private latestPlaybackStatus: PlaybackStatus | null = null

  constructor(
    embedElement: HTMLIFrameElement,
    {
      channelFactory = defaultChannelFactory,
      origin = '*',
      scope = 'peertube',
    }: PeerTubePlayerOptions = {},
  ) {
    const targetWindow = embedElement.contentWindow
    if (!targetWindow) {
      throw new Error('PeerTube iframe contentWindow is unavailable')
    }

    this.embedElement = embedElement
    this.channel = channelFactory.build({
      window: targetWindow,
      origin,
      scope,
    })
    this.channel.bind('playbackStatusUpdate', (_transaction, status) => {
      this.updatePlaybackStatus(status)
    })
    this.readyPromise = this.prepareToBeReady()
  }

  get ready(): Promise<void> {
    return this.readyPromise
  }

  destroy(): void {
    this.embedElement.remove()
  }

  // 再生中の現在時刻（秒）。キャッシュ未受信の間は
  // getCurrentTime（PeerTube 7.0以降）へフォールバックする
  getCurrentTime(): Promise<number> {
    if (this.latestPlaybackStatus) {
      return Promise.resolve(this.latestPlaybackStatus.position)
    }

    return this.sendMessage<number>('getCurrentTime')
  }

  // 動画の長さ（秒）。埋め込みAPIに取得メソッドがないため
  // playbackStatusUpdateのキャッシュからのみ取得できる
  getDuration(): Promise<number> {
    if (this.latestPlaybackStatus) {
      return Promise.resolve(this.latestPlaybackStatus.duration)
    }

    return Promise.reject(new Error('Playback status has not been received yet'))
  }

  pause(): Promise<void> {
    return this.sendMessage<void>('pause')
  }

  play(): Promise<void> {
    return this.sendMessage<void>('play')
  }

  seek(seconds: number): Promise<void> {
    return this.sendMessage<void>('seek', seconds)
  }

  private updatePlaybackStatus(status: unknown): void {
    if (!status || typeof status !== 'object') {
      return
    }

    // durationは文字列で届くことがあるため数値へ正規化する
    const { position, duration } = status as { position?: unknown; duration?: unknown }
    const parsedPosition = Number(position)
    const parsedDuration = Number(duration)

    this.latestPlaybackStatus = {
      position: Number.isFinite(parsedPosition) ? parsedPosition : 0,
      duration: Number.isFinite(parsedDuration) ? parsedDuration : 0,
    }
  }

  private prepareToBeReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const rejectReady = () => reject(new Error('PeerTube player failed to become ready'))

      this.channel.bind('ready', (_transaction, success) => {
        if (success) {
          resolve()
          return
        }

        rejectReady()
      })

      this.channel.call({
        method: 'isReady',
        success: (isReady) => {
          if (isReady) {
            resolve()
          }
        },
        error: reject,
      })
    })
  }

  private sendMessage<T>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const call: PeerTubeChannelCall = {
        method,
        success: (result) => resolve(result as T),
        error: reject,
      }

      if (params !== undefined) {
        call.params = params
      }

      this.channel.call(call)
    })
  }
}
