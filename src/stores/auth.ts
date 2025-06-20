// 認証担当
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null as string | null,
  }),
  getters: {
    getAccessToken: state => state.accessToken,
  },
  actions: {
    setToken(token: string) {
      this.accessToken = token;
    },
    clearToken() {
      this.accessToken = null;
    },
  },
  persist: true,
});
