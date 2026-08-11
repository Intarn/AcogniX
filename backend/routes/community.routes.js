const express = require('express');
const CommunityController = require('../controllers/CommunityController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(requireAuth);

// Learner & Educator
router.get('/posts', authorize('LEARNER', 'EDUCATOR', 'SYSTEM_ADMINISTRATOR'), CommunityController.getPosts);
router.post('/posts', authorize('LEARNER', 'EDUCATOR'), CommunityController.createPost);

// Admin (SYSTEM_ADMINISTRATOR) - Note: Frontend calls have the /admin/community... prefix, handled in app.js mapping
router.get('/reports', authorize('SYSTEM_ADMINISTRATOR'), CommunityController.getReports);
router.post('/reports/:reportId/resolve', authorize('SYSTEM_ADMINISTRATOR'), CommunityController.resolveReport);

module.exports = router;