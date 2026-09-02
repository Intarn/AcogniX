// frontend/src/services/analyticsService.js
import { apiRequest } from './apiClient';

export const pingStudySession = async (payload, options = {}) => {
  return await apiRequest('/analytics/ping', {
    method: 'POST',
    body: JSON.stringify(payload),
    keepalive: Boolean(options.keepalive)
  });
};

export const getClassPerformance = async (courseId) => {
  return await apiRequest(`/analytics/courses/${courseId}`, {
    method: 'GET'
  });
};

export const getWeeklyClassPerformance = async (courseId) => {
  return await apiRequest(`/analytics/courses/${courseId}/weekly-report`, {
    method: 'GET'
  });
};

// Used by an authorized test/scheduler simulation for UC11 UI04.
export const generateWeeklyClassPerformanceReport = async (courseId, generatedAt = null) => {
  return await apiRequest(`/analytics/courses/${courseId}/weekly-report/generate`, {
    method: 'POST',
    body: JSON.stringify(generatedAt ? { generatedAt } : {})
  });
};

export const getEducatorNotifications = async () => {
  return await apiRequest('/analytics/notifications', {
    method: 'GET'
  });
};

export const markEducatorNotificationRead = async (notificationId) => {
  return await apiRequest(`/analytics/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH'
  });
};

