const express = require('express');
const EnrollmentController = require('../controllers/EnrollmentController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const { UserRole } = require('../enums/AuthEnums');

const router = express.Router();

// UC-15: chỉ Learner được gửi yêu cầu tham gia lớp
router.post(
  '/',
  requireAuth,
  authorize(UserRole.LEARNER),
  EnrollmentController.joinClass
);

router.get(
  '/',
  requireAuth,
  authorize(
    UserRole.LEARNER
  ),
  EnrollmentController
    .getMyCourses
);

// UC-14: chỉ Educator được xem thành viên 
router.get(
  '/courses/:courseId/members',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  EnrollmentController.getCourseMembers
);

// UC-14: chỉ Educator được approve
router.patch(
  '/:enrollmentId/approve',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  EnrollmentController.approveEnrollment
);

// UC-14: chỉ Educator được reject
router.patch(
  '/:enrollmentId/reject',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  EnrollmentController.rejectEnrollment
);

// UC-14: chỉ Educator được remove
router.patch(
  '/:enrollmentId/remove',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  EnrollmentController.removeMember
);

module.exports = router;