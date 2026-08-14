const axios = require('axios');
const FormData = require('form-data');
const AppError = require('../error/AppError');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
const AI_SERVICE_INTERNAL_SECRET = process.env.AI_SERVICE_INTERNAL_SECRET;

const client = axios.create({
    baseURL: AI_SERVICE_URL,
    timeout: 45000, // slightly above ai_service's own 30s chat timeout
    headers: { 'X-Internal-Secret': AI_SERVICE_INTERNAL_SECRET }
});

function handleServiceError(error) {
    // Python service unreachable (not running, wrong port, network issue)
    if (!error.response) {
        throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'The AI service is currently unavailable. Please try again shortly.');
    }
    // Python service responded with an error (400/422/502/504/etc.) — forward its detail
    const status = error.response.status;
    const detail = error.response.data && error.response.data.detail;
    throw new AppError(status, 'AI_SERVICE_ERROR', detail || 'The AI service returned an error.');
}

async function extractDocument(materialId, fileBuffer, fileName, mimeType) {
    const form = new FormData();
    form.append('materialId', materialId);
    form.append('file', fileBuffer, { filename: fileName, contentType: mimeType });

    try {
        const response = await client.post('/api/extract', form, { headers: form.getHeaders() });
        return response.data;
    } catch (error) {
        handleServiceError(error);
    }
}

async function generateQuiz(projectId, materialIds, questionCount, difficulty) {
    try {
        const response = await client.post('/api/generate-quiz', { projectId, materialIds, questionCount, difficulty });
        return response.data;
    } catch (error) {
        handleServiceError(error);
    }
}

async function generateFlashcards(projectId, materialIds, flashcardCount, length) {
    try {
        const response = await client.post('/api/generate-flashcards', { projectId, materialIds, flashcardCount, length });
        return response.data;
    } catch (error) {
        handleServiceError(error);
    }
}

async function chat(projectId, conversationId, userMessage) {
    try {
        const response = await client.post('/api/chat', { projectId, conversationId, userMessage });
        return response.data;
    } catch (error) {
        handleServiceError(error);
    }
}

module.exports = {
    extractDocument,
    generateQuiz,
    generateFlashcards,
    chat
};