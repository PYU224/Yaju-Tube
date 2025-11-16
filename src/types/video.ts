// 型定義ファイル
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
