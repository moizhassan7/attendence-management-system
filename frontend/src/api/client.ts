import axios from 'axios';

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function resolveApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  // Other PCs on the LAN must not call *their* localhost — use this page's
  // origin so Vite (dev) or nginx (prod) can proxy to the API.
  if (typeof window !== 'undefined' && !isLoopbackHost(window.location.hostname)) {
    if (envUrl && (envUrl.startsWith('/') || !isLoopbackHost(new URL(envUrl, window.location.origin).hostname))) {
      return envUrl;
    }
    return '/api/v1';
  }

  return envUrl || (import.meta.env.DEV ? 'http://127.0.0.1:8000/api/v1' : '/api/v1');
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

// Intercept requests to add the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Default JSON Content-Type breaks FormData (backup restore upload).
    // Let the browser set multipart/form-data with the correct boundary.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
      const headers = config.headers as { delete?: (name: string) => void } & Record<string, unknown>;
      if (typeof headers.delete === 'function') {
        headers.delete('Content-Type');
      } else {
        delete headers['Content-Type'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept responses to handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
