const aiGenerationService = require('../service/aiGenerationService');
const documentExtractionService = require('../service/documentExtractionService');

const generateQuiz = async (req, res) => {
    try {
        const { contextText, questionCount } = req.body;
        if (!contextText) return res.status(400).json({ success: false, message: "Missing document context." });

        const quizzes = await aiGenerationService.generateQuizzes(contextText, questionCount || 5);
        return res.status(200).json({ success: true, message: "Quizzes generated!", data: quizzes });
    } catch (error) {
        console.error("Quiz Error:", error);
        return res.status(500).json({ success: false, message: "Failed to generate quizzes." });
    }
};

const generateFlashcards = async (req, res) => {
    try {
        const { contextText, flashcardCount } = req.body;
        if (!contextText) return res.status(400).json({ success: false, message: "Missing document context." });

        const flashcards = await aiGenerationService.generateFlashcards(contextText, flashcardCount || 10);
        return res.status(200).json({ success: true, message: "Flashcards generated!", data: flashcards });
    } catch (error) {
        console.error("Flashcard Error:", error);
        return res.status(500).json({ success: false, message: "Failed to generate flashcards." });
    }
};

const chat = async (req, res) => {
    try {
        // chatHistory should be an array of objects: [{ role: 'user', text: '...' }, { role: 'ai', text: '...' }]
        const { contextText, chatHistory, userMessage } = req.body;
        
        if (!userMessage) return res.status(400).json({ success: false, message: "Missing user message." });

        const responseText = await aiGenerationService.chatWithTutor(contextText || "", chatHistory || [], userMessage);
        return res.status(200).json({ success: true, data: { reply: responseText } });
    } catch (error) {
        console.error("Chat Error:", error);
        return res.status(500).json({ success: false, message: "AI Tutor is currently unavailable." });
    }
};

const uploadAndExtract = async (req, res) => {
    try {
        // req.file is populated by multer when a file is uploaded
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: "Please attach a document file." 
            });
        }

        let extractedText = "";

        // Check file type (currently supporting PDF)
        if (req.file.mimetype === 'application/pdf') {
            extractedText = await documentExtractionService.extractTextFromPDF(req.file.buffer);
        } else {
            return res.status(400).json({ 
                success: false, 
                message: "The system currently only supports PDF files." 
            });
        }

        return res.status(200).json({
            success: true,
            message: "Text extracted successfully!",
            data: { contextText: extractedText }
        });

    } catch (error) {
        console.error("Extraction Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error during document extraction." 
        });
    }
};

module.exports = {
    generateQuiz,
    generateFlashcards,
    chat,
    uploadAndExtract 
};