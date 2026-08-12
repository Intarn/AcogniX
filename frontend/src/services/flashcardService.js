import { apiRequest } from './apiClient';

// ==========================================
// DECK MANAGEMENT (Quản lý các Flashcard Set)
// ==========================================

// 1. Xem danh sách Deck từ Study Repository
export const getDecks = async () => {
  return await apiRequest('/flashcards/decks', { method: 'GET' });
};

// 2. Tạo Deck mới
export const createDeck = async (name, description = '') => {
  return await apiRequest('/flashcards/decks', {
    method: 'POST',
    body: JSON.stringify({ name, description })
  });
};

// 3. Xóa Deck
export const deleteDeck = async (deckId) => {
  return await apiRequest(`/flashcards/decks/${deckId}`, { method: 'DELETE' });
};

// ==========================================
// FLASHCARD (Học & AI Tự động tạo)
// ==========================================

// 1. Lấy danh sách thẻ trong 1 Deck để học/xem
export const getCardsInDeck = async (deckId) => {
  return await apiRequest(`/flashcards/decks/${deckId}/cards`, { method: 'GET' });
};

// 2. AI tự động tạo Flashcard từ Tài liệu (Learning Material)
export const generateFlashcardsByAI = async (deckId, materialId) => {
  return await apiRequest('/flashcards/generate', {
    method: 'POST',
    body: JSON.stringify({ deckId, materialId })
  });
};

// 3. Cập nhật tiến độ học của 1 thẻ (Lưu vào repository)
export const updateCardProgress = async (cardId, status) => {
  return await apiRequest(`/flashcards/cards/${cardId}/progress`, {
    method: 'PUT',
    body: JSON.stringify({ status }) // status: 'new', 'learning', 'reviewing', 'completed'
  });
};