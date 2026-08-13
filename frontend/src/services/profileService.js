// frontend/src/services/profileService.js
import { apiRequest } from './apiClient';

// 1. Lấy thông tin profile từ backend
export const getUserProfile = async () => {
  return await apiRequest('/profile', { method: 'GET' });
};

// 2. Cập nhật thông tin profile (Hỗ trợ upload file Avatar qua FormData)
export const updateUserProfile = async (displayName, avatarFile) => {
  const formData = new FormData();
  if (displayName) formData.append('displayName', displayName);
  if (avatarFile) formData.append('avatar', avatarFile);

  return await apiRequest('/profile', {
    method: 'PUT',
    body: formData
  });
};

// 3. Đổi mật khẩu tài khoản
export const changePassword = async (currentPassword, newPassword) => {
  return await apiRequest('/profile/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword })
  });
};