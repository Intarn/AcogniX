const express = require('express');
const CourseController = require('../controllers/CourseController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.use(authorize('EDUCATOR'));

router.get('/', CourseController.list);
router.post('/', CourseController.create);
router.put('/:courseId', CourseController.update);
router.post('/:courseId/archive', CourseController.archive);

module.exports = router;