import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './auth'

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts without an access token', () => {
    const store = useAuthStore()

    expect(store.accessToken).toBeNull()
    expect(store.getAccessToken).toBeNull()
  })

  it('sets and clears the access token', () => {
    const store = useAuthStore()

    store.setToken('token-123')
    expect(store.accessToken).toBe('token-123')
    expect(store.getAccessToken).toBe('token-123')

    store.clearToken()
    expect(store.accessToken).toBeNull()
    expect(store.getAccessToken).toBeNull()
  })
})
