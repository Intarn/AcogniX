import { apiRequest } from '../../services/apiClient';

export function searchUsers(query = '') {
  return apiRequest(`/admin/users?query=${encodeURIComponent(query)}`);
}

export function banUser(userId) {
  return apiRequest(`/admin/users/${userId}/ban`, { method: 'POST' });
}

export function unbanUser(userId) {
  return apiRequest(`/admin/users/${userId}/unban`, { method: 'POST' });
}

export function changeUserRole(userId, role) {
  return apiRequest(`/admin/users/${userId}/role`, {
    method: 'POST',
    body: JSON.stringify({ role })
  });
}

export function resetUserPassword(userId) {
  return apiRequest(`/admin/users/${userId}/reset-password`, { method: 'POST' });
}

export function requestDeleteUser(userId) {
  return apiRequest(`/admin/users/${userId}/delete/request`, { method: 'POST' });
}

export function confirmDeleteUser(userId, code) {
  return apiRequest(`/admin/users/${userId}/delete/confirm`, {
    method: 'POST',
    body: JSON.stringify({ code })
  });
}

// Append to the end of adminApi.js
export async function getAllCoursesForAdmin(query = '') {
  // To be updated with actual API implementation later
  return await apiRequest(`/admin/courses?query=${encodeURIComponent(query)}`);
}