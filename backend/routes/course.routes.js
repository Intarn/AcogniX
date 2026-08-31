const express =
  require('express');

const CourseController =
  require(
    '../controllers/CourseController'
  );

const {
  requireAuth,
  authorize
} =
  require(
    '../middleware/authMiddleware'
  );

const {
  UserRole
} =
  require(
    '../enums/AuthEnums'
  );


const router =
  express.Router();


/*
 * UC-05 / Manage Course
 *
 * Only Educator can manage Courses.
 *
 * Authentication and authorization
 * are applied to each route instead
 * of the whole router.
 */
router.get(
  '/',
  requireAuth,
  authorize(
    UserRole.EDUCATOR
  ),
  CourseController.list
);


router.post(
  '/',
  requireAuth,
  authorize(
    UserRole.EDUCATOR
  ),
  CourseController.create
);


router.put(
  '/:courseId',
  requireAuth,
  authorize(
    UserRole.EDUCATOR
  ),
  CourseController.update
);


router.post(
  '/:courseId/archive',
  requireAuth,
  authorize(
    UserRole.EDUCATOR
  ),
  CourseController.archive
);


router.post(
  '/:courseId/unarchive',
  requireAuth,
  authorize(
    UserRole.EDUCATOR
  ),
  CourseController.unarchive
);


module.exports =
  router;