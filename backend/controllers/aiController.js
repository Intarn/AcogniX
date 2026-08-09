const aiGenerationService = require('../service/aiGenerationService');
const documentExtractionService = require('../service/documentExtractionService');
const AIPersistenceService = require('../service/aiPersistenceService');

function handleControllerError(error, res) {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            code: error.code,
            message: error.message
        });
    }

    console.error(error);

    return res.status(500).json({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred.'
    });
}

// projectId is optional: pass it to persist the result into the Learner's
// AI Workspace project. Omit it to just generate without saving.
const generateQuiz = async (req, res) => {
    try {
        const { contextText, questionCount, difficulty, projectId } = req.body;
        if (!contextText) {
            return res.status(400).json({ code: 'MISSING_CONTEXT', message: "Missing document context." });
        }

        const quizzes = await aiGenerationService.generateQuizzes(contextText, questionCount || 5, difficulty);

        let saved = null;
        if (projectId) {
            saved = await AIPersistenceService.saveQuiz(projectId, req.user.userId, difficulty || 'medium', quizzes);
        }

        return res.status(200).json({
            message: "Quizzes generated!",
            data: quizzes,
            quizId: saved ? saved.quizId : null
        });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const generateFlashcards = async (req, res) => {
    try {
        const { contextText, flashcardCount, length, projectId } = req.body;
        if (!contextText) {
            return res.status(400).json({ code: 'MISSING_CONTEXT', message: "Missing document context." });
        }

        const flashcards = await aiGenerationService.generateFlashcards(contextText, flashcardCount || 10, length);

        let saved = null;
        if (projectId) {
            saved = await AIPersistenceService.saveFlashcards(projectId, req.user.userId, length || 'short', flashcards);
        }

        return res.status(200).json({
            message: "Flashcards generated!",
            data: flashcards,
            flashcardSetId: saved ? saved.flashcardSetId : null
        });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const chat = async (req, res) => {
    try {
        const { contextText, chatHistory, userMessage, projectId } = req.body;
        if (!userMessage) {
            return res.status(400).json({ code: 'MISSING_MESSAGE', message: "Missing user message." });
        }

        const responseText = await aiGenerationService.chatWithTutor(contextText || "", chatHistory || [], userMessage);

        if (projectId) {
            await AIPersistenceService.appendConversationMessages(projectId, req.user.userId, [
                { role: 'user', text: userMessage, at: new Date().toISOString() },
                { role: 'ai', text: responseText, at: new Date().toISOString() }
            ]);
        }

        return res.status(200).json({ data: { reply: responseText } });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const uploadAndExtract = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ code: 'MISSING_FILE', message: "Please attach a document file." });
        }

        const { mimetype, buffer } = req.file;
        let extractedText = "";

        if (mimetype === 'application/pdf') {
            extractedText = await documentExtractionService.extractTextFromPDF(buffer);
        } else if (['image/jpeg', 'image/png', 'image/webp'].includes(mimetype)) {
            extractedText = await documentExtractionService.extractTextFromImage(buffer);
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            extractedText = await documentExtractionService.extractTextFromDocx(buffer);
        } else {
            return res.status(400).json({
                code: 'UNSUPPORTED_FILE_TYPE',
                message: "Unsupported file type. Supported formats: PDF, DOCX, JPG, PNG, WEBP."
            });
        }

        if (!extractedText || !extractedText.trim()) {
            return res.status(422).json({
                code: 'NO_READABLE_TEXT',
                message: "No readable text was found in this file."
            });
        }

        return res.status(200).json({
            message: "Text extracted successfully!",
            data: { contextText: extractedText }
        });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

module.exports = {
    generateQuiz,
    generateFlashcards,
    chat,
    uploadAndExtract
};