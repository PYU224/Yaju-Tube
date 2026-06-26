import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import {
  apiBase,
  cancelUpload,
  getMyAccount,
  getOAuthClient,
  getResumeOffset,
  initResumableUpload,
  login,
  normalizeHost,
  PeerTubeAuthError,
  refreshAccessToken,
  resumeUpload,
  updateVideo,
  uploadVideo,
  VIDEO_PRIVACY,
} from './peertube';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedGet = axios.get as unknown as Mock;
const mockedPost = axios.post as unknown as Mock;
const mockedPut = axios.put as unknown as Mock;
const mockedDelete = axios.delete as unknown as Mock;

function makeFile(size: number): File {
  return new File([new Uint8Array(size)], 'v.mp4', { type: 'video/mp4' });
}

// Returns the arguments of the nth call to a mock, typed as a non-undefined
// tuple so that strict `noUncheckedIndexedAccess` access stays clean in tests.
function callArgs(mock: Mock, index: number): [string, unknown, RequestConfig] {
  const call = mock.mock.calls[index];
  if (!call) throw new Error(`expected mock call #${index}`);
  return call as [string, unknown, RequestConfig];
}

interface RequestConfig {
  headers: Record<string, string>;
  validateStatus?: (status: number) => boolean;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeHost / apiBase', () => {
  it('strips protocol and trailing slashes', () => {
    expect(normalizeHost('https://peertube.example/')).toBe('peertube.example');
    expect(normalizeHost('http://peertube.example///')).toBe('peertube.example');
    expect(normalizeHost('peertube.example')).toBe('peertube.example');
  });

  it('builds an https api base', () => {
    expect(apiBase('https://peertube.example/')).toBe('https://peertube.example/api/v1');
  });
});

describe('VIDEO_PRIVACY', () => {
  it('has the documented ids', () => {
    expect(VIDEO_PRIVACY).toEqual({ PUBLIC: 1, UNLISTED: 2, PRIVATE: 3, INTERNAL: 4 });
  });
});

describe('getOAuthClient', () => {
  it('fetches and returns the client credentials', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { client_id: 'cid', client_secret: 'secret' },
    });

    const client = await getOAuthClient('peertube.example');

    expect(mockedGet).toHaveBeenCalledWith(
      'https://peertube.example/api/v1/oauth-clients/local',
    );
    expect(client).toEqual({ client_id: 'cid', client_secret: 'secret' });
  });
});

describe('login', () => {
  it('logs in (happy path) and returns tokens', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { client_id: 'cid', client_secret: 'secret' },
    });
    mockedPost.mockResolvedValueOnce({
      data: {
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'Bearer',
      },
    });

    const result = await login({
      host: 'peertube.example',
      username: 'alice',
      password: 'pw',
    });

    expect(result).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      clientId: 'cid',
      clientSecret: 'secret',
    });

    const [url, bodyArg, config] = callArgs(mockedPost, 0);
    expect(url).toBe('https://peertube.example/api/v1/users/token');
    const body = bodyArg as URLSearchParams;
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBe('secret');
    expect(body.get('grant_type')).toBe('password');
    expect(body.get('username')).toBe('alice');
    expect(body.get('password')).toBe('pw');
    expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(config.headers['x-peertube-otp']).toBeUndefined();
  });

  it('returns expiresIn and client credentials when present', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { client_id: 'cid', client_secret: 'secret' },
    });
    mockedPost.mockResolvedValueOnce({
      data: {
        access_token: 'a',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 3600,
      },
    });

    const result = await login({ host: 'peertube.example', username: 'a', password: 'b' });

    expect(result.clientId).toBe('cid');
    expect(result.clientSecret).toBe('secret');
    expect(result.expiresIn).toBe(3600);
  });

  it('sends the otp header when provided', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { client_id: 'cid', client_secret: 'secret' },
    });
    mockedPost.mockResolvedValueOnce({
      data: { access_token: 'a', refresh_token: 'r', token_type: 'Bearer' },
    });

    await login({
      host: 'peertube.example',
      username: 'alice',
      password: 'pw',
      otpToken: '123456',
    });

    const config = callArgs(mockedPost, 0)[2];
    expect(config.headers['x-peertube-otp']).toBe('123456');
  });

  it.each([
    'invalid_grant',
    'missing_two_factor',
    'invalid_two_factor',
  ])('maps the %s error code to PeerTubeAuthError', async (code) => {
    mockedGet.mockResolvedValueOnce({
      data: { client_id: 'cid', client_secret: 'secret' },
    });
    mockedPost.mockRejectedValueOnce({ response: { data: { code } } });

    await expect(
      login({ host: 'peertube.example', username: 'a', password: 'b' }),
    ).rejects.toMatchObject({
      name: 'PeerTubeAuthError',
      code,
    });

    await expect(
      (async () => {
        mockedGet.mockResolvedValueOnce({
          data: { client_id: 'cid', client_secret: 'secret' },
        });
        mockedPost.mockRejectedValueOnce({ response: { data: { code } } });
        return login({ host: 'peertube.example', username: 'a', password: 'b' });
      })(),
    ).rejects.toBeInstanceOf(PeerTubeAuthError);
  });

  it('maps the OAuth2 `error` field (e.g. invalid_grant) to PeerTubeAuthError', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { client_id: 'cid', client_secret: 'secret' },
    });
    // PeerTube's OAuth layer reports bad credentials via `error`, not `code`.
    mockedPost.mockRejectedValueOnce({ response: { data: { error: 'invalid_grant' } } });

    await expect(
      login({ host: 'peertube.example', username: 'a', password: 'b' }),
    ).rejects.toMatchObject({ name: 'PeerTubeAuthError', code: 'invalid_grant' });
  });

  it('matches the auth code in `error` even when `code` holds an unrelated HTTP code', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { client_id: 'cid', client_secret: 'secret' },
    });
    // `code` is a numeric HTTP status while the OAuth failure is in `error`.
    mockedPost.mockRejectedValueOnce({
      response: { data: { code: 400, error: 'invalid_grant' } },
    });

    await expect(
      login({ host: 'peertube.example', username: 'a', password: 'b' }),
    ).rejects.toMatchObject({ name: 'PeerTubeAuthError', code: 'invalid_grant' });
  });

  it('rethrows non-auth errors untouched', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { client_id: 'cid', client_secret: 'secret' },
    });
    const networkErr = new Error('Network down');
    mockedPost.mockRejectedValueOnce(networkErr);

    await expect(
      login({ host: 'peertube.example', username: 'a', password: 'b' }),
    ).rejects.toBe(networkErr);
  });
});

describe('refreshAccessToken', () => {
  it('posts a refresh_token grant and returns the new tokens', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        token_type: 'Bearer',
        expires_in: 7200,
      },
    });

    const result = await refreshAccessToken({
      host: 'peertube.example',
      clientId: 'cid',
      clientSecret: 'secret',
      refreshToken: 'old-refresh',
    });

    expect(result).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
    });

    const [url, bodyArg, config] = callArgs(mockedPost, 0);
    expect(url).toBe('https://peertube.example/api/v1/users/token');
    const body = bodyArg as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old-refresh');
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBe('secret');
    expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });
});

describe('getMyAccount', () => {
  it('returns username from account and channels from videoChannels', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        account: { username: 'alice' },
        videoChannels: [{ id: 7, name: 'chan', displayName: 'Channel' }],
      },
    });

    const me = await getMyAccount({ host: 'peertube.example', token: 'tok' });

    expect(mockedGet).toHaveBeenCalledWith(
      'https://peertube.example/api/v1/users/me',
      { headers: { Authorization: 'Bearer tok' } },
    );
    expect(me).toEqual({
      username: 'alice',
      channels: [{ id: 7, name: 'chan', displayName: 'Channel' }],
    });
  });

  it('falls back to top-level username and empty channels', async () => {
    mockedGet.mockResolvedValueOnce({ data: { username: 'bob' } });

    const me = await getMyAccount({ host: 'peertube.example', token: 'tok' });

    expect(me).toEqual({ username: 'bob', channels: [] });
  });
});

describe('initResumableUpload', () => {
  it('sends correct headers and parses the upload_id from an absolute location', async () => {
    const file = makeFile(1000);
    mockedPost.mockResolvedValueOnce({
      headers: {
        location: 'https://peertube.example/api/v1/videos/upload-resumable?upload_id=ABC123',
      },
    });

    const uploadId = await initResumableUpload({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'My Video',
      channelId: 5,
      privacy: VIDEO_PRIVACY.UNLISTED,
      description: 'desc',
    });

    expect(uploadId).toBe('ABC123');

    const [url, body, config] = callArgs(mockedPost, 0);
    expect(url).toBe('https://peertube.example/api/v1/videos/upload-resumable');
    expect(body).toEqual({
      filename: 'v.mp4',
      name: 'My Video',
      channelId: 5,
      privacy: VIDEO_PRIVACY.UNLISTED,
      description: 'desc',
    });
    expect(config.headers['X-Upload-Content-Length']).toBe('1000');
    expect(config.headers['X-Upload-Content-Type']).toBe('video/mp4');
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.headers['Authorization']).toBe('Bearer tok');
  });

  it('parses upload_id from a relative location', async () => {
    const file = makeFile(10);
    mockedPost.mockResolvedValueOnce({
      headers: { location: '/api/v1/videos/upload-resumable?upload_id=REL99&foo=bar' },
    });

    const uploadId = await initResumableUpload({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'n',
      channelId: 1,
    });

    expect(uploadId).toBe('REL99');
  });

  it('defaults privacy to PUBLIC and omits description when not given', async () => {
    const file = makeFile(10);
    mockedPost.mockResolvedValueOnce({
      headers: { location: '?upload_id=X' },
    });

    await initResumableUpload({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'n',
      channelId: 1,
    });

    const body = callArgs(mockedPost, 0)[1] as Record<string, unknown>;
    expect(body['privacy']).toBe(VIDEO_PRIVACY.PUBLIC);
    expect('description' in body).toBe(false);
  });

  it('throws when no upload_id is present', async () => {
    const file = makeFile(10);
    mockedPost.mockResolvedValueOnce({ headers: { location: 'no-id-here' } });

    await expect(
      initResumableUpload({
        host: 'peertube.example',
        token: 'tok',
        file,
        name: 'n',
        channelId: 1,
      }),
    ).rejects.toThrow(/upload_id/);
  });
});

describe('uploadVideo', () => {
  it('uploads in multiple chunks with correct Content-Range, calls onProgress, and returns the uuid', async () => {
    // 3 MiB file -> first chunk 1 MiB, second chunk grows to 2 MiB (remaining), so 2 chunks total.
    const oneMiB = 1024 * 1024;
    const file = makeFile(3 * oneMiB);

    mockedPost.mockResolvedValueOnce({
      headers: { location: '?upload_id=UP1' },
    });

    // chunk responses: 308 then 200
    mockedPut
      .mockResolvedValueOnce({ status: 308, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { video: { uuid: 'final-uuid' } } });

    const progress: Array<[number, number]> = [];

    const result = await uploadVideo({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'n',
      channelId: 1,
      onProgress: (u, t) => progress.push([u, t]),
    });

    expect(result).toEqual({ uuid: 'final-uuid' });
    expect(mockedPut).toHaveBeenCalledTimes(2);

    const total = 3 * oneMiB;

    const firstCall = callArgs(mockedPut, 0);
    const firstConfig = firstCall[2];
    expect(firstConfig.headers['Content-Type']).toBe('application/octet-stream');
    expect(firstConfig.headers['Content-Range']).toBe(`bytes 0-${oneMiB - 1}/${total}`);
    expect(firstConfig.headers['Authorization']).toBe('Bearer tok');
    expect(firstConfig.validateStatus?.(200)).toBe(true);
    expect(firstConfig.validateStatus?.(308)).toBe(true);
    expect(firstConfig.validateStatus?.(500)).toBe(false);

    const secondCall = callArgs(mockedPut, 1);
    // after a fast first chunk, chunkSize doubles to 2 MiB; remaining is 2 MiB
    expect(secondCall[2].headers['Content-Range']).toBe(`bytes ${oneMiB}-${total - 1}/${total}`);

    // body blobs are the right slices
    expect((firstCall[1] as Blob).size).toBe(oneMiB);
    expect((secondCall[1] as Blob).size).toBe(2 * oneMiB);

    expect(progress).toEqual([
      [oneMiB, total],
      [total, total],
    ]);
  });

  it('reports the upload_id via onInit before sending chunks', async () => {
    const oneMiB = 1024 * 1024;
    const file = makeFile(oneMiB);
    mockedPost.mockResolvedValueOnce({ headers: { location: '?upload_id=INIT7' } });
    mockedPut.mockResolvedValueOnce({ status: 200, data: { video: { uuid: 'u-init' } } });

    const seen: string[] = [];
    const result = await uploadVideo({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'n',
      channelId: 1,
      onInit: (uploadId) => seen.push(uploadId),
    });

    expect(seen).toEqual(['INIT7']);
    expect(result).toEqual({ uuid: 'u-init' });
  });

  it('retries the same offset on HTTP 413 and shrinks the chunk', async () => {
    const oneMiB = 1024 * 1024;
    const file = makeFile(oneMiB);

    mockedPost.mockResolvedValueOnce({ headers: { location: '?upload_id=UP2' } });

    const half = oneMiB / 2;
    // First attempt (1 MiB) is rejected with 413. The chunk ceiling/size halve to
    // 512 KiB, so the retry sends two 512 KiB chunks (308 then final 200).
    mockedPut
      .mockRejectedValueOnce({ response: { status: 413 } })
      .mockResolvedValueOnce({ status: 308, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { video: { uuid: 'u413' } } });

    const result = await uploadVideo({
      host: 'peertube.example',
      token: 'tok',
      file,
      name: 'n',
      channelId: 1,
    });

    expect(result).toEqual({ uuid: 'u413' });
    expect(mockedPut).toHaveBeenCalledTimes(3);

    const total = oneMiB;
    // first attempt requested 1 MiB at offset 0
    expect(callArgs(mockedPut, 0)[2].headers['Content-Range']).toBe(`bytes 0-${oneMiB - 1}/${total}`);
    // retry is the SAME offset 0 but a smaller chunk (512 KiB)
    const retry = callArgs(mockedPut, 1);
    expect(retry[2].headers['Content-Range']).toBe(`bytes 0-${half - 1}/${total}`);
    expect((retry[1] as Blob).size).toBe(half);
    // next chunk continues from offset 512 KiB; ceiling stays at 512 KiB
    const third = callArgs(mockedPut, 2);
    expect(third[2].headers['Content-Range']).toBe(`bytes ${half}-${total - 1}/${total}`);
    expect((third[1] as Blob).size).toBe(half);
  });

  it('throws AbortError when the signal is already aborted', async () => {
    const file = makeFile(1024 * 1024);
    mockedPost.mockResolvedValueOnce({ headers: { location: '?upload_id=UP3' } });

    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadVideo({
        host: 'peertube.example',
        token: 'tok',
        file,
        name: 'n',
        channelId: 1,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('throws when the upload finishes without a uuid', async () => {
    const oneMiB = 1024 * 1024;
    const file = makeFile(oneMiB);
    mockedPost.mockResolvedValueOnce({ headers: { location: '?upload_id=UP4' } });
    mockedPut.mockResolvedValueOnce({ status: 200, data: {} });

    await expect(
      uploadVideo({
        host: 'peertube.example',
        token: 'tok',
        file,
        name: 'n',
        channelId: 1,
      }),
    ).rejects.toThrow(/without a video UUID/);
  });

  it('rethrows non-413 chunk errors', async () => {
    const file = makeFile(1024 * 1024);
    mockedPost.mockResolvedValueOnce({ headers: { location: '?upload_id=UP5' } });
    const boom = { response: { status: 500 } };
    mockedPut.mockRejectedValueOnce(boom);

    await expect(
      uploadVideo({
        host: 'peertube.example',
        token: 'tok',
        file,
        name: 'n',
        channelId: 1,
      }),
    ).rejects.toBe(boom);
  });
});

describe('getResumeOffset', () => {
  it('probes with bytes */size and returns the next byte from the Range header', async () => {
    const size = 1024 * 1024;
    const have = 512 * 1024;
    mockedPut.mockResolvedValueOnce({
      status: 308,
      headers: { range: `bytes=0-${have - 1}` },
      data: {},
    });

    const probe = await getResumeOffset({
      host: 'peertube.example',
      token: 'tok',
      uploadId: 'UPR',
      fileSize: size,
    });

    expect(probe.offset).toBe(have);
    expect(probe.uuid).toBeUndefined();

    const [url, body, config] = callArgs(mockedPut, 0);
    expect(url).toBe('https://peertube.example/api/v1/videos/upload-resumable?upload_id=UPR');
    expect(body).toBeUndefined();
    expect(config.headers['Content-Range']).toBe(`bytes */${size}`);
  });

  it('returns the full size and the video uuid when the server reports it complete (200)', async () => {
    const size = 4096;
    mockedPut.mockResolvedValueOnce({
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

    expect(probe.offset).toBe(size);
    expect(probe.uuid).toBe('done-uuid');
  });

  it('returns offset 0 when there is no Range header on a 308', async () => {
    mockedPut.mockResolvedValueOnce({ status: 308, headers: {}, data: {} });

    const probe = await getResumeOffset({
      host: 'peertube.example',
      token: 'tok',
      uploadId: 'UPR3',
      fileSize: 4096,
    });

    expect(probe.offset).toBe(0);
  });
});

describe('resumeUpload', () => {
  it('continues from the server offset and returns the uuid', async () => {
    const total = 1024 * 1024;
    const have = 512 * 1024;
    const file = makeFile(total);

    // First PUT is the resume probe, then the remaining chunk completes.
    mockedPut
      .mockResolvedValueOnce({ status: 308, headers: { range: `bytes=0-${have - 1}` }, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { video: { uuid: 'resumed' } } });

    const progress: Array<[number, number]> = [];
    const result = await resumeUpload({
      host: 'peertube.example',
      token: 'tok',
      file,
      uploadId: 'UPR',
      onProgress: (u, t) => progress.push([u, t]),
    });

    expect(result).toEqual({ uuid: 'resumed' });
    expect(mockedPut).toHaveBeenCalledTimes(2);

    // probe
    expect(callArgs(mockedPut, 0)[2].headers['Content-Range']).toBe(`bytes */${total}`);
    // remaining chunk continues from the reported offset
    const chunk = callArgs(mockedPut, 1);
    expect(chunk[2].headers['Content-Range']).toBe(`bytes ${have}-${total - 1}/${total}`);
    expect((chunk[1] as Blob).size).toBe(total - have);
    expect(progress).toEqual([[total, total]]);
  });

  it('completes from the probe uuid when the server already has the whole file', async () => {
    const total = 1024;
    const file = makeFile(total);
    // Probe returns 200 (already complete) with the finished video; no chunks.
    mockedPut.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: { video: { uuid: 'already-done' } },
    });

    const progress: Array<[number, number]> = [];
    const result = await resumeUpload({
      host: 'peertube.example',
      token: 'tok',
      file,
      uploadId: 'UPC',
      onProgress: (u, t) => progress.push([u, t]),
    });

    expect(result).toEqual({ uuid: 'already-done' });
    expect(mockedPut).toHaveBeenCalledTimes(1); // probe only, no chunk uploads
    expect(progress).toEqual([[total, total]]);
  });
});

describe('cancelUpload', () => {
  it('issues a DELETE with the upload id and auth header', async () => {
    mockedDelete.mockResolvedValueOnce({ status: 204 });

    await cancelUpload({ host: 'peertube.example', token: 'tok', uploadId: 'UP9' });

    expect(mockedDelete).toHaveBeenCalledWith(
      'https://peertube.example/api/v1/videos/upload-resumable?upload_id=UP9',
      { headers: { Authorization: 'Bearer tok' } },
    );
  });
});

describe('updateVideo', () => {
  it('issues a PUT to the video uuid with partial data', async () => {
    mockedPut.mockResolvedValueOnce({ status: 204 });

    await updateVideo({
      host: 'peertube.example',
      token: 'tok',
      uuid: 'vid-uuid',
      data: { name: 'New name' },
    });

    expect(mockedPut).toHaveBeenCalledWith(
      'https://peertube.example/api/v1/videos/vid-uuid',
      { name: 'New name' },
      { headers: { Authorization: 'Bearer tok' } },
    );
  });
});
