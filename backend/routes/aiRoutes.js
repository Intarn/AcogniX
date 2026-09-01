const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const { UserRole } = require('../enums/AuthEnums');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

// Only authenticated Learners may use the AI features
router.use(requireAuth);
router.use(authorize(UserRole.LEARNER));

// Wrapper to handle Multer errors gracefully before passing to the controller
const handleUpload = (req, res, next) => {
    upload.single('document')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ code: 'FILE_TOO_LARGE', message: 'Document exceeds the 50MB size limit.' });
            }
            return res.status(400).json({ code: 'UPLOAD_ERROR', message: err.message });
        } else if (err) {
            return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unknown upload error occurred.' });
        }
        next();
    });
};

router.post('/extract-text', handleUpload, aiController.uploadAndExtract);
router.post('/generate-quiz', aiController.generateQuiz);
router.post('/generate-flashcards', aiController.generateFlashcards);
router.post('/chat', aiController.chat);

// Data retrieval routes
router.get('/projects/:projectId/quizzes', aiController.getSavedQuizzes);
router.get('/projects/:projectId/flashcards', aiController.getSavedFlashcards);
router.get('/projects/:projectId/conversation', aiController.getConversationHistory);
router.post('/projects/:projectId/quizzes/:quizId/attempts', aiController.recordPracticeQuizAttempt);

// Delete route
router.delete('/projects/:projectId/flashcards/:setId', aiController.deleteSavedFlashcardSet);
router.delete('/projects/:projectId/quizzes/:quizId', aiController.deleteSavedQuiz);

module.exports = router;