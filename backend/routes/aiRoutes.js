const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const { UserRole } = require('../enums/AuthEnums');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Only authenticated Learners may use the AI features
router.use(requireAuth);
router.use(authorize(UserRole.LEARNER));

router.post('/extract-text', upload.single('document'), aiController.uploadAndExtract);
router.post('/generate-quiz', aiController.generateQuiz);
router.post('/generate-flashcards', aiController.generateFlashcards);
router.post('/chat', aiController.chat);

module.exports = router;