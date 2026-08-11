const AILearningService = require('../service/AILearningService');

function handleControllerError(error, res) {
    if (error.statusCode) {
        return res.status(error.statusCode).json({ code: error.code, message: error.message });
    }
    console.error(error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' });
}

class AILearningController {
    static async getQuizzes(req, res) {
        try {
            const quizzes = await AILearningService.getQuizzes(req.params.projectId, req.user.userId);
            return res.status(200).json({ count: quizzes.length, data: quizzes });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async getFlashcards(req, res) {
        try {
            const flashcards = await AILearningService.getFlashcards(req.params.projectId, req.user.userId);
            return res.status(200).json({ count: flashcards.length, data: flashcards });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async getChatHistory(req, res) {
        try {
            const messages = await AILearningService.getChatHistory(req.params.projectId, req.user.userId);
            return res.status(200).json({ count: messages.length, data: messages });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }
}

module.exports = AILearningController;