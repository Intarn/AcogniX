const express = require('express');
const AILearningController = require('../controllers/AILearningController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const { UserRole } = require('../enums/AuthEnums');
const router = express.Router();

router.use(requireAuth);
router.use(authorize(UserRole.LEARNER));

router.get('/projects/:projectId/quizzes', AILearningController.getQuizzes);
router.get('/projects/:projectId/flashcards', AILearningController.getFlashcards);
router.get('/projects/:projectId/chat-history', AILearningController.getChatHistory);

module.exports = router;