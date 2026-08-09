const { GoogleGenerativeAI } = require("@google/generative-ai");
const AppError = require('../error/AppError');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

const MAX_QUESTIONS = 20;
const MIN_QUESTIONS = 1;
const MAX_FLASHCARDS = 30;
const MIN_FLASHCARDS = 1;

function parseAIJson(textResult, context) {
    try {
        const parsed = JSON.parse(textResult);
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
        return parsed;
    } catch (parseError) {
        console.error(`AI returned invalid JSON for ${context}:`, textResult);
        throw new AppError(502, 'AI_INVALID_RESPONSE', `The AI returned an unreadable ${context} response. Please try again.`);
    }
}

const generateQuizzes = async (contextText, questionCount = 5, difficulty = 'medium') => {
    const safeCount = Math.min(Math.max(Number(questionCount) || 5, MIN_QUESTIONS), MAX_QUESTIONS);
    const safeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';

    const prompt = `
        You are an educational expert. Based on the following document content:
        """${contextText}"""

        Generate ${safeCount} multiple-choice questions at a ${safeDifficulty} difficulty level.
        STRICT REQUIREMENTS: 
        - Return ONLY a valid JSON array.
        - Do not include any additional explanatory text or markdown formatting (like \`\`\`json).
        - Use this exact format: [{"question": "question text", "options": ["A", "B", "C", "D"], "correctAnswer": "the correct option"}]
    `;

    const result = await model.generateContent(prompt);
    const textResult = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = parseAIJson(textResult, 'quiz');

    return parsed.map(item => ({
        question: item.question || item.Question || "",
        options: item.options || item.Options || [],
        correctAnswer: item.correctAnswer || item.CorrectAnswer || ""
    }));
};

const generateFlashcards = async (contextText, flashcardCount = 10, length = 'short') => {
    const safeCount = Math.min(Math.max(Number(flashcardCount) || 10, MIN_FLASHCARDS), MAX_FLASHCARDS);
    const safeLength = ['short', 'detailed'].includes(length) ? length : 'short';
    const lengthInstruction = safeLength === 'detailed'
        ? 'Write a detailed 2-3 sentence definition on the back of each card.'
        : 'Keep the back of each card to a single concise sentence.';

    const prompt = `
        Based on the following document content:
        """${contextText}"""

        Create ${safeCount} flashcards containing the most important terms and definitions.
        ${lengthInstruction}
        STRICT REQUIREMENTS: 
        - Return ONLY a valid JSON array.
        - Do not include any markdown formatting.
        - Use this exact format: [{"front": "term or concept", "back": "detailed definition or explanation"}]
    `;

    const result = await model.generateContent(prompt);
    const textResult = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = parseAIJson(textResult, 'flashcard');

    return parsed.map(item => ({
        front: item.front || item.Front || "",
        back: item.back || item.Back || ""
    }));
};

const chatWithTutor = async (contextText, chatHistory, userMessage) => {
    let formattedHistory = "";
    if (chatHistory && chatHistory.length > 0) {
        formattedHistory = chatHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'AI Tutor'}: ${msg.text}`).join('\n');
    }

    const prompt = `
        You are the AcogniX AI Study Assistant. You are a helpful, encouraging, and accurate tutor.
        Answer the student's question based strictly on the provided document content. If the answer is not in the document, kindly inform them.

        DOCUMENT CONTENT:
        """${contextText}"""

        PREVIOUS CHAT HISTORY:
        ${formattedHistory}

        STUDENT'S NEW QUESTION: ${userMessage}
        
        AI TUTOR RESPONSE:
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
};

module.exports = {
    generateQuizzes,
    generateFlashcards,
    chatWithTutor
};