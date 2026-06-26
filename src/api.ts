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
  // Don't attach a token we know is expired: the upload flow refreshes it
  // before uploading, but public list requests (Tab2) have no refresh path and
  // would otherwise get a 401 purely because of a stale header.
  const expired = auth.expiresAt !== null && Date.now() >= auth.expiresAt;
  // Only attach the bearer token to requests for the instance the user logged
  // into. The video list can target any selected instance, so a global token
  // would otherwise leak to (possibly malicious) third-party instances.
  if (token && auth.host && !expired) {
    const target = hostOfUrl(config.url) ?? hostOfUrl(config.baseURL);
    if (target && target === normalizeHost(auth.host).toLowerCase()) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default API;
