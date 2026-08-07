const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');

// Configure multer to store files in memory (buffer) instead of the hard drive
const upload = multer({ storage: multer.memoryStorage() });

// Accepts a file upload from the form field named 'document'
router.post('/extract-text', upload.single('document'), aiController.uploadAndExtract);
router.post('/generate-quiz', aiController.generateQuiz);
router.post('/generate-flashcards', aiController.generateFlashcards);
router.post('/chat', aiController.chat);

module.exports = router;