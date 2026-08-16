const express = require('express');
const InfrastructureController = require('../controllers/InfrastructureController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(requireAuth);
router.use(authorize('SYSTEM_ADMINISTRATOR'));

// UC18: Monitor System Infrastructure
router.get('/health', InfrastructureController.getHealth);
router.get('/api-usage', InfrastructureController.getApiUsage);
router.get('/analytics', InfrastructureController.getPlatformAnalytics);
router.get('/error-logs', InfrastructureController.getErrorLogs);
router.post('/database/restart', InfrastructureController.restartDatabase);

// Critical settings remain protected by System Administrator authorization above.
router.post('/api-keys/update', InfrastructureController.updateKey);

// Controlled test preparation endpoints. Service layer blocks these in production.
router.post('/test/simulate-db-failure', InfrastructureController.simulateDatabaseFailure);
router.post('/test/simulate-quota', InfrastructureController.simulateQuotaExceeded);

module.exports = router;
