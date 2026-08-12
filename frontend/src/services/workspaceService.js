// frontend/src/services/workspaceService.js
import { apiRequest } from './apiClient';

// Lấy thông tin tổng quan workspace của learner (GET /api/workspace)
export const getWorkspaceData = async () => {
  try {
    return await apiRequest('/workspace', { method: 'GET' });
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu workspace:", error);
    throw error;
  }
};

// Lấy danh sách tài liệu hoặc tạo project mới nếu cần
export const createWorkspaceProject = async (name, workspaceId, courseId = null) => {
  try {
    return await apiRequest('/workspace/projects', {
      method: 'POST',
      body: JSON.stringify({ name, workspaceId, courseId }) // Gửi kèm workspaceId lên Server
    });
  } catch (error) {
    console.error("Lỗi khi tạo project workspace:", error);
    throw error;
  }
};

// Upload tài liệu cá nhân vào Project cụ thể (Sử dụng FormData vì có file)
export const uploadProjectMaterial = async (projectId, file) => {
  try {
    const formData = new FormData();
    formData.append('material', file);

    return await apiRequest(`/workspace/projects/${projectId}/materials`, {
      method: 'POST',
      body: formData // apiClient tự động xử lý không thêm Content-Type JSON khi là FormData[cite: 14]
    });
  } catch (error) {
    console.error("Lỗi khi upload tài liệu:", error);
    throw error;
  }
};

export const deleteProjectMaterial = async (projectId, materialId) => {
  return await apiRequest(`/workspace/projects/${projectId}/materials/${materialId}`, {
    method: 'DELETE'
  });
};