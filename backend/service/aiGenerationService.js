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
        throw new AppError(502, 'AI_INVALID_RESPONSE', `The AI returned an unreadable ${context} response. Please try again.`);
    }
}

const generateQuizzes = async (contextText, questionCount = 5, difficulty = 'medium') => {
    const safeCount = Math.min(Math.max(questionCount, MIN_QUESTIONS), MAX_QUESTIONS);

    const prompt = `
        You are an educational expert. Based on the following document content:
        """${contextText}"""

        Generate exactly ${safeCount} multiple-choice questions at a ${difficulty} difficulty level.
        STRICT REQUIREMENTS: 
        - Return ONLY a valid JSON array. No extra text.
        - Use exact format: [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "..."}]
    `;

    const result = await model.generateContent(prompt);
    const textResult = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = parseAIJson(textResult, 'quiz');

    // Deep validation
    const validQuizzes = parsed.filter(item => {
        const q = item.question || item.Question;
        const o = item.options || item.Options;
        const c = item.correctAnswer || item.CorrectAnswer;
        return q && typeof q === 'string' && q.trim() !== '' &&
               Array.isArray(o) && o.length >= 2 && o.every(opt => typeof opt === 'string' && opt.trim() !== '') &&
               c && o.includes(c);
    }).map(item => ({
        question: item.question || item.Question,
        options: item.options || item.Options,
        correctAnswer: item.correctAnswer || item.CorrectAnswer
    }));

    // Incomplete response check
    if (validQuizzes.length !== safeCount) {
        throw new AppError(502, 'AI_INCOMPLETE_RESPONSE', `The AI generated only ${validQuizzes.length} valid questions out of ${safeCount}. Please try again.`);
    }
    return validQuizzes;
};

const generateFlashcards = async (contextText, flashcardCount = 10, length = 'short') => {
    const safeCount = Math.min(Math.max(flashcardCount, MIN_FLASHCARDS), MAX_FLASHCARDS);
    const lengthInstruction = length === 'detailed'
        ? 'Write a detailed 2-3 sentence definition on the back of each card.'
        : 'Keep the back of each card to a single concise sentence.';

    const prompt = `
        Based on the following document content:
        """${contextText}"""

        Create exactly ${safeCount} flashcards containing the most important terms.
        ${lengthInstruction}
        STRICT REQUIREMENTS: 
        - Return ONLY a valid JSON array. No extra text.
        - Use exact format: [{"front": "...", "back": "..."}]
    `;

    const result = await model.generateContent(prompt);
    const textResult = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = parseAIJson(textResult, 'flashcard');

    const validFlashcards = parsed.filter(item => {
        const f = item.front || item.Front;
        const b = item.back || item.Back;
        return f && b && typeof f === 'string' && f.trim() !== '' && typeof b === 'string' && b.trim() !== '';
    }).map(item => ({
        front: item.front || item.Front,
        back: item.back || item.Back
    }));

    // Incomplete response check
    if (validFlashcards.length !== safeCount) {
        throw new AppError(502, 'AI_INCOMPLETE_RESPONSE', `The AI generated only ${validFlashcards.length} valid flashcards out of ${safeCount}. Please try again.`);
    }
    return validFlashcards;
};

const chatWithTutor = async (contextText, chatHistory, userMessage) => {
    // Safe History validation
    const safeHistory = Array.isArray(chatHistory) ? chatHistory.filter(msg => 
        msg && ['user', 'ai'].includes(msg.role) && typeof msg.text === 'string' && msg.text.trim() !== ''
    ) : [];

    let formattedHistory = "";
    if (safeHistory.length > 0) {
        formattedHistory = safeHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'AI Tutor'}: ${msg.text}`).join('\n');
    }

    const prompt = `
        You are the AcogniX AI Study Assistant.
        Answer strictly based on the provided document content.
        DOCUMENT CONTENT: """${contextText}"""
        PREVIOUS CHAT HISTORY: ${formattedHistory}
        STUDENT'S NEW QUESTION: ${userMessage}
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
};

module.exports = { generateQuizzes, generateFlashcards, chatWithTutor };