import { apiRequest } from './apiClient';

export const pingStudySession = async (courseId = null) => {
  return await apiRequest('/analytics/ping', {
    method: 'POST',
    body: JSON.stringify({ courseId })
  });
};

export const getClassPerformance = async (courseId) => {
  return await apiRequest(`/analytics/courses/${courseId}`, { method: 'GET' });
};