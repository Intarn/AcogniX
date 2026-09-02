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
  '/:assessmentId/questions/:questionId',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.deleteQuestion
);

router.delete(
  '/:assessmentId',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.deleteAssessment
);

router.get(
    '/:assessmentId/instruction-file',
    requireAuth,
    authorize(
        UserRole.EDUCATOR,
        UserRole.LEARNER
    ),
    AssessmentController.getInstructionFile
);

router.get(
    '/:assessmentId',
    requireAuth,
    authorize(
        UserRole.EDUCATOR
    ),
    AssessmentController
        .getAssessmentById
);

router.get(
    '/:assessmentId/questions',
    requireAuth,
    authorize(
        UserRole.EDUCATOR
    ),
    AssessmentController
        .getAssessmentQuestions
);

router.post(
  '/:assessmentId/questions',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.addQuestion
);

router.patch(
  '/:assessmentId/questions/:questionId',
  requireAuth,
  authorize(UserRole.EDUCATOR),
  AssessmentController.updateQuestion
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

router.get(
    '/',
    requireAuth,
    authorize(
        UserRole.LEARNER
    ),
    AssessmentController
        .getLearnerAssessments
);

// UC-10: Learner submits Assessments
router.get(
  '/:assessmentId/open',
  requireAuth,
  authorize(UserRole.LEARNER),
  AssessmentController.getOpenAssessment
);

router.get(
  '/:assessmentId/review',
  requireAuth,
  authorize(UserRole.LEARNER),
  AssessmentController.getLearnerAssessmentReview
);

router.post(
  '/:assessmentId/submissions',
  requireAuth,
  authorize(UserRole.LEARNER),
  AssessmentController.startSubmission
);

router.get(
  '/submissions/:submissionId/answers',
  requireAuth,
  authorize(UserRole.LEARNER),
  AssessmentController.getSubmissionAnswers
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

router.delete(
  '/submissions/:submissionId/files',
  requireAuth,
  authorize(UserRole.LEARNER),
  AssessmentController.deleteSubmissionFile
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

router.get(
    '/:assessmentId/submissions',
    requireAuth,
    authorize(
        UserRole.EDUCATOR
    ),
    AssessmentController
        .getAssessmentSubmissions
);

router.get(
    '/submissions/:submissionId',
    requireAuth,
    authorize(
        UserRole.EDUCATOR
    ),
    AssessmentController
        .getSubmissionById
);

router.get(
    '/courses/:courseId/gradebook',
    requireAuth,
    authorize(
        UserRole.EDUCATOR
    ),
    AssessmentController
        .getCourseGradebook
);

module.exports = router;