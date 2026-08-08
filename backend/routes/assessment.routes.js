const express = require('express');
const multer = require('multer');

const AssessmentController = require('../controllers/AssessmentController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const { UserRole } = require('../enums/AuthEnums');
const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage()
});

// UC-09: Educator manages Assessments
router.get(
    '/courses/:courseId', 
    requireAuth, 
    authorize(UserRole.EDUCATOR), 
    AssessmentController.getManagedAssessments
);

router.post(
  '/courses/:courseId',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.createAssessment
);

router.patch(
  '/:assessmentId',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.updateAssessment
);

router.delete(
  '/:assessmentId',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.deleteAssessment
);

router.post(
  '/:assessmentId/questions',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.addQuestion
);

router.patch(
  '/:assessmentId/schedule',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.scheduleAssessment
);

router.post(
  '/:assessmentId/publish',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.publishAssessment
);

router.post(
  '/:assessmentId/instruction-file',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  upload.single('instructionFile'),
  AssessmentController.uploadInstructionFile
);

// UC-10: Learner submits Assessments
router.get(
  '/:assessmentId/open',
  requireAuth,
  authorize(UserRole.LEARNER),
  AssessmentController.getOpenAssessment
);

router.post(
  '/:assessmentId/submissions',
  requireAuth,
  authorize(UserRole.LEARNER),
  AssessmentController.startSubmission
);

router.put(
  '/submissions/:submissionId/answers/:questionId',
  requireAuth,
  authorize(UserRole.LEARNER),
  AssessmentController.saveAnswer
);

router.post(
  '/submissions/:submissionId/files',
  requireAuth,
  authorize(UserRole.LEARNER),
  upload.array('files', 10),
  AssessmentController.uploadSubmissionFiles
);

router.post(
  '/submissions/:submissionId/submit',
  requireAuth,
  authorize(UserRole.LEARNER),
  AssessmentController.submitSubmission
);

router.patch(
  '/submissions/:submissionId/grade',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.gradeSubmission
);

module.exports = router;