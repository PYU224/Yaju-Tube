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
  // OAuth client credentials are returned so the session can later refresh the
  // access token without re-fetching them from the instance.
  clientId: string;
  clientSecret: string;
  // Access-token lifetime in seconds (PeerTube `expires_in`), when provided.
  expiresIn?: number;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn?: number;
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
    const result: LoginResult = {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      tokenType: res.data.token_type,
      clientId: client.client_id,
      clientSecret: client.client_secret,
    };
    if (res.data.expires_in !== undefined) result.expiresIn = res.data.expires_in;
    return result;
  } catch (err) {
    // PeerTube reports its 2FA failures via `code` (e.g. missing_two_factor),
    // while the OAuth2 layer reports bad credentials via the standard `error`
    // field (e.g. invalid_grant). Either field may also carry an unrelated
    // value (a numeric HTTP code, a message), so match the known auth code in
    // whichever field actually holds it rather than preferring one.
    const data = (err as { response?: { data?: { code?: unknown; error?: unknown } } })?.response?.data;
    const authCode = [data?.code, data?.error].find(
      (c): c is string =>
        c === 'invalid_grant' || c === 'missing_two_factor' || c === 'invalid_two_factor',
    );
    if (authCode) {
      throw new PeerTubeAuthError(authCode);
    }
    throw err;
  }
}

export async function refreshAccessToken(p: {
  host: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<RefreshResult> {
  const body = new URLSearchParams();
  body.append('client_id', p.clientId);
  body.append('client_secret', p.clientSecret);
  body.append('grant_type', 'refresh_token');
  body.append('refresh_token', p.refreshToken);

  const res = await axios.post(apiBase(p.host) + '/users/token', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const result: RefreshResult = {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    tokenType: res.data.token_type,
  };
  if (res.data.expires_in !== undefined) result.expiresIn = res.data.expires_in;
  return result;
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
  signal?: AbortSignal;
}): Promise<string> {
  const body: Record<string, unknown> = {
    filename: p.file.name,
    name: p.name,
    channelId: p.channelId,
    privacy: p.privacy ?? VIDEO_PRIVACY.PUBLIC,
  };
  if (p.description !== undefined) body['description'] = p.description;

  const config: AxiosRequestConfig = {
    headers: {
      'X-Upload-Content-Length': String(p.file.size),
      'X-Upload-Content-Type': p.file.type || 'video/mp4',
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + p.token,
    },
  };
  if (p.signal) config.signal = p.signal;

  const res = await axios.post(apiBase(p.host) + '/videos/upload-resumable', body, config);

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

// Parses the last byte the server acknowledges from a `Range: bytes=0-N`
// response header (used on resumable 308/200/201 responses). Returns N, or
// null when the header is absent/unparseable.
function parseAckedEnd(headers: unknown): number | null {
  const h = (headers ?? {}) as Record<string, string>;
  const range = h['range'] ?? h['Range'];
  if (typeof range === 'string') {
    const m = /bytes=0-(\d+)/.exec(range);
    if (m && m[1] !== undefined) {
      return parseInt(m[1], 10);
    }
  }
  return null;
}

interface ChunkLoopOptions {
  host: string;
  token: string;
  uploadId: string;
  file: File;
  startOffset?: number;
  onProgress?: (uploaded: number, total: number) => void;
  signal?: AbortSignal;
}

// Streams a file to an already-initialised resumable upload session in
// dynamically-sized chunks, starting from startOffset. Shared by uploadVideo
// (fresh upload) and resumeUpload (continuing an interrupted one).
async function runChunkLoop(opts: ChunkLoopOptions): Promise<string> {
  const total = opts.file.size;
  const url = apiBase(opts.host) + '/videos/upload-resumable?upload_id=' + opts.uploadId;

  let chunkSize = CHUNK_START;
  let maxChunkSize = CHUNK_MAX_DEFAULT;
  let start = opts.startOffset ?? 0;
  let uuid: string | undefined;

  while (start < total) {
    if (opts.signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }

    const size = Math.min(chunkSize, total - start);
    const end = start + size;
    const blob = opts.file.slice(start, end);

    const startedAt = Date.now();
    try {
      const config: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': 'bytes ' + start + '-' + (end - 1) + '/' + total,
          Authorization: 'Bearer ' + opts.token,
        },
        validateStatus: (s: number) => s === 200 || s === 308,
      };
      if (opts.signal) config.signal = opts.signal;
      const res = await axios.put(url, blob, config);

      const elapsedMs = Date.now() - startedAt;

      if (res.status === 200) {
        uuid = res.data?.video?.uuid;
      }

      // Advance from the byte the server acknowledges (308 Range header) rather
      // than optimistically to `end`: if only part of the chunk was stored,
      // this re-sends the unacknowledged tail instead of skipping it.
      const acked = parseAckedEnd(res.headers);
      start = acked !== null ? acked + 1 : end;
      if (opts.onProgress) opts.onProgress(start, total);

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
        // Already at the floor and still rejected (e.g. a proxy with a body
        // limit below CHUNK_MIN): unrecoverable, so fail visibly instead of
        // retrying the same offset forever.
        if (chunkSize <= CHUNK_MIN) {
          throw err;
        }
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
  return uuid;
}

export async function uploadVideo(p: UploadParams): Promise<UploadResult> {
  const initParams: {
    host: string;
    token: string;
    file: File;
    name: string;
    channelId: number;
    privacy?: VideoPrivacy;
    description?: string;
    signal?: AbortSignal;
  } = {
    host: p.host,
    token: p.token,
    file: p.file,
    name: p.name,
    channelId: p.channelId,
  };
  if (p.privacy !== undefined) initParams.privacy = p.privacy;
  if (p.description !== undefined) initParams.description = p.description;
  if (p.signal) initParams.signal = p.signal;
  const uploadId = await initResumableUpload(initParams);
  // If the user cancelled while init was in flight, abort before persisting the
  // session via onInit so a cancelled upload isn't resurrected as pending.
  if (p.signal?.aborted) {
    throw new DOMException('Upload aborted', 'AbortError');
  }
  if (p.onInit) p.onInit(uploadId);

  const loopOpts: ChunkLoopOptions = {
    host: p.host,
    token: p.token,
    uploadId,
    file: p.file,
  };
  if (p.onProgress) loopOpts.onProgress = p.onProgress;
  if (p.signal) loopOpts.signal = p.signal;

  const uuid = await runChunkLoop(loopOpts);
  return { uuid };
}

export interface ResumeProbe {
  // Next byte offset the client should send from.
  offset: number;
  // Present when the probe reports the upload already complete (200/201): the
  // server returns the finished video, so there is nothing left to send.
  uuid?: string;
}

// Asks the server how many bytes it already holds for an interrupted upload by
// sending an empty `Content-Range: bytes */total` probe, mirroring the
// reference app's resumeUpload.
export async function getResumeOffset(p: {
  host: string;
  token: string;
  uploadId: string;
  fileSize: number;
}): Promise<ResumeProbe> {
  const res = await axios.put(
    apiBase(p.host) + '/videos/upload-resumable?upload_id=' + p.uploadId,
    undefined,
    {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Range': 'bytes */' + p.fileSize,
        Authorization: 'Bearer ' + p.token,
      },
      validateStatus: (s: number) => s === 200 || s === 201 || s === 308,
    },
  );

  const acked = parseAckedEnd(res.headers);
  if (acked !== null) {
    return { offset: acked + 1 };
  }
  // 200/201 means the server already has the whole file and returns the video.
  if (res.status === 200 || res.status === 201) {
    const result: ResumeProbe = { offset: p.fileSize };
    const uuid = res.data?.video?.uuid;
    if (uuid) result.uuid = uuid;
    return result;
  }
  return { offset: 0 };
}

export interface ResumeParams {
  host: string;
  token: string;
  file: File;
  uploadId: string;
  onProgress?: (uploaded: number, total: number) => void;
  signal?: AbortSignal;
}

export async function resumeUpload(p: ResumeParams): Promise<UploadResult> {
  const probe = await getResumeOffset({
    host: p.host,
    token: p.token,
    uploadId: p.uploadId,
    fileSize: p.file.size,
  });

  // The server already has the whole file (e.g. we crashed right after the
  // final chunk was stored): complete using the uuid it reported instead of
  // entering the chunk loop with nothing left to send.
  if (probe.offset >= p.file.size) {
    if (!probe.uuid) {
      throw new Error('Upload finished without a video UUID');
    }
    if (p.onProgress) p.onProgress(p.file.size, p.file.size);
    return { uuid: probe.uuid };
  }

  const loopOpts: ChunkLoopOptions = {
    host: p.host,
    token: p.token,
    uploadId: p.uploadId,
    file: p.file,
    startOffset: probe.offset,
  };
  if (p.onProgress) loopOpts.onProgress = p.onProgress;
  if (p.signal) loopOpts.signal = p.signal;

  const uuid = await runChunkLoop(loopOpts);
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
