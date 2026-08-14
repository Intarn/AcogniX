// frontend/src/services/aiService.js
import { apiRequest } from './apiClient';



export const extractDocumentText = async (materialId, file) => {
  const formData = new FormData();
  formData.append('materialId', materialId);
  formData.append('document', file); // Đúng tên field multer ở backend: 'document'

  return await apiRequest('/ai/extract-text', {
    method: 'POST',
    body: formData
  });
};
/**
 * Gọi tin nhắn gửi AI Assistant
 */
export const sendAIChatMessage = async (
  projectId,
  materialIds,
  conversationId,
  userMessage
) => {
  return await apiRequest('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      materialIds,
      conversationId: conversationId || null,
      userMessage
    })
  });
};

/**
 * Lịch sử hội thoại của AI Project
 */
export const getAIConversationHistory = async (projectId, conversationId = null) => {
  const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : '';
  return await apiRequest(`/ai/projects/${projectId}/conversation${query}`, {
    method: 'GET'
  });
};

/**
 * AI tự động tạo Practice Quiz từ tài liệu trong Project
 */
export const generateAIQuiz = async (projectId, materialIds, questionCount = 5, difficulty = 'medium') => {
  return await apiRequest('/ai/generate-quiz', {
    method: 'POST',
    body: JSON.stringify({ projectId, materialIds, questionCount, difficulty })
  });
};

/**
 * Lấy danh sách các Practice Quizzes đã được AI tạo
 */
export const getSavedQuizzes = async (projectId) => {
  return await apiRequest(`/ai/projects/${projectId}/quizzes`, { 
    method: 'GET' 
  });
};

/**
 * AI tự động tạo Flashcard từ tài liệu trong Project
 */
export const generateAIFlashcards = async (projectId, materialIds, flashcardCount = 10, length = 'short') => {
  return await apiRequest('/ai/generate-flashcards', {
    method: 'POST',
    body: JSON.stringify({ projectId, materialIds, flashcardCount, length })
  });
};
/**
 * Lấy danh sách Flashcard Sets đã lưu
 */
export const getSavedFlashcards = async (projectId) => {
  return await apiRequest(`/ai/projects/${projectId}/flashcards`, {
    method: 'GET'
  });
};

export const deleteSavedFlashcardSet = async (projectId, setId) => {
  return await apiRequest(`/ai/projects/${projectId}/flashcards/${setId}`, {
    method: 'DELETE'
  });
};