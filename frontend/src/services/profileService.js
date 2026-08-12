// frontend/src/services/profileService.js
import { apiRequest } from './apiClient';

// Lấy thông tin profile từ backend
export const getUserProfile = async () => {
  try {
    return await apiRequest('/profile', { method: 'GET' });
  } catch (error) {
    console.error("Lỗi khi tải thông tin profile:", error);
    throw error;
  }
};

// Cập nhật thông tin profile lên backend
export const updateUserProfile = async (profileData) => {
  try {
    return await apiRequest('/profile', {
      method: 'PUT', // hoặc PATCH tùy backend cấu hình
      body: JSON.stringify(profileData)
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật profile:", error);
    throw error;
  }
};