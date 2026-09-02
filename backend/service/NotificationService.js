const supabase = require('../config/supabaseClient');
const EmailService = require('./EmailService');
const AppError = require('../error/AppError');


class NotificationService {
  // Notification failure should not rollback
  // the main business operation.
  static async _safeSend(sendOperation) {
    try {
      const result = await sendOperation();

      if (
        result &&
        typeof result === 'object'
      ) {
        return result;
      }

      return {
        sent: true
      };

    } catch (error) {
      console.error(
        'Notification delivery failed:',
        error
      );

      return {
        sent: false,
        reason: 'EMAIL_DELIVERY_FAILED'
      };
    }
  }


  // Find one User
  static async _findUser(userId) {
    const { data, error } = await supabase
      .from('User')
      .select(
        'userId, email, displayName, role'
      )
      .eq('userId', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }


  // Find one Course
  static async _findCourse(courseId) {
    const { data, error } = await supabase
      .from('Course')
      .select(
        'courseId, subjectName, courseCode, educatorId'
      )
      .eq('courseId', courseId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }


  // Get email addresses from a list of User IDs
  static async _getUserEmails(userIds) {
    if (
      !userIds ||
      userIds.length === 0
    ) {
      return [];
    }

    const uniqueUserIds =
      [...new Set(userIds)];

    const { data: users, error } = await supabase
      .from('User')
      .select('userId, email')
      .in('userId', uniqueUserIds);

    if (error) {
      throw error;
    }

    return (users || [])
      .map(user => user.email)
      .filter(Boolean);
  }


  // Find all APPROVED Learners of a Course
  // and return their email addresses
  static async _getApprovedLearnerEmails(courseId) {
    const {
      data: enrollments,
      error: enrollmentError
    } = await supabase
      .from('Enrollment')
      .select('learnerId')
      .eq('courseId', courseId)
      .eq('status', 'APPROVED');

    if (enrollmentError) {
      throw enrollmentError;
    }

    if (
      !enrollments ||
      enrollments.length === 0
    ) {
      return [];
    }

    const learnerIds =
      enrollments.map(
        enrollment =>
          enrollment.learnerId
      );

    return this._getUserEmails(
      learnerIds
    );
  }


  // Common helper for notifications sent to
  // all approved Learners in one Course
  static async _notifyApprovedCourseLearners({
    courseId,
    subject,
    html
  }) {
    const emails =
      await this._getApprovedLearnerEmails(
        courseId
      );

    if (emails.length === 0) {
      return {
        sent: false,
        recipients: 0,
        reason: 'NO_RECIPIENTS'
      };
    }

    await EmailService.sendBulk(
      emails,
      subject,
      html
    );

    return {
      sent: true,
      recipients: emails.length
    };
  }

  // UC-15: ENROLL IN CLASS
  // Learner sends enrollment request

  static async notifyEnrollmentRequested({
    educatorId,
    learnerId,
    courseId
  }) {
    return this._safeSend(async () => {

      const educator =
        await this._findUser(
          educatorId
        );

      const learner =
        await this._findUser(
          learnerId
        );

      const course =
        await this._findCourse(
          courseId
        );

      if (!educator?.email) {
        return {
          sent: false,
          reason: 'RECIPIENT_NOT_FOUND'
        };
      }

      const learnerName =
        learner?.displayName ||
        learner?.email ||
        'A Learner';

      const courseName =
        course?.subjectName ||
        'your Course';

      await EmailService.send(
        educator.email,

        `AcogniX - New Enrollment Request - ${courseName}`,

        `
          <div style="font-family: Arial, sans-serif;">

            <h2>
              New Enrollment Request
            </h2>

            <p>
              <b>${learnerName}</b>
              has requested to join
              <b>${courseName}</b>.
            </p>

            <p>
              Please open AcogniX to approve
              or reject the enrollment request.
            </p>

          </div>
        `
      );

      return {
        sent: true,
        recipientId: educatorId
      };
    });
  }

  // UC-14: MANAGE CLASS MEMBERS
  // APPROVED / REJECTED / REMOVED
  static async notifyEnrollmentDecision({
    learnerId,
    courseId,
    status
  }) {
    return this._safeSend(async () => {

      const learner =
        await this._findUser(
          learnerId
        );

      const course =
        await this._findCourse(
          courseId
        );

      if (!learner?.email) {
        return {
          sent: false,
          reason: 'RECIPIENT_NOT_FOUND'
        };
      }

      const courseName =
        course?.subjectName ||
        'Course';

      const messages = {

        APPROVED:
          `Your enrollment request for
           "${courseName}" has been approved.`,

        REJECTED:
          `Your enrollment request for
           "${courseName}" has been rejected.`,

        REMOVED:
          `You have been removed from
           "${courseName}".`
      };

      const message =
        messages[status];

      if (!message) {
        return {
          sent: false,
          reason:
            'UNSUPPORTED_ENROLLMENT_STATUS'
        };
      }

      await EmailService.send(
        learner.email,

        `AcogniX - Enrollment Update - ${courseName}`,

        `
          <div style="font-family: Arial, sans-serif;">

            <h2>
              Enrollment Update
            </h2>

            <p>
              ${message}
            </p>

          </div>
        `
      );

      return {
        sent: true,
        recipientId: learnerId
      };
    });
  }


  // UC-09: MANAGE ASSESSMENTS
  // Assessment changed
  static async notifyAssessmentChanged({
    courseId,
    assessmentId,
    action
  }) {
    return this._safeSend(async () => {

      const course =
        await this._findCourse(
          courseId
        );

      const courseName =
        course?.subjectName ||
        'Course';

      const actionMessages = {
        CREATED:
          'A new Assessment has been created.',

        UPDATED:
          'An Assessment has been updated.',

        DELETED:
          'An Assessment has been deleted.',

        SCHEDULED:
          'The schedule of an Assessment has been updated.',

        PUBLISHED:
          'An Assessment has been published.'
      };

      const message =
        actionMessages[action] ||
        'An Assessment has been changed.';

      const html = `
        <div style="font-family: Arial, sans-serif;">

          <h2>
            Assessment Update
          </h2>

          <p>
            ${message}
          </p>

          <p>
            Course:
            <b>${courseName}</b>
          </p>

        </div>
      `;

      const result =
        await this
          ._notifyApprovedCourseLearners({
            courseId,

            subject:
              `AcogniX - Assessment Update - ${courseName}`,

            html
          });

      return {
        ...result,
        assessmentId
      };
    });
  }


  // UC-05: MANAGE COURSE MATERIALS
  // ADDED / UPDATED / DELETED
  static async notifyCourseMaterialChanged({
    courseId,
    material,
    action
  }) {
    return this._safeSend(async () => {

      if (!material) {
        return {
          sent: false,
          reason: 'MATERIAL_REQUIRED'
        };
      }

      const materialTitle =
        material.title ||
        'Course Material';

      const actionConfig = {

        ADDED: {
          subject:
            `AcogniX - New Material - ${materialTitle}`,

          heading:
            'New Course Material',

          message:
            `A new Course Material has been added:
             <b>${materialTitle}</b>.`
        },

        UPDATED: {
          subject:
            `AcogniX - Material Updated - ${materialTitle}`,

          heading:
            'Course Material Updated',

          message:
            `The Course Material
             <b>${materialTitle}</b>
             has been updated.`
        },

        DELETED: {
          subject:
            `AcogniX - Material Removed - ${materialTitle}`,

          heading:
            'Course Material Removed',

          message:
            `The Course Material
             <b>${materialTitle}</b>
             has been removed.`
        }
      };

      const config =
        actionConfig[action];

      if (!config) {
        return {
          sent: false,
          reason:
            'UNSUPPORTED_MATERIAL_ACTION'
        };
      }

      let courseLink = null;

      if (process.env.CLIENT_URL) {
        courseLink =
          `${process.env.CLIENT_URL}` +
          `/classroom/${courseId}/materials`;
      }

      const html = `
        <div style="font-family: Arial, sans-serif;">

          <h2>
            ${config.heading}
          </h2>

          <p>
            ${config.message}
          </p>

          ${
            material.description
              ? `<p>${material.description}</p>`
              : ''
          }

          ${
            courseLink
              ? `
                <p>
                  <a href="${courseLink}">
                    Open Course Materials
                  </a>
                </p>
                `
              : ''
          }

          <p>
            Best regards,<br>
            <b>AcogniX</b>
          </p>

        </div>
      `;

      return this
        ._notifyApprovedCourseLearners({
          courseId,
          subject: config.subject,
          html
        });
    });
  }


  // =========================================================
  // UC-17: POST ANNOUNCEMENTS
  //
  // Announcement published
  // -> notify approved Learners
  // =========================================================

  static async notifyAnnouncementPublished({
    courseId,
    title,
    body
  }) {
    return this._safeSend(async () => {

      const subject =
        `AcogniX - New Announcement - ${title}`;

      const html = `
        <div style="font-family: Arial, sans-serif;">

          <h2>
            ${title}
          </h2>

          <p>
            ${body}
          </p>

          <p>
            Best regards,<br>
            <b>AcogniX</b>
          </p>

        </div>
      `;

      return this
        ._notifyApprovedCourseLearners({
          courseId,
          subject,
          html
        });
    });
  }

  // =========================================================
  // UC-11: EDUCATOR IN-APP WEEKLY REPORT NOTIFICATIONS
  //
  // Store each notification as its own row. This avoids the lost-update race
  // caused by reading/modifying/writing one JSON array in System_Settings.
  // =========================================================

  static _mapNotificationRow(row) {
    if (!row) return null;

    return {
      id: row.notificationId,
      type: row.type,
      title: row.title,
      message: row.message,
      courseId: row.courseId,
      reportId: row.sourceId,
      createdAt: row.createdAt,
      readAt: row.readAt || null,
      read: Boolean(row.readAt),
      targetUrl: row.targetUrl
    };
  }

  static async createWeeklyReportNotification({ report }) {
    if (!report?.reportId || !report?.educatorId || !report?.courseId) {
      throw new AppError(
        400,
        'INVALID_WEEKLY_REPORT_NOTIFICATION',
        'Weekly report notification data is incomplete.'
      );
    }

    const row = {
      recipientId: report.educatorId,
      type: 'WEEKLY_CLASS_PERFORMANCE',
      sourceId: String(report.reportId),
      courseId: report.courseId,
      title: 'Weekly class-performance report ready',
      message: report.courseCode
        ? `${report.courseName} (${report.courseCode})`
        : report.courseName,
      targetUrl: `/educator/analytics?courseId=${encodeURIComponent(String(report.courseId))}&weekly=1`,
      createdAt: report.generatedAt || new Date().toISOString(),
      readAt: null
    };

    const { data, error } = await supabase
      .from('Notification')
      .upsert([row], { onConflict: 'recipientId,type,sourceId' })
      .select('notificationId, type, sourceId, courseId, title, message, targetUrl, createdAt, readAt')
      .single();

    if (error) {
      console.error('[NotificationService] Notification persistence failed:', error);
      throw new AppError(500, 'NOTIFICATION_SAVE_FAILED', 'Unable to save the notification.');
    }

    return this._mapNotificationRow(data);
  }

  static async getEducatorNotifications(educatorId) {
    const { data, error } = await supabase
      .from('Notification')
      .select('notificationId, type, sourceId, courseId, title, message, targetUrl, createdAt, readAt')
      .eq('recipientId', educatorId)
      .order('createdAt', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[NotificationService] Notification lookup failed:', error);
      throw new AppError(500, 'NOTIFICATION_LOAD_FAILED', 'Unable to load notifications.');
    }

    const notifications = (data || [])
      .map(row => this._mapNotificationRow(row))
      .filter(Boolean);

    return {
      notifications,
      unreadCount: notifications.filter(item => item.read !== true).length
    };
  }

  static async markEducatorNotificationRead(educatorId, notificationId) {
    const readAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('Notification')
      .update({ readAt })
      .eq('notificationId', notificationId)
      .eq('recipientId', educatorId)
      .select('notificationId, type, sourceId, courseId, title, message, targetUrl, createdAt, readAt')
      .maybeSingle();

    if (error) {
      console.error('[NotificationService] Notification update failed:', error);
      throw new AppError(500, 'NOTIFICATION_UPDATE_FAILED', 'Unable to update the notification.');
    }
    if (!data) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }

    const { count, error: countError } = await supabase
      .from('Notification')
      .select('notificationId', { count: 'exact', head: true })
      .eq('recipientId', educatorId)
      .is('readAt', null);

    if (countError) {
      console.error('[NotificationService] Notification unread-count lookup failed:', countError);
      throw new AppError(500, 'NOTIFICATION_LOAD_FAILED', 'Unable to load notifications.');
    }

    return {
      notification: this._mapNotificationRow(data),
      unreadCount: Number(count || 0)
    };
  }

}


module.exports = NotificationService;