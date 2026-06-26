// 認証担当
import { defineStore } from 'pinia';
import type { VideoChannel } from '@/api/peertube';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null as string | null,
    refreshToken: null as string | null,
    tokenType: null as string | null,
    username: null as string | null,
    host: null as string | null,
    channels: [] as VideoChannel[],
    // OAuth client credentials + access-token expiry, used to refresh the
    // access token transparently before it lapses.
    clientId: null as string | null,
    clientSecret: null as string | null,
    expiresAt: null as number | null,
  }),
  getters: {
    getAccessToken: state => state.accessToken,
    // Require a full session (token + host), so a token restored from the
    // pre-upload persisted schema is treated as logged out instead of crashing
    // the upload flow on a null host.
    isLoggedIn: (state): boolean => !!state.accessToken && !!state.host,
  },
  actions: {
    setToken(token: string) {
      this.accessToken = token;
    },
    clearToken() {
      this.accessToken = null;
    },
    setSession(s: {
      accessToken: string;
      refreshToken?: string | null;
      tokenType?: string | null;
      username: string | null;
      host: string | null;
      channels: VideoChannel[];
      clientId?: string | null;
      clientSecret?: string | null;
      expiresAt?: number | null;
    }) {
      this.accessToken = s.accessToken;
      this.refreshToken = s.refreshToken ?? null;
      this.tokenType = s.tokenType ?? null;
      this.username = s.username;
      this.host = s.host;
      this.channels = s.channels;
      this.clientId = s.clientId ?? null;
      this.clientSecret = s.clientSecret ?? null;
      this.expiresAt = s.expiresAt ?? null;
    },
    // Update just the tokens after a refresh, preserving the rest of the session.
    applyRefresh(t: {
      accessToken: string;
      refreshToken?: string | null;
      tokenType?: string | null;
      expiresAt?: number | null;
    }) {
      this.accessToken = t.accessToken;
      if (t.refreshToken !== undefined) this.refreshToken = t.refreshToken;
      if (t.tokenType !== undefined) this.tokenType = t.tokenType;
      if (t.expiresAt !== undefined) this.expiresAt = t.expiresAt;
    },
    logout() {
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenType = null;
      this.username = null;
      this.host = null;
      this.channels = [];
      this.clientId = null;
      this.clientSecret = null;
      this.expiresAt = null;
    },
  },
  persist: true,
});
