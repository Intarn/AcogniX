const AIServiceClient = require('../service/AIServiceClient');
const AIHistoryService = require('../service/AIHistoryService');

function handleControllerError(error, res) {
    if (error.statusCode) {
        return res.status(error.statusCode).json({ code: error.code, message: error.message });
    }
    console.error(error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' });
}

const uploadAndExtract = async (req, res) => {
    try {
        const { materialId } = req.body;
        if (!req.file) {
            return res.status(400).json({ code: 'MISSING_FILE', message: 'Please attach a document file.' });
        }
        if (!materialId) {
            return res.status(400).json({ code: 'MISSING_MATERIAL_ID', message: 'Missing materialId.' });
        }

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
        const { projectId, questionCount, difficulty } = req.body;
        if (!projectId) {
            return res.status(400).json({ code: 'MISSING_PROJECT_ID', message: 'Missing projectId.' });
        }

        const result = await AIServiceClient.generateQuiz(projectId, questionCount || 5, difficulty || 'medium');
        return res.status(200).json({ message: 'Quizzes generated!', data: result.questions, quizId: result.quizId });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const generateFlashcards = async (req, res) => {
    try {
        const { projectId, materialId, flashcardCount, length } = req.body;
        
        if (!projectId) {
            return res.status(400).json({ code: 'MISSING_PROJECT_ID', message: 'Missing projectId.' });
        }
        if (!materialId) {
            return res.status(400).json({ code: 'MISSING_MATERIAL_ID', message: 'Missing materialId.' });
        }

        const result = await AIServiceClient.generateFlashcards(projectId, materialId, flashcardCount || 10, length || 'short');
        return res.status(200).json({ message: 'Flashcards generated!', data: result.flashcards, flashcardSetId: result.flashcardSetId });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const chat = async (req, res) => {
    try {
        const { projectId, conversationId, userMessage } = req.body;
        if (!projectId) {
            return res.status(400).json({ code: 'MISSING_PROJECT_ID', message: 'Missing projectId.' });
        }
        if (!userMessage) {
            return res.status(400).json({ code: 'MISSING_MESSAGE', message: 'Missing user message.' });
        }

        const result = await AIServiceClient.chat(projectId, conversationId || null, userMessage);
        return res.status(200).json({ data: { reply: result.reply, conversationId: result.conversationId } });
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

module.exports = {
    generateQuiz,
    generateFlashcards,
    chat,
    uploadAndExtract,
    getSavedQuizzes,
    getSavedFlashcards,
    getConversationHistory
};