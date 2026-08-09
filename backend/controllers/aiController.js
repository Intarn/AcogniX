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

const generateQuiz = async (req, res) => {
    try {
        const { contextText, questionCount, difficulty, projectId } = req.body;
        
        if (typeof contextText !== 'string' || !contextText.trim()) {
            return res.status(400).json({ code: 'MISSING_CONTEXT', message: "Missing valid document context." });
        }

        // Ensure accurate question counting (accepts 0 and negative numbers so the Service can clamp them)
        const parsedQCount = Number(questionCount);
        const safeCount = Number.isFinite(parsedQCount) ? Math.trunc(parsedQCount) : 5;
        
        const normalizedDifficulty = String(difficulty || 'medium').trim().toLowerCase();

        if (!['easy', 'medium', 'hard'].includes(normalizedDifficulty)) {
            return res.status(400).json({ code: 'INVALID_DIFFICULTY', message: 'Difficulty must be easy, medium, or hard.' });
        }

        if (projectId) {
            await AIPersistenceService._assertProjectOwnedBy(projectId, req.user.userId);
        }

        const quizzes = await aiGenerationService.generateQuizzes(contextText, safeCount, normalizedDifficulty);

        let saved = null;
        if (projectId) {
            saved = await AIPersistenceService.saveQuiz(projectId, req.user.userId, normalizedDifficulty, quizzes);
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
        
        if (typeof contextText !== 'string' || !contextText.trim()) {
            return res.status(400).json({ code: 'MISSING_CONTEXT', message: "Missing valid document context." });
        }

        // Ensure accurate flashcard counting (accepts 0 and negative numbers so the Service can clamp them)
        const parsedFCount = Number(flashcardCount);
        const safeCount = Number.isFinite(parsedFCount) ? Math.trunc(parsedFCount) : 10;
        
        const normalizedLength = String(length || 'short').trim().toLowerCase();

        if (!['short', 'detailed'].includes(normalizedLength)) {
            return res.status(400).json({ code: 'INVALID_LENGTH', message: 'Length must be short or detailed.' });
        }

        if (projectId) {
            await AIPersistenceService._assertProjectOwnedBy(projectId, req.user.userId);
        }

        const flashcards = await aiGenerationService.generateFlashcards(contextText, safeCount, normalizedLength);

        let saved = null;
        if (projectId) {
            saved = await AIPersistenceService.saveFlashcards(projectId, req.user.userId, normalizedLength, flashcards);
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
        
        if (typeof contextText !== 'string' || !contextText.trim()) {
            return res.status(400).json({ code: 'MISSING_CONTEXT', message: "Active context is required to use the AI Tutor." });
        }
        if (typeof userMessage !== 'string' || !userMessage.trim()) {
            return res.status(400).json({ code: 'MISSING_MESSAGE', message: "Missing valid user message." });
        }

        // Verify project ownership BEFORE calling Gemini to save API costs
        if (projectId) {
            await AIPersistenceService._assertProjectOwnedBy(projectId, req.user.userId);
        }

        const responseText = await aiGenerationService.chatWithTutor(contextText, chatHistory, userMessage);

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

// --- NEW GETTER FUNCTIONS FOR DATA RETRIEVAL ---

const getSavedQuizzes = async (req, res) => {
    try {
        const { projectId } = req.params;
        await AIPersistenceService._assertProjectOwnedBy(projectId, req.user.userId);
        
        // Cần import supabase ở đầu file: const supabase = require('../config/supabaseClient');
        const { data, error } = await require('../config/supabaseClient').from('Quiz').select('*').eq('projectId', projectId);
        if (error) throw error;
        
        return res.status(200).json({ data });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const getSavedFlashcards = async (req, res) => {
    try {
        const { projectId } = req.params;
        await AIPersistenceService._assertProjectOwnedBy(projectId, req.user.userId);
        
        const { data, error } = await require('../config/supabaseClient').from('Flashcard').select('*').eq('projectId', projectId);
        if (error) throw error;
        
        return res.status(200).json({ data });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

const getConversationHistory = async (req, res) => {
    try {
        const { projectId } = req.params;
        await AIPersistenceService._assertProjectOwnedBy(projectId, req.user.userId);
        
        const { data, error } = await require('../config/supabaseClient').from('Conversation').select('*').eq('projectId', projectId).maybeSingle();
        if (error) throw error;
        
        return res.status(200).json({ data: data ? data.messages : [] });
    } catch (error) {
        return handleControllerError(error, res);
    }
};

// Export ALL functions
module.exports = { 
    generateQuiz, 
    generateFlashcards, 
    chat, 
    uploadAndExtract,
    getSavedQuizzes, 
    getSavedFlashcards, 
    getConversationHistory 
};