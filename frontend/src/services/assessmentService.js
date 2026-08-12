// frontend/src/services/assessmentService.js
import { apiRequest } from './apiClient';

// Lấy danh sách bài kiểm tra
export const getAssessments = async () => {
  try {
    return await apiRequest('/assessments', { method: 'GET' });
  } catch (error) {
    console.error("Lỗi khi tải danh sách bài kiểm tra:", error);
    throw error;
  }
};

// Nộp bài kiểm tra lên backend
export const submitAssessment = async (assessmentId, answers) => {
  try {
    return await apiRequest(`/assessments/${assessmentId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
  } catch (error) {
    console.error("Lỗi khi nộp bài:", error);
    throw error;
  }
};