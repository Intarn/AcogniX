const express = require('express');
const UserManagementController = require('../controllers/UserManagementController');
const CourseController = require('../controllers/CourseController');
const SupportTicketController = require('../controllers/SupportTicketController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.use(authorize('SYSTEM_ADMINISTRATOR'));

// Count APIs (Dashboard)
router.get('/users/count', UserManagementController.getTotalUsers);
router.get('/courses/active-count', CourseController.countActive);

// User Management APIs
router.get('/users', UserManagementController.search);
router.post('/users/:userId/reset-password', UserManagementController.resetPassword);
router.post('/users/:userId/ban', UserManagementController.ban);
router.post('/users/:userId/unban', UserManagementController.unban);
router.post('/users/:userId/role', UserManagementController.assignRole);
router.post('/users/:userId/delete/request', UserManagementController.requestDeletion);
router.post('/users/:userId/delete/confirm', UserManagementController.confirmDeletion);

// Course Management APIs
router.get('/courses', CourseController.getAllForAdmin);
router.get('/courses/:courseId', CourseController.getAdminCourseDetail);
router.post('/courses/:courseId/archive', CourseController.adminArchiveCourse);

// Support Tickets Management (Admin)
router.get('/tickets', SupportTicketController.adminListAll);
router.patch('/tickets/:ticketId/status', SupportTicketController.adminUpdateStatus);
router.get('/tickets/count', SupportTicketController.getTotalTickets);

module.exports = router;