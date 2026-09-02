import { apiRequest } from './apiClient';

export const getTotalUsers = async () => {
  return await apiRequest('/admin/users/count', { method: 'GET' });
};

export const getActiveCoursesCount = async () => {
  return await apiRequest('/admin/courses/active-count', { method: 'GET' });
};

export const getAdminCourseDetail = async (courseId) => {
  return await apiRequest(`/admin/courses/${courseId}`, { method: 'GET' });
};

export const adminArchiveCourse = async (courseId, reason = '') => {
  return await apiRequest(`/admin/courses/${courseId}/archive`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
};

export const adminUnarchiveCourse = async (courseId) => {
  return await apiRequest(`/admin/courses/${courseId}/unarchive`, { method: 'POST' });
};