const express = require('express');
const AnalyticsController = require('../controllers/AnalyticsController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const scheduleWeeklyReports = require('../cron/weeklyReport');
const router = express.Router();

// Register the production weekly scheduler when the analytics routes are mounted.
// In non-production environments the scheduler stays disabled and UI04 can use
// the authorized simulation endpoint below.
scheduleWeeklyReports();

router.use(requireAuth);

router.post('/ping', authorize('LEARNER'), AnalyticsController.pingSession); // UC-03
router.post('/flashcard-review', authorize('LEARNER'), AnalyticsController.recordFlashcardReview); // UC-04 metric
router.get('/me', authorize('LEARNER'), AnalyticsController.getPersonalStats); // UC-04
router.get('/notifications', authorize('EDUCATOR'), AnalyticsController.getEducatorNotifications); // UC-11 weekly report notifications
router.patch('/notifications/:notificationId/read', authorize('EDUCATOR'), AnalyticsController.markEducatorNotificationRead); // UC-11
router.post('/courses/:courseId/weekly-report/generate', authorize('EDUCATOR'), AnalyticsController.generateWeeklyClassPerformance); // UC-11 scheduler simulation
router.get('/courses/:courseId/weekly-report', authorize('EDUCATOR'), AnalyticsController.getWeeklyClassPerformance); // UC-11
router.get('/courses/:courseId', authorize('EDUCATOR'), AnalyticsController.getClassPerformance); // UC-11

module.exports = router;