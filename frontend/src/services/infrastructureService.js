import { apiRequest } from './apiClient';

export const getSystemHealth = async () => {
  return await apiRequest('/admin/infrastructure/health', { method: 'GET' });
};

export const getApiUsage = async () => {
  return await apiRequest('/admin/infrastructure/api-usage', { method: 'GET' });
};

export const updateLLMKey = async (apiKey) => {
  return await apiRequest('/admin/infrastructure/api-keys/update', {
    method: 'POST',
    body: JSON.stringify({ apiKey })
  });
};
export const getPlatformAnalytics = async () => {
  return await apiRequest('/admin/infrastructure/analytics', { method: 'GET' });
};
