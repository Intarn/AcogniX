/*
 * Temporary integration boundary.
 * Replace these methods when the real notification module is available.
 */
class NotificationService {
  static async notifyEnrollmentRequested({ educatorId, learnerId, courseId }) {
    console.log('[TODO Notification] Enrollment request', {
      educatorId,
      learnerId,
      courseId
    });

    return {
      sent: false,
      reason: 'NOTIFICATION_SERVICE_NOT_IMPLEMENTED'
    };
  }

  static async notifyEnrollmentDecision({ learnerId, courseId, status }) {
    console.log('[TODO Notification] Enrollment decision', {
      learnerId,
      courseId,
      status
    });

    return {
      sent: false,
      reason: 'NOTIFICATION_SERVICE_NOT_IMPLEMENTED'
    };
  }
  // Add this method inside the existing NotificationService class.
  static async notifyAssessmentChanged({
    learnerIds,
    courseId,
    assessmentId,
    action
  }) {
    console.log('[TODO Notification] Assessment change', {
      learnerIds,
      courseId,
      assessmentId,
      action
    });

    return {
      sent: false,
      reason: 'NOTIFICATION_SERVICE_NOT_IMPLEMENTED'
    };
  }
}

module.exports = NotificationService;
