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
  }),
  getters: {
    getAccessToken: state => state.accessToken,
    isLoggedIn: (state): boolean => !!state.accessToken,
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
    }) {
      this.accessToken = s.accessToken;
      this.refreshToken = s.refreshToken ?? null;
      this.tokenType = s.tokenType ?? null;
      this.username = s.username;
      this.host = s.host;
      this.channels = s.channels;
    },
    logout() {
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenType = null;
      this.username = null;
      this.host = null;
      this.channels = [];
    },
  },
  persist: true,
});
