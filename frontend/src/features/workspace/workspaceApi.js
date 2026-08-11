import {
  apiRequest
} from '../../services/apiClient';


// ======================================================
// UC-02: INTERACT WITH AI TUTOR
// ======================================================

export function sendTutorMessage(
  projectId,
  conversationId,
  userMessage
) {
  return apiRequest(
    '/ai/chat',
    {
      method: 'POST',

      body: JSON.stringify({
        projectId,
        conversationId:
          conversationId || null,
        userMessage
      })
    }
  );
}


export function getConversationHistory(
  projectId,
  conversationId = null
) {
  const query =
    conversationId
      ? `?conversationId=${encodeURIComponent(
          conversationId
        )}`
      : '';

  return apiRequest(
    `/ai/projects/${projectId}/conversation${query}`
  );
}


// ======================================================
// UC-06: GENERATE PRACTICE QUIZZES
// ======================================================

export function generatePracticeQuiz(
  projectId,
  {
    questionCount = 5,
    difficulty = 'medium'
  } = {}
) {
  return apiRequest(
    '/ai/generate-quiz',
    {
      method: 'POST',

      body: JSON.stringify({
        projectId,
        questionCount,
        difficulty
      })
    }
  );
}


export function getSavedPracticeQuizzes(
  projectId
) {
  return apiRequest(
    `/ai/projects/${projectId}/quizzes`
  );
}


// ======================================================
// UC-07: GENERATE FLASHCARDS
// ======================================================

export function generateProjectFlashcards(
  projectId,
  {
    flashcardCount = 10,
    length = 'short'
  } = {}
) {
  return apiRequest(
    '/ai/generate-flashcards',
    {
      method: 'POST',

      body: JSON.stringify({
        projectId,
        flashcardCount,
        length
      })
    }
  );
}


export function getSavedFlashcardSets(
  projectId
) {
  return apiRequest(
    `/ai/projects/${projectId}/flashcards`
  );
}


// ======================================================
// UC-08: EXTRACT TEXT AND IMAGES
// Internal API — no standalone UI required.
// ======================================================

export function extractMaterialText(
  materialId,
  file
) {
  const formData =
    new FormData();

  formData.append(
    'materialId',
    materialId
  );

  formData.append(
    'document',
    file
  );

  return apiRequest(
    '/ai/extract-text',
    {
      method: 'POST',
      body: formData
    }
  );
}