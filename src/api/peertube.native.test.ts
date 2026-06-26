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

import axios from 'axios';
import { CapacitorHttp } from '@capacitor/core';
import {
  getResumeOffset,
  initResumableUpload,
  uploadVideo,
  VIDEO_PRIVACY,
} from './peertube';

const mockedRequest = CapacitorHttp.request as unknown as Mock;
const mockedAxiosPost = axios.post as unknown as Mock;
const mockedAxiosPut = axios.put as unknown as Mock;

function makeFile(size: number): File {
  return new File([new Uint8Array(size)], 'v.mp4', { type: 'video/mp4' });
}

beforeEach(() => {
  vi.clearAllMocks();
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
  it('inits via native HTTP then streams chunks, returning the uuid', async () => {
    const oneMiB = 1024 * 1024;
    const file = makeFile(oneMiB);

    // Init resolves through the native client with the upload_id in Location.
    mockedRequest.mockResolvedValueOnce({
      status: 201,
      headers: { Location: '?upload_id=UPNATIVE' },
      data: '',
    });
    // The single chunk PUT goes through axios (binary body, response body readable
    // under CORS) and returns the final video uuid.
    mockedAxiosPut.mockResolvedValueOnce({ status: 200, data: { video: { uuid: 'native-uuid' } } });

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
    // Init used native HTTP, the chunk used axios.
    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(mockedAxiosPut).toHaveBeenCalledTimes(1);
    const chunk = mockedAxiosPut.mock.calls[0]!;
    expect(chunk[2].headers['Content-Range']).toBe(`bytes 0-${oneMiB - 1}/${oneMiB}`);
  });
});
