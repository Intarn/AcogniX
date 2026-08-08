const express = require('express');
const multer = require('multer');
const CourseContentController = require('../controllers/CourseContentController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const { UserRole } = require('../enums/AuthEnums');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Store in RAM before sending to Supabase

// Ensure user is authenticated
router.use(requireAuth);

// UC-05: Manage Course Materials
router.post(
  '/:courseId/materials', 
  authorize(UserRole.EDUCATOR), 
  upload.single('file'), 
  CourseContentController.uploadMaterial
);

router.put(
  '/materials/:materialId', 
  authorize(UserRole.EDUCATOR), 
  upload.single('file'),
  CourseContentController.updateMaterial
);

router.delete(
  '/materials/:materialId', 
  authorize(UserRole.EDUCATOR), 
  CourseContentController.deleteMaterial
);

// UC-17: Post Announcements
router.post(
  '/:courseId/announcements', 
  authorize(UserRole.EDUCATOR), 
  upload.array('attachments', 5), // Allow max 5 attachments
  CourseContentController.postAnnouncement
);

// UC-16: View Materials and Announcements
router.get(
  '/:courseId/materials', 
  authorize(UserRole.LEARNER, UserRole.EDUCATOR), 
  CourseContentController.getMaterials
);

router.get(
  '/:courseId/announcements', 
  authorize(UserRole.LEARNER, UserRole.EDUCATOR), 
  CourseContentController.getAnnouncements
);

module.exports = router;