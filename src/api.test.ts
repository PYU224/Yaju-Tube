import type { AxiosRequestHeaders, AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import API from './api'
import { useAuthStore } from './stores/auth'

async function getCapturedHeaders() {
  const response = await API.get('/videos', {
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

  it('adds a bearer Authorization header when an access token is available', async () => {
    const authStore = useAuthStore()
    authStore.setToken('token-123')

    const headers = await getCapturedHeaders()

    expect(headers.Authorization).toBe('Bearer token-123')
  })

  it('does not add Authorization when no access token is available', async () => {
    const headers = await getCapturedHeaders()

    expect(headers.Authorization).toBeUndefined()
  })
})
