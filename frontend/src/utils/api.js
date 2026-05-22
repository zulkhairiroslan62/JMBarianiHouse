import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - handle 401 + normalize data
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Safely extract an array from API response data.
 * Handles cases where the API returns:
 * - An array directly: [...]
 * - An object with the data nested: { items: [...] } or { invoices: [...] }
 * - null/undefined
 * - An unexpected object
 */
export function safeArray(data, ...keys) {
  if (Array.isArray(data)) return data;
  if (data == null) return [];
  if (typeof data === 'object') {
    // Try each key in order
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key];
    }
    // If it's an object but no matching key found, return empty array
    return [];
  }
  return [];
}

/**
 * Safely extract a number from API response data.
 */
export function safeNumber(value, fallback = 0) {
  if (value == null) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

/**
 * Safely extract an object from API response data.
 */
export function safeObject(data, fallback = {}) {
  if (data != null && typeof data === 'object' && !Array.isArray(data)) return data;
  return fallback;
}

export default api;
