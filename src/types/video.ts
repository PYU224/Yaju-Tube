// 型定義ファイル
export interface Video {
  uuid: string;
  name: string;
  description?: string;
  thumbnailPath: string;
  channel: {
    name: string;
    displayName?: string;
  };
  views?: number;
  likes?: number;
  publishedAt: string;
}

export interface VideoListResponse {
  data: Video[];
  total: number;
}