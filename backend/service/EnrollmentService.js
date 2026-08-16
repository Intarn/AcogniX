const supabase = require('../config/supabaseClient');
const Enrollment = require('../entities/Enrollment');
const AppError = require('../error/AppError');
const NotificationService = require('./NotificationService');
const WorkspaceIntegrationService = require('./WorkspaceIntegrationService');
const {
  CourseStatus,
  EnrollmentStatus
} = require('../enums/ClassroomEnums');

class EnrollmentService {
  // UC-15: A valid request is always created with PENDING status.
  static async requestEnrollment(learnerId, enrollmentCode) {
    const normalizedCode = String(enrollmentCode || '').trim().toUpperCase();

    // alternative flow 3 của uc15 - empty input
    if (!normalizedCode) {
      throw new AppError(
        400,
        'CLASS_CODE_REQUIRED',
        'Class code cannot be empty.'
      );
    }

    // Basic Flow - bước 4 kiểm tra code với database của các Course đang Active
    const course = await this._findActiveCourseByCode(normalizedCode);

    // Kiểm tra xem Learner đã có Enrollment trong Course chưa
    const { data: existing, error: existingError } = await supabase
      .from('Enrollment')
      .select('*')
      .eq('courseId', course.courseId)
      .eq('learnerId', learnerId)
      .maybeSingle();

    if (existingError) throw existingError;

    // Đã làm member trong class alternative flow 2 của UC-15
    if (existing?.status === EnrollmentStatus.APPROVED) {
      const error = new AppError(
        409,
        'ALREADY_ENROLLED',
        'You are already enrolled in this Class.'
      );
      error.details = { courseId: course.courseId };
      throw error;
    }

    if (existing?.status === EnrollmentStatus.PENDING) {
      throw new AppError(
        409,
        'ENROLLMENT_REQUEST_PENDING',
        'Your enrollment request is pending approval.'
      );
    }

    // Tạo enrolment pending
    const enrollmentData = {
      courseId: course.courseId,
      learnerId,
      status: EnrollmentStatus.PENDING,
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      rejectedAt: null,
      removedAt: null
    };

    let savedEnrollment;

    // Design assumption: REJECTED/REMOVED records may be submitted again.
    if (existing) {
      const { data, error } = await supabase
        .from('Enrollment')
        .update(enrollmentData)
        .eq('enrollmentId', existing.enrollmentId)
        .select()
        .single();

      if (error) throw error;
      savedEnrollment = data;
    } else {
      const { data, error } = await supabase
        .from('Enrollment')
        .insert(enrollmentData)
        .select()
        .single();

      if (error) throw error;
      savedEnrollment = data;
    }

    // thông báo đến cho educator
    const notification = await NotificationService.notifyEnrollmentRequested({
      educatorId: course.educatorId,
      learnerId,
      courseId: course.courseId
    });

    // trả thông báo về cho learner
    return {
      enrollment: new Enrollment(savedEnrollment),
      course: {
        courseId: course.courseId,
        subjectName: course.subjectName,
        courseCode: course.courseCode
      },
      notification
    };
  }

  // UC-15: Get Courses in which the current Learner
  // has an APPROVED Enrollment
  static async getMyCourses(
      learnerId
  ) {
      const {
          data: enrollments,
          error: enrollmentError
      } = await supabase
          .from('Enrollment')
          .select('*')
          .eq(
              'learnerId',
              learnerId
          )
          .eq(
              'status',
              EnrollmentStatus.APPROVED
          )
          .order(
              'approvedAt',
              {
                  ascending: false
              }
          );

      if (enrollmentError) {
          throw enrollmentError;
      }


      if (
          !enrollments ||
          enrollments.length === 0
      ) {
          return [];
      }


      const courseIds = [
          ...new Set(
              enrollments.map(
                  enrollment =>
                      enrollment.courseId
              )
          )
      ];


      const {
          data: courses,
          error: courseError
      } = await supabase
          .from('Course')
          .select(
              'courseId, educatorId, subjectName, courseCode, description, status'
          )
          .in(
              'courseId',
              courseIds
          );

      if (courseError) {
          throw courseError;
      }


      const educatorIds = [
          ...new Set(
              (courses || []).map(
                  course =>
                      course.educatorId
              )
          )
      ];


      let educators = [];

      if (
          educatorIds.length > 0
      ) {
          const {
              data,
              error
          } = await supabase
              .from('User')
              .select(
                  'userId, email, displayName, avatarUrl'
              )
              .in(
                  'userId',
                  educatorIds
              );

          if (error) {
              throw error;
          }

          educators =
              data || [];
      }


      const educatorById =
          new Map(
              educators.map(
                  educator => [
                      educator.userId,
                      educator
                  ]
              )
          );


      const courseById =
          new Map(
              (courses || []).map(
                  course => [
                      course.courseId,
                      course
                  ]
              )
          );


      return enrollments
          .map(
              enrollment => {
                  const course =
                      courseById.get(
                          enrollment.courseId
                      );

                  if (!course) {
                      return null;
                  }


                  return {
                      ...course,

                      enrollmentId:
                          enrollment
                              .enrollmentId,

                      enrollmentStatus:
                          enrollment.status,

                      approvedAt:
                          enrollment
                              .approvedAt,

                      educator:
                          educatorById.get(
                              course.educatorId
                          ) || null
                  };
              }
          )
          .filter(Boolean);
  }

  // UC-14: By default, show pending requests and approved members.
  static async getCourseMembers(courseId, educatorId, requestedStatus) {
    await this._assertCourseManagedBy(courseId, educatorId);

    if (
      requestedStatus &&
      !Object.values(EnrollmentStatus).includes(requestedStatus)
    ) {
      throw new AppError(
        400,
        'INVALID_ENROLLMENT_STATUS',
        'The supplied enrollment status is invalid.'
      );
    }

    let query = supabase
      .from('Enrollment')
      .select('*')
      .eq('courseId', courseId)
      .order('requestedAt', { ascending: false });

    
    if (requestedStatus) {
      query = query.eq('status', requestedStatus);
    } else {
      query = query.in('status', [
        EnrollmentStatus.PENDING,
        EnrollmentStatus.APPROVED
      ]);
    }

    const { data: enrollments, error } = await query;
    if (error) throw error;
    if (!enrollments || enrollments.length === 0) return [];

    const learnerIds = [...new Set(enrollments.map(item => item.learnerId))];

    const { data: learners, error: learnerError } = await supabase
      .from('User')
      .select('userId, email, displayName, avatarUrl, role, status')
      .in('userId', learnerIds);

    if (learnerError) throw learnerError;

    const learnerById = new Map(
      learners.map(learner => [learner.userId, learner])
    );

    return enrollments.map(enrollment => ({
      enrollment: new Enrollment(enrollment),
      learner: learnerById.get(enrollment.learnerId) || null
    }));
  }

  static async approveEnrollment(enrollmentId, educatorId) {
    const enrollment = await this._findEnrollmentById(enrollmentId);
    const course = await this._assertCourseManagedBy(
      enrollment.courseId,
      educatorId
    );

    if (course.status !== CourseStatus.ACTIVE) {
      throw new AppError(
        409,
        'COURSE_ARCHIVED',
        'This Course is archived and can no longer accept enrollment approvals.'
      );
    }

    // Approval is intentionally idempotent. The previous implementation updated
    // Enrollment to APPROVED before provisioning the Class Project. If Workspace
    // provisioning was slow/failed, the UI still showed PENDING and a second click
    // produced ENROLLMENT_NOT_PENDING even though the approval had already succeeded.
    if (
      enrollment.status !== EnrollmentStatus.PENDING &&
      enrollment.status !== EnrollmentStatus.APPROVED
    ) {
      throw new AppError(
        409,
        'ENROLLMENT_ALREADY_PROCESSED',
        'This enrollment request has already been processed.'
      );
    }

    let approvedEnrollment = enrollment;
    let alreadyApproved = enrollment.status === EnrollmentStatus.APPROVED;

    if (!alreadyApproved) {
      const { data, error } = await supabase
        .from('Enrollment')
        .update({
          status: EnrollmentStatus.APPROVED,
          approvedAt: new Date().toISOString(),
          rejectedAt: null,
          removedAt: null
        })
        .eq('enrollmentId', enrollmentId)
        .eq('status', EnrollmentStatus.PENDING)
        .select()
        .maybeSingle();

      if (error) throw error;

      // Another request may have approved the same enrollment while this request
      // was waiting. Re-read instead of exposing a race-condition error to the UI.
      if (!data) {
        approvedEnrollment = await this._findEnrollmentById(enrollmentId);
        if (approvedEnrollment.status !== EnrollmentStatus.APPROVED) {
          throw new AppError(
            409,
            'ENROLLMENT_ALREADY_PROCESSED',
            'This enrollment request has already been processed.'
          );
        }
        alreadyApproved = true;
      } else {
        approvedEnrollment = data;
      }
    }

    // Workspace integration must not roll back or hide a successful approval.
    // It is safe to retry because provisionClassProject itself reuses an existing
    // Class Project rather than creating duplicates.
    let workspace;
    try {
      workspace = await WorkspaceIntegrationService.provisionClassProject({
        learnerId: approvedEnrollment.learnerId,
        courseId: approvedEnrollment.courseId,
        projectName: course.subjectName
      });
      workspace = { ...workspace, provisioned: true };
    } catch (workspaceError) {
      console.error('[Enrollment] Workspace provisioning failed after approval:', workspaceError);
      workspace = {
        provisioned: false,
        reason: 'WORKSPACE_PROVISION_FAILED'
      };
    }

    // Notification failure is non-blocking as specified by the enrollment flow.
    // Do not send the same approval notification again when this is only an
    // idempotent retry of an already-approved record.
    let notification = {
      sent: false,
      reason: alreadyApproved ? 'ALREADY_NOTIFIED_OR_PREVIOUSLY_PROCESSED' : 'NOT_ATTEMPTED'
    };

    if (!alreadyApproved) {
      try {
        notification = await NotificationService.notifyEnrollmentDecision({
          learnerId: approvedEnrollment.learnerId,
          courseId: approvedEnrollment.courseId,
          status: EnrollmentStatus.APPROVED
        });
      } catch (notificationError) {
        console.error('[Enrollment] Approval notification failed:', notificationError);
        notification = {
          sent: false,
          reason: 'NOTIFICATION_FAILED'
        };
      }
    }

    return {
      enrollment: new Enrollment(approvedEnrollment),
      workspace,
      notification,
      alreadyApproved
    };
  }

  static async rejectEnrollment(enrollmentId, educatorId) {
    const enrollment = await this._findEnrollmentById(enrollmentId);
    await this._assertCourseManagedBy(enrollment.courseId, educatorId);

    if (enrollment.status !== EnrollmentStatus.PENDING) {
      throw new AppError(
        409,
        'ENROLLMENT_NOT_PENDING',
        'Only a pending enrollment request can be rejected.'
      );
    }

    const { data, error } = await supabase
      .from('Enrollment')
      .update({
        status: EnrollmentStatus.REJECTED,
        approvedAt: null,
        rejectedAt: new Date().toISOString(),
        removedAt: null
      })
      .eq('enrollmentId', enrollmentId)
      .select()
      .single();

    if (error) throw error;

    const notification = await NotificationService.notifyEnrollmentDecision({
      learnerId: data.learnerId,
      courseId: data.courseId,
      status: EnrollmentStatus.REJECTED
    });

    return {
      enrollment: new Enrollment(data),
      notification
    };
  }

  static async removeMember(enrollmentId, educatorId) {
    const enrollment = await this._findEnrollmentById(enrollmentId);
    await this._assertCourseManagedBy(enrollment.courseId, educatorId);

    if (enrollment.status !== EnrollmentStatus.APPROVED) {
      throw new AppError(
        409,
        'ENROLLMENT_NOT_APPROVED',
        'Only an approved Learner can be removed from the Class.'
      );
    }

    const { data, error } = await supabase
      .from('Enrollment')
      .update({
        status: EnrollmentStatus.REMOVED,
        removedAt: new Date().toISOString()
      })
      .eq('enrollmentId', enrollmentId)
      .select()
      .single();

    if (error) throw error;

    const workspace = await WorkspaceIntegrationService.revokeClassProjectAccess({
      learnerId: data.learnerId,
      courseId: data.courseId
    });

    const notification = await NotificationService.notifyEnrollmentDecision({
      learnerId: data.learnerId,
      courseId: data.courseId,
      status: EnrollmentStatus.REMOVED
    });

    return {
      enrollment: new Enrollment(data),
      workspace,
      notification
    };
  }

  // hàm tìm xem Course hiện tại như nào thông qua enrollmentcode
  static async _findActiveCourseByCode(enrollmentCode) {
    const { data: course, error } = await supabase
      .from('Course')
      .select(
        'courseId, educatorId, subjectName, courseCode, description, enrollmentCode, status'
      )
      .eq('enrollmentCode', enrollmentCode)
      .eq('status', CourseStatus.ACTIVE)
      .maybeSingle();

    if (error) throw error;
    
    if (!course) {
      throw new AppError(
        404,
        'INVALID_OR_EXPIRED_CLASS_CODE',
        'Invalid or expired class code. Please check with your Educator and try again.'
      );
    }

    return course;
  }

  static async _findEnrollmentById(enrollmentId) {
    const { data, error } = await supabase
      .from('Enrollment')
      .select('*')
      .eq('enrollmentId', enrollmentId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new AppError(
        404,
        'ENROLLMENT_NOT_FOUND',
        'The enrollment record could not be found.'
      );
    }

    return data;
  }

  // Educator phải là người quản lý Course
  static async _assertCourseManagedBy(courseId, educatorId) {
    const { data: course, error } = await supabase
      .from('Course')
      .select(
        'courseId, educatorId, subjectName, courseCode, enrollmentCode, status'
      )
      .eq('courseId', courseId)
      .maybeSingle();

    if (error) throw error;

    if (!course) {
      throw new AppError(
        404,
        'COURSE_NOT_FOUND',
        'The Course could not be found.'
      );
    }

    if (course.educatorId !== educatorId) {
      throw new AppError(
        403,
        'COURSE_ACCESS_DENIED',
        'Only the Educator managing this Course may manage its members.'
      );
    }

    return course;
  }
}

module.exports = EnrollmentService;