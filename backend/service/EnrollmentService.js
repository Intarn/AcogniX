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
        'Your enrollment request is awaiting approval.'
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

    if (enrollment.status !== EnrollmentStatus.PENDING) {
      throw new AppError(
        409,
        'ENROLLMENT_NOT_PENDING',
        'Only a pending enrollment request can be approved.'
      );
    }

    const { data, error } = await supabase
      .from('Enrollment')
      .update({
        status: EnrollmentStatus.APPROVED,
        approvedAt: new Date().toISOString(),
        rejectedAt: null,
        removedAt: null
      })
      .eq('enrollmentId', enrollmentId)
      .select()
      .single();

    if (error) throw error;

    const workspace = await WorkspaceIntegrationService.provisionClassProject({
      learnerId: data.learnerId,
      courseId: data.courseId,
      projectName: course.subjectName
    });

    const notification = await NotificationService.notifyEnrollmentDecision({
      learnerId: data.learnerId,
      courseId: data.courseId,
      status: EnrollmentStatus.APPROVED
    });

    return {
      enrollment: new Enrollment(data),
      workspace,
      notification
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
