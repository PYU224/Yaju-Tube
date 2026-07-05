// 型定義ファイル

// A saved reference to a video on a specific instance. Shared by the watch
// history and playlist stores, which each add their own timestamp (and, for
// history, playback progress) on top of these common fields.
export interface SavedVideoRef {
  videoId: string;
  videoName: string;
  thumbnailPath: string;
  channelName: string;
  instanceUrl: string;
}

export interface Video {
  uuid: string;
  name: string;
  description?: string;
  thumbnailPath: string;
  channel: {
    name: string;
    displayName?: string;
    host?: string; // 🆕 インスタンス名を追加
  };
  views?: number;
  likes?: number;
  publishedAt: string;
}

export interface VideoListResponse {
  data: Video[];
  total: number;
}
