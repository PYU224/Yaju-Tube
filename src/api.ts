// トークン取得
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { normalizeHost } from '@/api/peertube';

const API = axios.create();

function hostOfUrl(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

API.interceptors.request.use((config) => {
  const auth = useAuthStore();
  const token = auth.accessToken;
  // Only attach the bearer token to requests for the instance the user logged
  // into. The video list can target any selected instance, so a global token
  // would otherwise leak to (possibly malicious) third-party instances.
  if (token && auth.host) {
    const target = hostOfUrl(config.url) ?? hostOfUrl(config.baseURL);
    if (target && target === normalizeHost(auth.host).toLowerCase()) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default API;
