const express = require('express');
const InfrastructureController = require('../controllers/InfrastructureController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(requireAuth);
router.use(authorize('SYSTEM_ADMINISTRATOR'));

// UC-20: Monitor System Infrastructure
router.get('/health', InfrastructureController.getHealth);
router.get('/api-usage', InfrastructureController.getApiUsage);
router.get('/analytics', InfrastructureController.getPlatformAnalytics);

// SECURITY NOTE: This endpoint modifies critical system settings (LLM API keys).
// It is strictly protected by the `authorize('SYSTEM_ADMINISTRATOR')` middleware 
// defined at the top of this router file to prevent unauthorized access.
router.post('/api-keys/update', InfrastructureController.updateKey);

module.exports = router;