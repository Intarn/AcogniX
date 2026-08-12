// frontend/src/services/quizService.js
import { apiRequest } from './apiClient';

// 1. Lấy thông tin bài kiểm tra và danh sách câu hỏi
export const getOpenAssessment = async (assessmentId) => {
  return await apiRequest(`/assessments/${assessmentId}/open`, { method: 'GET' });
};

// 2. Bắt đầu phiên làm bài mới (Hoặc lấy phiên đang làm dở)
export const startSubmission = async (assessmentId) => {
  return await apiRequest(`/assessments/${assessmentId}/submissions`, { method: 'POST' });
};

// 3. Lưu từng câu trả lời ngay khi người dùng chọn
export const saveAnswer = async (submissionId, questionId, response) => {
  return await apiRequest(`/assessments/submissions/${submissionId}/answers/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify({ response })
  });
};

// 4. Chốt nộp bài
export const submitSubmissionAPI = async (submissionId) => {
  return await apiRequest(`/assessments/submissions/${submissionId}/submit`, { method: 'POST' });
};