const EnrollmentService = require('../service/EnrollmentService');

function handleControllerError(error, res) {
  if (error.statusCode) {
    const response = {
      code: error.code,
      message: error.message
    };

    if (error.details) response.details = error.details;
    return res.status(error.statusCode).json(response);
  }

  console.error(error);
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected server error occurred.'
  });
}

class EnrollmentController {
  static async joinClass(req, res) {
    try {
      const { enrollmentCode } = req.body;
      const result = await EnrollmentService.requestEnrollment(
        req.user.userId,
        enrollmentCode
      );

      return res.status(201).json({
        message: 'Your enrollment request has been submitted and is awaiting approval.',
        enrollment: {
          enrollmentId:
            result.enrollment.enrollmentId,

          status:
            result.enrollment.status,

          requestedAt:
            result.enrollment.requestedAt
        },

        course: {
          subjectName:
            result.course.subjectName,

          courseCode:
            result.course.courseCode
        }
      });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async getCourseMembers(req, res) {
    try {
      const members = await EnrollmentService.getCourseMembers(
        req.params.courseId,
        req.user.userId,
        req.query.status
      );

      return res.status(200).json({
        courseId: req.params.courseId,
        count: members.length,
        members
      });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async approveEnrollment(req, res) {
    try {
      const result = await EnrollmentService.approveEnrollment(
        req.params.enrollmentId,
        req.user.userId
      );

      return res.status(200).json({
        message: result.workspace?.provisioned === false
          ? 'Enrollment approved, but the AI Workspace integration is not complete.'
          : 'Enrollment approved successfully.',
        enrollment: {
          enrollmentId: result.enrollment.enrollmentId, 
          status: result.enrollment.status,
          approvedAt: result.enrollment.approvedAt
        }
      });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async rejectEnrollment(req, res) {
    try {
      const { enrollment, notification} = await EnrollmentService.rejectEnrollment(
        req.params.enrollmentId,
        req.user.userId
      );

      return res.status(200).json({
        message: 'Enrollment request rejected.',
        enrollment: {
          enrollmentId: enrollment.enrollmentId,
          status: enrollment.status,
          rejectedAt: enrollment.rejectedAt
        }
      });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async removeMember(req, res) {
    try {
      const result = await EnrollmentService.removeMember(
        req.params.enrollmentId,
        req.user.userId
      );

      return res.status(200).json({
        message: result.workspace?.revoked === false
          ? 'Member removed, but the AI Workspace access integration is not complete.'
          : 'Member removed successfully.',
        enrollment: {
        enrollmentId:
          result.enrollment.enrollmentId,

        status:
          result.enrollment.status,

        removedAt:
          result.enrollment.removedAt
      }
      });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
  static async getMyCourses(
    req,
    res
  ) {
    try {
      const courses =
        await EnrollmentService
          .getMyCourses(
            req.user.userId
          );

      return res
        .status(200)
        .json({
          count:
            courses.length,

          courses
        });
    } catch (error) {
      return handleControllerError(
        error,
        res
      );
    }
  }
  
}

module.exports = EnrollmentController;