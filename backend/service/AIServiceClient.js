const axios = require('axios');
const FormData = require('form-data');
const AppError = require('../error/AppError');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
const AI_SERVICE_INTERNAL_SECRET = process.env.AI_SERVICE_INTERNAL_SECRET;

const client = axios.create({
    baseURL: AI_SERVICE_URL,
    timeout: 70000, // allow retrieval/index work plus ai_service's own 30s chat-generation timeout
    headers: { 'X-Internal-Secret': AI_SERVICE_INTERNAL_SECRET }
});

function normalizeServiceDetail(detail) {
    if (!detail) {
        return { code: 'AI_SERVICE_ERROR', message: 'The AI service returned an error.' };
    }

    if (typeof detail === 'string') {
        return { code: 'AI_SERVICE_ERROR', message: detail };
    }

    if (Array.isArray(detail)) {
        const message = detail
            .map((item) => item?.msg || item?.message || JSON.stringify(item))
            .filter(Boolean)
            .join('; ');
        return { code: 'AI_SERVICE_VALIDATION_ERROR', message: message || 'The AI service rejected the request.' };
    }

    if (typeof detail === 'object') {
        return {
            code: detail.code || 'AI_SERVICE_ERROR',
            message: detail.message || detail.detail || JSON.stringify(detail)
        };
    }

    return { code: 'AI_SERVICE_ERROR', message: String(detail) };
}

function handleServiceError(error) {
    // Python service unreachable (not running, wrong port, network issue)
    if (!error.response) {
        throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'The AI service is currently unavailable. Please try again shortly.');
    }

    const status = Number(error.response.status) || 502;
    const normalized = normalizeServiceDetail(error.response.data?.detail);
    throw new AppError(status, normalized.code, normalized.message);
}

async function extractDocument(materialId, fileBuffer, fileName, mimeType) {
    const form = new FormData();
    form.append('materialId', materialId);
    form.append('file', fileBuffer, { filename: fileName, contentType: mimeType });

    try {
        const response = await client.post('/api/extract', form, { headers: form.getHeaders(), timeout: 180000 });
        return response.data;
    } catch (error) {
        handleServiceError(error);
    }
}

async function generateQuiz(projectId, materialIds, questionCount, difficulty, idempotencyKey = null) {
    try {
        const response = await client.post('/api/generate-quiz', {
            projectId,
            materialIds,
            questionCount,
            difficulty,
            idempotencyKey
        }, { timeout: 180000 });
        return response.data;
    } catch (error) {
        handleServiceError(error);
    }
}

async function generateFlashcards(projectId, materialIds, flashcardCount, length, idempotencyKey = null) {
    try {
        const response = await client.post('/api/generate-flashcards', {
            projectId,
            materialIds,
            flashcardCount,
            length,
            idempotencyKey
        }, { timeout: 180000 });
        return response.data;
    } catch (error) {
        handleServiceError(error);
    }
}


async function activateGeminiKey(apiKey) {
    try {
        const response = await client.post('/internal/config/gemini-key/activate', { apiKey }, { timeout: 90000 });
        return response.data;
    } catch (error) {
        handleServiceError(error);
    }
}

async function chat(projectId, materialIds, conversationId, userMessage) {
    try {
        const response = await client.post('/api/chat', {
            projectId,
            materialIds,
            conversationId,
            userMessage
        }, { timeout: 70000 });

        return response.data;
    } catch (error) {
        handleServiceError(error);
    }
}

module.exports = {
    extractDocument,
    generateQuiz,
    generateFlashcards,
    activateGeminiKey,
    chat
};