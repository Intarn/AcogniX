const express = require('express');
const InfrastructureController = require('../controllers/InfrastructureController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(requireAuth);
router.use(authorize('SYSTEM_ADMINISTRATOR'));

// UC-20: Monitor System Infrastructure
router.get('/health', InfrastructureController.getHealth);
router.get('/api-usage', InfrastructureController.getApiUsage);
router.post('/api-keys/update', InfrastructureController.updateKey);

module.exports = router;