// Native-platform path for the resumable upload. On Android/iOS the requests run
// through Capacitor's native HTTP client (not axios) so the `Location` / `Range`
// response headers — which PeerTube does NOT list in Access-Control-Expose-Headers
// and a WebView therefore cannot read — are available, mirroring the reference
// mobile app's use of a native HTTP client. These tests force the native branch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  CapacitorHttp: { request: vi.fn() },
}));

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@capacitor/device', () => ({
  Device: { getInfo: vi.fn() },
}));

import axios from 'axios';
import { CapacitorHttp } from '@capacitor/core';
import { Device } from '@capacitor/device';
import {
  getResumeOffset,
  initResumableUpload,
  uploadVideo,
  VIDEO_PRIVACY,
} from './peertube';

const mockedRequest = CapacitorHttp.request as unknown as Mock;
const mockedAxiosPost = axios.post as unknown as Mock;
const mockedAxiosPut = axios.put as unknown as Mock;
const mockedGetInfo = Device.getInfo as unknown as Mock;

function makeFile(size: number): File {
  return new File([new Uint8Array(size)], 'v.mp4', { type: 'video/mp4' });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default native device: Android 13 (API 33) supports the native base64 chunk
  // body path. Individual tests override this (e.g. an older API to force the
  // axios fallback).
  mockedGetInfo.mockResolvedValue({ platform: 'android', androidSDKVersion: 33 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('initResumableUpload (native)', () => {
  it('reads the upload_id from the Location header via native HTTP, not axios', async () => {
    const file = makeFile(1000);
    // Native HTTP keeps the server's header casing (capital `Location`) — the bug
    // was that CORS hid this header from axios entirely.
    mockedRequest.mockResolvedValueOnce({
      status: 201,
      headers: {
        Location: 'https://peertube.example/api/v1/videos/upload-resumable?upload_id=ABC123',
      },
      data: '',
    });

    const result = await initResumableUpload({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'My Video',
      channelId: 5,
      privacy: VIDEO_PRIVACY.UNLISTED,
      description: 'desc',
    });

    expect(result).toEqual({ uploadId: 'ABC123', existing: false });
    expect(mockedAxiosPost).not.toHaveBeenCalled();

    expect(mockedRequest).toHaveBeenCalledTimes(1);
    const req = mockedRequest.mock.calls[0]![0];
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://peertube.example/api/v1/videos/upload-resumable');
    expect(req.data).toEqual({
      filename: 'v.mp4',
      name: 'My Video',
      channelId: 5,
      privacy: VIDEO_PRIVACY.UNLISTED,
      description: 'desc',
    });
    expect(req.headers['X-Upload-Content-Length']).toBe('1000');
    expect(req.headers['X-Upload-Content-Type']).toBe('video/mp4');
    expect(req.headers['Content-Type']).toBe('application/json');
    expect(req.headers['Authorization']).toBe('Bearer tok');
  });

  it('flags an existing upload when the server responds 200', async () => {
    mockedRequest.mockResolvedValueOnce({
      status: 200,
      headers: { Location: '?upload_id=EXIST1' },
      data: '',
    });

    const result = await initResumableUpload({
      host: 'peertube.example',
      token: 'tok',
      file: makeFile(10),
      name: 'n',
      channelId: 1,
    });

    expect(result).toEqual({ uploadId: 'EXIST1', existing: true });
  });

  it('rejects with an axios-shaped error on a non-2xx status', async () => {
    mockedRequest.mockResolvedValueOnce({ status: 400, headers: {}, data: { error: 'bad' } });

    await expect(
      initResumableUpload({
        host: 'peertube.example',
        token: 'tok',
        file: makeFile(10),
        name: 'n',
        channelId: 1,
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});

describe('getResumeOffset (native)', () => {
  it('reads the next offset from the Range header via native HTTP', async () => {
    const size = 1024 * 1024;
    const have = 512 * 1024;
    mockedRequest.mockResolvedValueOnce({
      status: 308,
      headers: { Range: `bytes=0-${have - 1}` },
      data: '',
    });

    const probe = await getResumeOffset({
      host: 'peertube.example',
      token: 'tok',
      uploadId: 'UPR',
      fileSize: size,
    });

    expect(probe.offset).toBe(have);
    expect(mockedRequest).toHaveBeenCalledTimes(1);
    const req = mockedRequest.mock.calls[0]![0];
    expect(req.method).toBe('PUT');
    expect(req.url).toBe('https://peertube.example/api/v1/videos/upload-resumable?upload_id=UPR');
    expect(req.headers['Content-Range']).toBe(`bytes */${size}`);
    // A probe carries no body.
    expect(req.data).toBeUndefined();
  });

  it('returns the size and uuid when the server reports the upload complete (200)', async () => {
    const size = 4096;
    mockedRequest.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: { video: { uuid: 'done-uuid' } },
    });

    const probe = await getResumeOffset({
      host: 'peertube.example',
      token: 'tok',
      uploadId: 'UPR2',
      fileSize: size,
    });

    expect(probe).toEqual({ offset: size, uuid: 'done-uuid' });
  });
});

describe('uploadVideo (native init + chunked body)', () => {
  it('inits AND streams chunks via native HTTP (never axios), returning the uuid', async () => {
    const oneMiB = 1024 * 1024;
    const file = makeFile(oneMiB);

    // Both the init and the single chunk PUT resolve through the native client:
    // 1) init (201 + Location), 2) chunk PUT (200 + final video uuid).
    mockedRequest
      .mockResolvedValueOnce({ status: 201, headers: { Location: '?upload_id=UPNATIVE' }, data: '' })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: { video: { uuid: 'native-uuid' } } });

    const seen: string[] = [];
    const result = await uploadVideo({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'n',
      channelId: 1,
      onInit: (id) => seen.push(id),
    });

    expect(result).toEqual({ uuid: 'native-uuid' });
    expect(seen).toEqual(['UPNATIVE']);
    // The chunk PUT went through CapacitorHttp, NOT the WebView's axios.
    expect(mockedAxiosPut).not.toHaveBeenCalled();
    expect(mockedRequest).toHaveBeenCalledTimes(2);

    const chunkReq = mockedRequest.mock.calls[1]![0];
    expect(chunkReq.method).toBe('PUT');
    expect(chunkReq.url).toBe(
      'https://peertube.example/api/v1/videos/upload-resumable?upload_id=UPNATIVE',
    );
    expect(chunkReq.headers['Content-Type']).toBe('application/octet-stream');
    expect(chunkReq.headers['Content-Range']).toBe(`bytes 0-${oneMiB - 1}/${oneMiB}`);
    expect(chunkReq.headers['Authorization']).toBe('Bearer tok');
    // Binary body is carried as base64 with dataType 'file' so Capacitor decodes
    // it back to raw bytes; it round-trips to the original chunk size.
    expect(chunkReq.dataType).toBe('file');
    expect(typeof chunkReq.data).toBe('string');
    expect(atob(chunkReq.data).length).toBe(oneMiB);
  });

  it('advances from the native-readable Range ack when a chunk is only partly stored', async () => {
    const oneMiB = 1024 * 1024;
    const acked = 512 * 1024;
    const file = makeFile(oneMiB);

    mockedRequest
      .mockResolvedValueOnce({ status: 201, headers: { Location: '?upload_id=UPRANGE' }, data: '' })
      // First chunk sends [0, 1 MiB) but the server only acknowledges 0-(512 KiB-1).
      .mockResolvedValueOnce({ status: 308, headers: { Range: `bytes=0-${acked - 1}` }, data: '' })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: { video: { uuid: 'range-uuid' } } });

    const progress: Array<[number, number]> = [];
    const result = await uploadVideo({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'n',
      channelId: 1,
      onProgress: (u, t) => progress.push([u, t]),
    });

    expect(result).toEqual({ uuid: 'range-uuid' });
    // init + two chunks, all native.
    expect(mockedRequest).toHaveBeenCalledTimes(3);
    expect(mockedAxiosPut).not.toHaveBeenCalled();
    // The retry resumes from the acknowledged byte (native could read the real
    // Range header that CORS hides from the WebView).
    const second = mockedRequest.mock.calls[2]![0];
    expect(second.headers['Content-Range']).toBe(`bytes ${acked}-${oneMiB - 1}/${oneMiB}`);
    expect(atob(second.data).length).toBe(oneMiB - acked);
    expect(progress[0]).toEqual([acked, oneMiB]);
  });

  it('falls back to axios for the chunk on Android < 8 (API 26), where native binary bodies are unsupported', async () => {
    const oneMiB = 1024 * 1024;
    const file = makeFile(oneMiB);
    // Android 7.x (API 25): CapacitorHttp's base64 'file' path sends an empty
    // body, so the chunk must go through axios instead.
    mockedGetInfo.mockResolvedValue({ platform: 'android', androidSDKVersion: 25 });
    // Init still uses native HTTP (JSON body works on every API level).
    mockedRequest.mockResolvedValueOnce({ status: 201, headers: { Location: '?upload_id=UPOLD' }, data: '' });
    mockedAxiosPut.mockResolvedValueOnce({ status: 200, data: { video: { uuid: 'old-uuid' } } });

    const result = await uploadVideo({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'n',
      channelId: 1,
    });

    expect(result).toEqual({ uuid: 'old-uuid' });
    // Init was native; the chunk used axios (with the Blob), not CapacitorHttp.
    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(mockedAxiosPut).toHaveBeenCalledTimes(1);
    const chunk = mockedAxiosPut.mock.calls[0]!;
    expect(chunk[2].headers['Content-Range']).toBe(`bytes 0-${oneMiB - 1}/${oneMiB}`);
    expect((chunk[1] as Blob).size).toBe(oneMiB);
  });

  it('deletes the orphaned server upload when aborted mid native init', async () => {
    const file = makeFile(1024 * 1024);
    const controller = new AbortController();
    // The native init can't be aborted mid-flight, so it completes and creates the
    // upload; the user taps Cancel while it is in flight (abort during the request).
    mockedRequest.mockImplementationOnce(async () => {
      controller.abort();
      return { status: 201, headers: { Location: '?upload_id=UPABORT' }, data: '' };
    });
    const mockedAxiosDelete = axios.delete as unknown as Mock;
    mockedAxiosDelete.mockResolvedValueOnce(undefined);

    const onInit = vi.fn();
    await expect(
      uploadVideo({
        host: 'peertube.example',
        token: 'tok',
        file,
        name: 'n',
        channelId: 1,
        signal: controller.signal,
        onInit,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    // The created-but-untracked upload is cleaned up server-side, never surfaced as
    // pending (onInit not called), and no chunk is sent.
    expect(mockedAxiosDelete).toHaveBeenCalledWith(
      'https://peertube.example/api/v1/videos/upload-resumable?upload_id=UPABORT',
      { headers: { Authorization: 'Bearer tok' } },
    );
    expect(onInit).not.toHaveBeenCalled();
    expect(mockedAxiosPut).not.toHaveBeenCalled();
  });
});
