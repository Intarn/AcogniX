const express = require('express');
const CourseController = require('../controllers/CourseController');
const requireAuth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.use(requireAuth, requireRole('EDUCATOR'));

router.get('/', CourseController.list);
router.post('/', CourseController.create);
router.put('/:courseId', CourseController.update);
router.post('/:courseId/archive', CourseController.archive);

module.exports = router;