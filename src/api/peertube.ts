// PeerTube API (OAuth login + resumable video upload)
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';

export interface OAuthClient {
  client_id: string;
  client_secret: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface VideoChannel {
  id: number;
  name: string;
  displayName: string;
}

export interface MyAccount {
  username: string;
  channels: VideoChannel[];
}

export const VIDEO_PRIVACY = {
  PUBLIC: 1,
  UNLISTED: 2,
  PRIVATE: 3,
  INTERNAL: 4,
} as const;

export type VideoPrivacy = 1 | 2 | 3 | 4;

export class PeerTubeAuthError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'PeerTubeAuthError';
    this.code = code;
  }
}

export function normalizeHost(host: string): string {
  return host.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

export function apiBase(host: string): string {
  return 'https://' + normalizeHost(host) + '/api/v1';
}

export async function getOAuthClient(host: string): Promise<OAuthClient> {
  const res = await axios.get(apiBase(host) + '/oauth-clients/local');
  return {
    client_id: res.data.client_id,
    client_secret: res.data.client_secret,
  };
}

export async function login(p: {
  host: string;
  username: string;
  password: string;
  otpToken?: string;
}): Promise<LoginResult> {
  const client = await getOAuthClient(p.host);

  const body = new URLSearchParams();
  body.append('client_id', client.client_id);
  body.append('client_secret', client.client_secret);
  body.append('grant_type', 'password');
  body.append('username', p.username);
  body.append('password', p.password);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (p.otpToken) headers['x-peertube-otp'] = p.otpToken;

  try {
    const res = await axios.post(apiBase(p.host) + '/users/token', body, { headers });
    return {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      tokenType: res.data.token_type,
    };
  } catch (err) {
    // PeerTube reports its 2FA failures via `code` (e.g. missing_two_factor),
    // while the OAuth2 layer reports bad credentials via the standard `error`
    // field (e.g. invalid_grant). Check both so neither path is missed.
    const data = (err as { response?: { data?: { code?: string; error?: string } } })?.response?.data;
    const code = data?.code ?? data?.error;
    if (
      code === 'invalid_grant' ||
      code === 'missing_two_factor' ||
      code === 'invalid_two_factor'
    ) {
      throw new PeerTubeAuthError(code);
    }
    throw err;
  }
}

export async function getMyAccount(p: { host: string; token: string }): Promise<MyAccount> {
  const res = await axios.get(apiBase(p.host) + '/users/me', {
    headers: { Authorization: 'Bearer ' + p.token },
  });
  return {
    username: res.data.account?.username ?? res.data.username,
    channels: res.data.videoChannels ?? [],
  };
}

export interface UploadParams {
  host: string;
  token: string;
  file: File;
  name: string;
  channelId: number;
  privacy?: VideoPrivacy;
  description?: string;
  onProgress?: (uploaded: number, total: number) => void;
  // Called once the resumable session is created, exposing its upload_id so the
  // caller can cancel the server-side upload (cancelUpload) if it is aborted.
  onInit?: (uploadId: string) => void;
  signal?: AbortSignal;
}

export interface UploadResult {
  uuid: string;
}

function parseUploadId(location: string, host: string): string | null {
  try {
    const url = new URL(location, 'https://' + normalizeHost(host));
    const id = url.searchParams.get('upload_id');
    if (id) return id;
  } catch {
    // fall through to regex
  }
  const m = /upload_id=([^&]+)/.exec(location);
  return m?.[1] ?? null;
}

export async function initResumableUpload(p: {
  host: string;
  token: string;
  file: File;
  name: string;
  channelId: number;
  privacy?: VideoPrivacy;
  description?: string;
}): Promise<string> {
  const body: Record<string, unknown> = {
    filename: p.file.name,
    name: p.name,
    channelId: p.channelId,
    privacy: p.privacy ?? VIDEO_PRIVACY.PUBLIC,
  };
  if (p.description !== undefined) body['description'] = p.description;

  const res = await axios.post(apiBase(p.host) + '/videos/upload-resumable', body, {
    headers: {
      'X-Upload-Content-Length': String(p.file.size),
      'X-Upload-Content-Type': p.file.type || 'video/mp4',
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + p.token,
    },
  });

  const resHeaders = (res.headers ?? {}) as Record<string, string>;
  const location: string = resHeaders['location'] ?? resHeaders['Location'] ?? '';
  const uploadId = parseUploadId(location, p.host);
  if (!uploadId) {
    throw new Error('Resumable upload init did not return an upload_id');
  }
  return uploadId;
}

const CHUNK_START = 1024 * 1024; // 1 MiB
const CHUNK_MIN = 256 * 1024; // 256 KiB
const CHUNK_MAX_DEFAULT = 100 * 1024 * 1024; // 100 MiB

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function uploadVideo(p: UploadParams): Promise<UploadResult> {
  const total = p.file.size;
  const initParams: {
    host: string;
    token: string;
    file: File;
    name: string;
    channelId: number;
    privacy?: VideoPrivacy;
    description?: string;
  } = {
    host: p.host,
    token: p.token,
    file: p.file,
    name: p.name,
    channelId: p.channelId,
  };
  if (p.privacy !== undefined) initParams.privacy = p.privacy;
  if (p.description !== undefined) initParams.description = p.description;
  const uploadId = await initResumableUpload(initParams);
  if (p.onInit) p.onInit(uploadId);

  const url = apiBase(p.host) + '/videos/upload-resumable?upload_id=' + uploadId;

  let chunkSize = CHUNK_START;
  let maxChunkSize = CHUNK_MAX_DEFAULT;
  let start = 0;
  let uuid: string | undefined;

  while (start < total) {
    if (p.signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }

    const size = Math.min(chunkSize, total - start);
    const end = start + size;
    const blob = p.file.slice(start, end);

    const startedAt = Date.now();
    try {
      const config: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': 'bytes ' + start + '-' + (end - 1) + '/' + total,
          Authorization: 'Bearer ' + p.token,
        },
        validateStatus: (s: number) => s === 200 || s === 308,
      };
      if (p.signal) config.signal = p.signal;
      const res = await axios.put(url, blob, config);

      const elapsedMs = Date.now() - startedAt;

      if (res.status === 200) {
        uuid = res.data?.video?.uuid;
      }

      start = end;
      if (p.onProgress) p.onProgress(end, total);

      // Dynamic chunk sizing
      if (elapsedMs < 8000) {
        chunkSize *= 2;
      } else if (elapsedMs > 24000) {
        chunkSize = Math.floor(chunkSize / 2);
      }
      chunkSize = clamp(chunkSize, CHUNK_MIN, maxChunkSize);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 413) {
        maxChunkSize = Math.max(CHUNK_MIN, Math.floor(maxChunkSize / 2));
        chunkSize = clamp(Math.floor(chunkSize / 2), CHUNK_MIN, maxChunkSize);
        // retry the SAME offset (do not advance start)
        continue;
      }
      throw err;
    }
  }

  if (!uuid) {
    throw new Error('Upload finished without a video UUID');
  }
  return { uuid };
}

export async function cancelUpload(p: {
  host: string;
  token: string;
  uploadId: string;
}): Promise<void> {
  await axios.delete(
    apiBase(p.host) + '/videos/upload-resumable?upload_id=' + p.uploadId,
    {
      headers: { Authorization: 'Bearer ' + p.token },
    },
  );
}

export async function updateVideo(p: {
  host: string;
  token: string;
  uuid: string;
  data: Record<string, unknown>;
}): Promise<void> {
  await axios.put(apiBase(p.host) + '/videos/' + p.uuid, p.data, {
    headers: { Authorization: 'Bearer ' + p.token },
  });
}
