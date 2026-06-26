// トークン取得
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const API = axios.create();

API.interceptors.request.use((config) => {
  const token = useAuthStore().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
