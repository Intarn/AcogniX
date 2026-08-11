const express = require('express');
const AnalyticsController = require('../controllers/AnalyticsController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(requireAuth);

router.post('/ping', authorize('LEARNER'), AnalyticsController.pingSession); // UC-03
router.get('/me', authorize('LEARNER'), AnalyticsController.getPersonalStats); // UC-04
router.get('/courses/:courseId', authorize('EDUCATOR'), AnalyticsController.getClassPerformance); // UC-11

module.exports = router;