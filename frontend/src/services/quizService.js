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

// Upload Assignment files
export const uploadSubmissionFiles =
  async (
    submissionId,
    files
  ) => {

    const formData =
      new FormData();


    files.forEach(
      (file) => {
        formData.append(
          'files',
          file
        );
      }
    );


    return await apiRequest(
      `/assessments/submissions/${submissionId}/files`,
      {
        method: 'POST',
        body: formData
      }
    );
  };

// 4. Chốt nộp bài
export const submitSubmissionAPI = async (submissionId) => {
  return await apiRequest(`/assessments/submissions/${submissionId}/submit`, { method: 'POST' });
};

export const getAssessmentReview =
  async (
    assessmentId
  ) => {
    return apiRequest(
      `/assessments/${assessmentId}/review`,
      {
        method: 'GET'
      }
    );
  };

export const deleteSubmissionFile =
  async (
    submissionId,
    fileUrl
  ) => {
    return await apiRequest(
      `/assessments/submissions/${submissionId}/files`,
      {
        method: 'DELETE',

        body:
          JSON.stringify({
            fileUrl
          })
      }
    );
  };

export const getSubmissionAnswers =
  async (
    submissionId
  ) => {
    return await apiRequest(
      `/assessments/submissions/${submissionId}/answers`,
      {
        method: 'GET'
      }
    );
  };