// frontend/src/services/aiService.js
import { apiRequest } from './apiClient';

/**
 * Gọi tin nhắn gửi AI Assistant
 */
export const sendAIChatMessage = async (projectId, conversationId, userMessage) => {
  return await apiRequest('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
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
export const generateAIQuiz = async (projectId, questionCount = 5, difficulty = 'medium') => {
  return await apiRequest('/ai/generate-quiz', {
    method: 'POST',
    body: JSON.stringify({ projectId, questionCount, difficulty })
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
export const generateAIFlashcards = async (projectId, flashcardCount = 10, length = 'short') => {
  return await apiRequest('/ai/generate-flashcards', {
    method: 'POST',
    body: JSON.stringify({ projectId, flashcardCount, length })
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