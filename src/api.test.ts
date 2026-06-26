import type { AxiosRequestHeaders, AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import API from './api'
import { useAuthStore } from './stores/auth'

async function getCapturedHeaders(url: string) {
  const response = await API.get(url, {
    adapter: async (config): Promise<AxiosResponse> => ({
      config,
      data: null,
      headers: {},
      status: 200,
      statusText: 'OK',
    }),
  })

  return response.config.headers as AxiosRequestHeaders
}

describe('API client', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds a bearer Authorization header for requests to the logged-in host', async () => {
    const authStore = useAuthStore()
    authStore.setSession({
      accessToken: 'token-123',
      username: 'yaju',
      host: 'peertube.example',
      channels: [],
    })

    const headers = await getCapturedHeaders('https://peertube.example/api/v1/videos')

    expect(headers.Authorization).toBe('Bearer token-123')
  })

  it('matches the logged-in host case-insensitively and ignoring a scheme', async () => {
    const authStore = useAuthStore()
    authStore.setSession({
      accessToken: 'token-123',
      username: 'yaju',
      host: 'https://PeerTube.Example/',
      channels: [],
    })

    const headers = await getCapturedHeaders('https://peertube.example/api/v1/videos')

    expect(headers.Authorization).toBe('Bearer token-123')
  })

  it('does not attach the token to requests for a different instance', async () => {
    const authStore = useAuthStore()
    authStore.setSession({
      accessToken: 'token-123',
      username: 'yaju',
      host: 'peertube.example',
      channels: [],
    })

    const headers = await getCapturedHeaders('https://other.instance/api/v1/videos')

    expect(headers.Authorization).toBeUndefined()
  })

  it('does not add Authorization when there is no session', async () => {
    const headers = await getCapturedHeaders('https://peertube.example/api/v1/videos')

    expect(headers.Authorization).toBeUndefined()
  })
})
