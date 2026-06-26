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

  it('populates the session and reports logged in via setSession', () => {
    const store = useAuthStore()

    expect(store.isLoggedIn).toBe(false)

    store.setSession({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      username: 'alice',
      host: 'peertube.example',
      channels: [{ id: 7, name: 'chan', displayName: 'Channel' }],
    })

    expect(store.accessToken).toBe('access-1')
    expect(store.refreshToken).toBe('refresh-1')
    expect(store.tokenType).toBe('Bearer')
    expect(store.username).toBe('alice')
    expect(store.host).toBe('peertube.example')
    expect(store.channels).toEqual([{ id: 7, name: 'chan', displayName: 'Channel' }])
    expect(store.isLoggedIn).toBe(true)
  })

  it('defaults refreshToken and tokenType to null in setSession', () => {
    const store = useAuthStore()

    store.setSession({
      accessToken: 'access-2',
      username: 'bob',
      host: 'peertube.example',
      channels: [],
    })

    expect(store.refreshToken).toBeNull()
    expect(store.tokenType).toBeNull()
    expect(store.isLoggedIn).toBe(true)
  })

  it('stores client credentials and expiry, then refreshes tokens via applyRefresh', () => {
    const store = useAuthStore()

    store.setSession({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      clientId: 'cid',
      clientSecret: 'secret',
      expiresAt: 1000,
      username: 'alice',
      host: 'peertube.example',
      channels: [],
    })

    expect(store.clientId).toBe('cid')
    expect(store.clientSecret).toBe('secret')
    expect(store.expiresAt).toBe(1000)

    store.applyRefresh({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      tokenType: 'Bearer',
      expiresAt: 5000,
    })

    expect(store.accessToken).toBe('access-2')
    expect(store.refreshToken).toBe('refresh-2')
    expect(store.expiresAt).toBe(5000)
    // credentials are preserved across a refresh
    expect(store.clientId).toBe('cid')
    expect(store.clientSecret).toBe('secret')
    expect(store.isLoggedIn).toBe(true)
  })

  it('clears everything via logout', () => {
    const store = useAuthStore()

    store.setSession({
      accessToken: 'access-3',
      refreshToken: 'refresh-3',
      tokenType: 'Bearer',
      clientId: 'cid',
      clientSecret: 'secret',
      expiresAt: 1000,
      username: 'carol',
      host: 'peertube.example',
      channels: [{ id: 1, name: 'c', displayName: 'C' }],
    })

    store.logout()

    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.tokenType).toBeNull()
    expect(store.username).toBeNull()
    expect(store.host).toBeNull()
    expect(store.channels).toEqual([])
    expect(store.clientId).toBeNull()
    expect(store.clientSecret).toBeNull()
    expect(store.expiresAt).toBeNull()
    expect(store.isLoggedIn).toBe(false)
  })
})
