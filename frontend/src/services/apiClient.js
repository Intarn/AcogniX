// frontend/src/services/apiClient.js
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000/api';
console.log('API_BASE_URL:', API_BASE_URL);
export async function apiRequest(
  path,
  options = {}
) {
  const { authToken, ...requestOptions } = options;
  const token = authToken || localStorage.getItem('accessToken');

  const headers = {
    ...requestOptions.headers
  };

  if (
    requestOptions.body &&
    !(requestOptions.body instanceof FormData)
  ) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const method = String(requestOptions.method || 'GET').toUpperCase();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers,
    ...(method === 'GET' ? { cache: 'no-store' } : {})
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
  const error = new Error(data?.message || 'Request failed.');
  error.status = response.status;
  error.code = data?.code;
  error.details = data?.details;
  throw error;
}

if (data === null) {
  const error = new Error('Invalid or empty response from server.');
  error.status = response.status;
  throw error;
}

return data;
}