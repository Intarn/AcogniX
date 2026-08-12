// frontend/src/services/apiClient.js
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000/api';

export async function apiRequest(
  path,
  options = {}
) {
  const token = localStorage.getItem('accessToken');

  const headers = {
    ...options.headers
  };

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('currentUser');
    }

    const error = new Error(
      data?.message || 'Request failed.'
    );
    error.status = response.status;
    error.code = data?.code;
    error.details = data?.details;

    throw error;
  }

  return data;
}