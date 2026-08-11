const express = require('express');
const AnalyticsController = require('../controllers/AnalyticsController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(requireAuth);

// UC-03: Log study session
router.post('/sessions', authorize('LEARNER'), AnalyticsController.logSession);

// UC-04: Personal statistics
router.get('/me', authorize('LEARNER'), AnalyticsController.getPersonalStats);

// UC-11: Class performance statistics (for Educator)
router.get('/courses/:courseId', authorize('EDUCATOR'), AnalyticsController.getClassPerformance);

module.exports = router;