const AIServiceClient = require('../service/AIServiceClient');
const AIHistoryService = require('../service/AIHistoryService');
const WorkspaceService = require('../service/WorkspaceService');
const WorkspaceIntegrationService = require('../service/WorkspaceIntegrationService');

const MAX_QUIZ_COUNT = 20;
const MAX_FLASHCARD_COUNT = 30;

function validateGenerationCount(value, fieldName, defaultValue, maxCount) {
    const count = value === undefined || value === null || value === '' ? defaultValue : Number(value);

    if (!Number.isInteger(count) || count < 1 || count > maxCount) {
        const error = new Error(`${fieldName} must be an integer between 1 and ${maxCount}.`);
        error.statusCode = 422;
        error.code = 'INVALID_GENERATION_COUNT';
        throw error;
    }

    return count;
}

function handleControllerError(error, res) {
    const statusCode = Number(error?.statusCode ?? error?.status);
    if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
        return res.status(statusCode).json({ code: error.code, message: error.message });
    }
    console.error(error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' });
}

const uploadAndExtract = async (req, res) => {
    try {
        const { projectId, materialId } = req.body;
        if (!req.file) {
            return res.status(400).json({ code: 'MISSING_FILE', message: 'Please attach a document file.' });
        }
        if (!projectId) {
            return res.status(400).json({ code: 'MISSING_PROJECT_ID', message: 'Missing projectId.' });
        }
        if (!materialId) {
            return res.status(400).json({ code: 'MISSING_MATERIAL_ID', message: 'Missing materialId.' });
        }

        // Verify both Project ownership and that this material belongs to it before
        // forwarding bytes to the Python service.
        await WorkspaceService.assertProjectWritable(projectId, req.user.userId, [materialId]);

        const result = await AIServiceClient.extractDocument(
            materialId,
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );
        return res.status(200).json({ message: 'Text extracted successfully!', data: result });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const generateQuiz = async (req, res) => {
    try {
        const { projectId, materialIds, questionCount, difficulty, idempotencyKey } = req.body;
        if (!projectId) {
            return res.status(400).json({ code: 'MISSING_PROJECT_ID', message: 'Missing projectId.' });
        }
        const safeQuestionCount = validateGenerationCount(questionCount, 'questionCount', 5, MAX_QUIZ_COUNT);
        await WorkspaceService.assertProjectWritable(projectId, req.user.userId, materialIds || []);
        const prepared = await WorkspaceIntegrationService.ensureMaterialsProcessed(projectId, materialIds || []);
        const result = await AIServiceClient.generateQuiz(
            projectId,
            prepared.readyMaterialIds,
            safeQuestionCount,
            difficulty || 'medium',
            idempotencyKey || req.get('X-Idempotency-Key') || null
        );

        const generatedQuestions = Array.isArray(result?.questions) ? result.questions : [];
        if (generatedQuestions.length !== safeQuestionCount) {
            // If the AI service already persisted an incomplete parent record, clean
            // it up instead of reporting a successful but partial Practice Quiz.
            if (result?.quizId) {
                try {
                    await AIHistoryService.deleteQuiz(projectId, result.quizId, req.user.userId);
                } catch (cleanupError) {
                    console.error('[AI] Failed to clean up incomplete Practice Quiz:', cleanupError);
                }
            }
            const countError = new Error('The AI did not generate the configured number of questions.');
            countError.statusCode = 502;
            countError.code = 'AI_GENERATION_COUNT_MISMATCH';
            throw countError;
        }

        return res.status(200).json({ message: 'Quizzes generated!', data: generatedQuestions, quizId: result.quizId });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const generateFlashcards = async (req, res) => {
    try {
        const { projectId, materialIds, flashcardCount, length, idempotencyKey } = req.body;
        if (!projectId) {
            return res.status(400).json({ code: 'MISSING_PROJECT_ID', message: 'Missing projectId.' });
        }
        const safeFlashcardCount = validateGenerationCount(flashcardCount, 'flashcardCount', 10, MAX_FLASHCARD_COUNT);
        await WorkspaceService.assertProjectWritable(projectId, req.user.userId, materialIds || []);
        const prepared = await WorkspaceIntegrationService.ensureMaterialsProcessed(projectId, materialIds || []);
        const result = await AIServiceClient.generateFlashcards(
            projectId,
            prepared.readyMaterialIds,
            safeFlashcardCount,
            length || 'short',
            idempotencyKey || req.get('X-Idempotency-Key') || null
        );

        const generatedFlashcards = Array.isArray(result?.flashcards) ? result.flashcards : [];
        if (generatedFlashcards.length !== safeFlashcardCount) {
            if (result?.flashcardSetId) {
                try {
                    await AIHistoryService.deleteFlashcardSet(projectId, result.flashcardSetId, req.user.userId);
                } catch (cleanupError) {
                    console.error('[AI] Failed to clean up incomplete Flashcard Set:', cleanupError);
                }
            }
            const countError = new Error('The AI did not generate the configured number of flashcards.');
            countError.statusCode = 502;
            countError.code = 'AI_GENERATION_COUNT_MISMATCH';
            throw countError;
        }

        return res.status(200).json({ message: 'Flashcards generated!', data: generatedFlashcards, flashcardSetId: result.flashcardSetId });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const chat = async (req, res) => {
    try {
        const {
            projectId,
            materialIds,
            conversationId,
            userMessage
        } = req.body;

        if (!projectId) {
            return res.status(400).json({
                code: 'MISSING_PROJECT_ID',
                message: 'Missing projectId.'
            });
        }

        if (!userMessage) {
            return res.status(400).json({
                code: 'MISSING_MESSAGE',
                message: 'Missing user message.'
            });
        }

        await WorkspaceService.assertProjectWritable(projectId, req.user.userId, materialIds || []);
        const prepared = await WorkspaceIntegrationService.ensureMaterialsProcessed(projectId, materialIds || []);

        const result = await AIServiceClient.chat(
            projectId,
            prepared.readyMaterialIds,
            conversationId || null,
            userMessage
        );

        return res.status(200).json({
            data: {
                reply: result.reply,
                conversationId: result.conversationId,
                citations: Array.isArray(result.citations) ? result.citations : []
            }
        });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const getSavedQuizzes = async (req, res) => {
    try {
        const { projectId } = req.params;
        const quizzes = await AIHistoryService.getQuizzes(projectId, req.user.userId);
        return res.status(200).json({ data: quizzes });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const getSavedFlashcards = async (req, res) => {
    try {
        const { projectId } = req.params;
        const flashcardSets = await AIHistoryService.getFlashcardSets(projectId, req.user.userId);
        return res.status(200).json({ data: flashcardSets });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const getConversationHistory = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { conversationId } = req.query;
        const result = await AIHistoryService.getConversations(projectId, req.user.userId, conversationId);
        return res.status(200).json({ data: result });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const recordPracticeQuizAttempt = async (req, res) => {
    try {
        const { projectId, quizId } = req.params;
        const result = await AIHistoryService.recordPracticeQuizAttempt(
            projectId,
            quizId,
            req.user.userId,
            req.body || {}
        );
        return res.status(200).json({
            message: 'Practice Quiz result recorded.',
            data: result
        });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const deleteSavedQuiz = async (req, res) => {
  try {
    const { projectId, quizId } = req.params;
    await AIHistoryService.deleteQuiz(projectId, quizId, req.user.userId);
    return res.status(200).json({ message: 'Deleted quiz successfully' });
  } catch (error) {
    return handleControllerError(error, res);
  }
};
const deleteSavedFlashcardSet = async (req, res) => {
    try {
        const { projectId, setId } = req.params;
        await AIHistoryService.deleteFlashcardSet(projectId, setId, req.user.userId);
        return res.status(200).json({ message: 'Deleted flashcard set successfully' });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

module.exports = {
    generateQuiz,
    generateFlashcards,
    chat,
    uploadAndExtract,
    getSavedQuizzes,
    getSavedFlashcards,
    getConversationHistory,
    recordPracticeQuizAttempt,
    deleteSavedFlashcardSet,
    deleteSavedQuiz
};