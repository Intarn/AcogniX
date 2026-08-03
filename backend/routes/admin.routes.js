const express = require('express');
const UserManagementController = require('../controllers/UserManagementController');
const requireAuth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.use(requireAuth, requireRole('SYSTEM_ADMINISTRATOR'));

router.get('/users', UserManagementController.search);
router.post('/users/:userId/reset-password', UserManagementController.resetPassword);
router.post('/users/:userId/ban', UserManagementController.ban);
router.post('/users/:userId/unban', UserManagementController.unban);
router.post('/users/:userId/role', UserManagementController.assignRole);
router.post('/users/:userId/delete/request', UserManagementController.requestDeletion);
router.post('/users/:userId/delete/confirm', UserManagementController.confirmDeletion);

module.exports = router;