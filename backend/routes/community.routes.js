// backend/routes/community.routes.js
const express = require('express');
const multer = require('multer');
const CommunityController = require('../controllers/CommunityController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

router.get('/posts', CommunityController.getFeed);
router.post('/posts', upload.single('attachment'), CommunityController.createPost);
router.put('/posts/:postId/reactions', CommunityController.reactToPost);
router.post('/posts/:postId/comments', CommunityController.commentOnPost);

module.exports = router;