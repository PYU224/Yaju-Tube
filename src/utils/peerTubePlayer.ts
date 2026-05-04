import Channel from 'jschannel'

export interface PeerTubeChannelCall {
  method: string
  params?: unknown
  success(result: unknown): void
  error(error: unknown): void
}

export interface PeerTubeChannel {
  bind(method: string, handler: (value: boolean) => void): void
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

const defaultChannelFactory = Channel as PeerTubeChannelFactory

export class PeerTubePlayer {
  private readonly channel: PeerTubeChannel
  private readonly embedElement: HTMLIFrameElement
  private readonly readyPromise: Promise<void>

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
    this.readyPromise = this.prepareToBeReady()
  }

  get ready(): Promise<void> {
    return this.readyPromise
  }

  destroy(): void {
    this.embedElement.remove()
  }

  getCurrentPosition(): Promise<number> {
    return this.sendMessage<number>('getCurrentPosition')
  }

  getDuration(): Promise<number> {
    return this.sendMessage<number>('getDuration')
  }

  play(): Promise<void> {
    return this.sendMessage<void>('play')
  }

  seek(seconds: number): Promise<void> {
    return this.sendMessage<void>('seek', seconds)
  }

  private prepareToBeReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const rejectReady = () => reject(new Error('PeerTube player failed to become ready'))

      this.channel.bind('ready', (success) => {
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
