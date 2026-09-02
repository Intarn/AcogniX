const supabase = require('../config/supabaseClient');
const crypto = require('crypto');
const { CourseStatus } = require('../enums/CourseEnums');
const WorkspaceIntegrationService = require('./WorkspaceIntegrationService');

function generateEnrollmentCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A1B2C3D4"
}

class CourseService {
  // Basic Flow #1-5 (UC-13): Create course
  static async createCourse(educatorId, { subjectName, courseCode, description }) {
    if (!subjectName || !courseCode) {
      const err = new Error('MISSING_REQUIRED_FIELDS'); // Alt Flow 3
      err.status = 400;
      throw err;
    }

    const enrollmentCode = generateEnrollmentCode();

    const { data, error } = await supabase
      .from('Course')
      .insert([{
        educatorId,
        subjectName,
        courseCode,
        description: description || null,
        enrollmentCode,
        status: CourseStatus.ACTIVE
      }])
      .select()
      .single();

    if (error) {
      const err = new Error('COURSE_CREATE_FAILED');
      err.status = 500;
      throw err;
    }

    return data;
  }

  // Used by the "Manage Course" page to list an Educator's own courses
  static async listCoursesByEducator(educatorId) {
    const { data, error } = await supabase
      .from('Course')
      .select('*')
      .eq('educatorId', educatorId)
      .order('createdAt', { ascending: false });

    if (error) {
      const err = new Error('COURSE_LIST_FAILED');
      err.status = 500;
      throw err;
    }
    return data;
  }

  // Shared ownership+existence check used by update() and archive()
  static async getOwnedCourse(courseId, educatorId) {
    const { data, error } = await supabase
      .from('Course')
      .select('*')
      .eq('courseId', courseId)
      .eq('educatorId', educatorId)
      .maybeSingle();

    if (error) {
      const err = new Error('COURSE_LOOKUP_FAILED');
      err.status = 500;
      throw err;
    }

    if (!data) {
      const err = new Error('COURSE_NOT_FOUND_OR_NOT_OWNED');
      err.status = 404;
      throw err;
    }

    return data;
  }

  // Alt Flow 1 (UC-13): Update existing course
  static async updateCourse(courseId, educatorId, { subjectName, courseCode, description }) {
    const course = await this.getOwnedCourse(courseId, educatorId);

    if (course.status === CourseStatus.ARCHIVED) {
      const err = new Error('COURSE_ARCHIVED');
      err.status = 400; 
      throw err;
    }

    if (!subjectName || !courseCode) {
      const err = new Error('MISSING_REQUIRED_FIELDS'); // Alt Flow 3
      err.status = 400;
      throw err;
    }

    const { data, error } = await supabase
      .from('Course')
      .update({ subjectName, courseCode, description: description || null, updatedAt: new Date() })
      .eq('courseId', courseId)
      .select()
      .single();

    if (error) {
      const err = new Error('COURSE_UPDATE_FAILED');
      err.status = 500;
      throw err;
    }

    return data;
  }

  // Alt Flow 2 (UC-13): Archive existing course
  static async archiveCourse(courseId, educatorId) {
    const course = await this.getOwnedCourse(courseId, educatorId);

    if (course.status === CourseStatus.ARCHIVED) {
      const err = new Error('COURSE_ALREADY_ARCHIVED');
      err.status = 400;
      throw err;
    }

    // Archiving implicitly disables the enrollment code: EnrollmentService
    // (in the enrollment feature) must check course.status === ACTIVE
    // before accepting any new enrollment request.
    const { data, error } = await supabase
      .from('Course')
      .update({
        status: CourseStatus.ARCHIVED,
        archivedByRole: 'EDUCATOR',
        archivedByUserId: educatorId,
        archiveReason: null,
        archivedAt: new Date(),
        updatedAt: new Date()
      })
      .eq('courseId', courseId)
      .select()
      .single();

    if (error) {
      const err = new Error('COURSE_ARCHIVE_FAILED');
      err.status = 500;
      throw err;
    }

    try {
      await WorkspaceIntegrationService.archiveClassProjects(courseId);
    } catch (integrationError) {
      // WorkspaceService also self-heals from Course.status on the next load.
      console.error('[CourseService] Failed to archive Class Projects:', integrationError);
    }

    return data;
  }

  // Restore an Educator-owned course. Educators cannot restore a course archived by Admin.
  static async unarchiveCourse(courseId, educatorId) {
    const course = await this.getOwnedCourse(courseId, educatorId);

    if (course.status !== CourseStatus.ARCHIVED) {
      const err = new Error('COURSE_NOT_ARCHIVED');
      err.status = 400;
      throw err;
    }

    if (course.archivedByRole === 'SYSTEM_ADMINISTRATOR') {
      const err = new Error('COURSE_ARCHIVED_BY_ADMIN');
      err.status = 403;
      throw err;
    }

    const { data, error } = await supabase
      .from('Course')
      .update({
        status: CourseStatus.ACTIVE,
        archivedByRole: null,
        archivedByUserId: null,
        archiveReason: null,
        archivedAt: null,
        updatedAt: new Date()
      })
      .eq('courseId', courseId)
      .select()
      .single();

    if (error) {
      const err = new Error('COURSE_UNARCHIVE_FAILED');
      err.status = 500;
      throw err;
    }

    try {
      await WorkspaceIntegrationService.unarchiveClassProjects(courseId);
    } catch (integrationError) {
      console.error('[CourseService] Failed to restore Class Projects:', integrationError);
    }

    return data;
  }

  static async countActiveCourses() {
    const { data, error } = await supabase
      .from('Course')
      .select('courseId')
      .eq('status', 'ACTIVE');

    if (error) {
      const err = new Error('COUNT_FAILED');
      err.status = 500;
      throw err;
    }
    return data ? data.length : 0;
  }

  // Get all courses for Admin (Includes educator names & student count)
  static async getAllCoursesForAdmin(searchQuery = '') {
    let dbQuery = supabase
      .from('Course')
      .select('*')
      .order('createdAt', { ascending: false });

    // Search by subject name or course code
    if (searchQuery && searchQuery.trim() !== '') {
      dbQuery = dbQuery.or(`subjectName.ilike.%${searchQuery}%,courseCode.ilike.%${searchQuery}%`);
    }

    const { data: courses, error: courseError } = await dbQuery;

    if (courseError) {
      const err = new Error('ADMIN_COURSE_LIST_FAILED');
      err.status = 500;
      throw err;
    }

    // Fetch Users to map the educator's name
    const { data: users } = await supabase.from('User').select('userId, displayName, email');
    
    // Fetch the count of approved students in each class
    const { data: enrollments } = await supabase.from('Enrollment').select('courseId').eq('status', 'APPROVED');

    // Combine data to return to the Frontend
    return (courses || []).map(course => {
      const educator = users?.find(u => u.userId === course.educatorId);
      const studentCount = enrollments?.filter(e => e.courseId === course.courseId).length || 0;
      
      return {
        ...course,
        educatorName: educator?.displayName || 'Unknown Educator',
        educatorEmail: educator?.email || 'N/A',
        studentCount
      };
    });
  }

  // Admin Archive Course (Bypasses the Educator ownership check)
  static async adminArchiveCourse(courseId, adminId, archiveReason = null) {
    const { data, error } = await supabase
      .from('Course')
      .update({
        status: CourseStatus.ARCHIVED,
        archivedByRole: 'SYSTEM_ADMINISTRATOR',
        archivedByUserId: adminId,
        archiveReason: archiveReason || 'Archived by System Administrator',
        archivedAt: new Date(),
        updatedAt: new Date()
      })
      .eq('courseId', courseId)
      .select()
      .single();

    if (error) {
      const err = new Error('ADMIN_COURSE_ARCHIVE_FAILED');
      err.status = 500;
      throw err;
    }

    try {
      await WorkspaceIntegrationService.archiveClassProjects(courseId);
    } catch (integrationError) {
      console.error('[CourseService] Failed to archive Class Projects:', integrationError);
    }

    return data;
  }

  // Admin can restore any archived course.
  static async adminUnarchiveCourse(courseId) {
    const { data: existing, error: lookupError } = await supabase
      .from('Course')
      .select('*')
      .eq('courseId', courseId)
      .maybeSingle();

    if (lookupError) {
      const err = new Error('COURSE_LOOKUP_FAILED');
      err.status = 500;
      throw err;
    }
    if (!existing) {
      const err = new Error('COURSE_NOT_FOUND');
      err.status = 404;
      throw err;
    }
    if (existing.status !== CourseStatus.ARCHIVED) {
      const err = new Error('COURSE_NOT_ARCHIVED');
      err.status = 400;
      throw err;
    }

    const { data, error } = await supabase
      .from('Course')
      .update({
        status: CourseStatus.ACTIVE,
        archivedByRole: null,
        archivedByUserId: null,
        archiveReason: null,
        archivedAt: null,
        updatedAt: new Date()
      })
      .eq('courseId', courseId)
      .select()
      .single();

    if (error) {
      const err = new Error('ADMIN_COURSE_UNARCHIVE_FAILED');
      err.status = 500;
      throw err;
    }

    try {
      await WorkspaceIntegrationService.unarchiveClassProjects(courseId);
    } catch (integrationError) {
      console.error('[CourseService] Failed to restore Class Projects:', integrationError);
    }

    return data;
  }

  static async getCourseDetailForAdmin(courseId) {
    const { data: course, error: courseError } = await supabase
      .from('Course')
      .select('*')
      .eq('courseId', courseId)
      .single();

    if (courseError || !course) {
      const err = new Error('COURSE_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    const { data: educator } = await supabase
      .from('User')
      .select('userId, displayName, email')
      .eq('userId', course.educatorId)
      .single();

    const { data: enrollments } = await supabase
      .from('Enrollment')
      .select('learnerId, status, requestedAt')
      .eq('courseId', courseId)
      .eq('status', 'APPROVED');

    let students = [];
    if (enrollments && enrollments.length > 0) {
      const learnerIds = enrollments.map(e => e.learnerId);
      
      const { data: users } = await supabase
        .from('User')
        .select('userId, displayName, email')
        .in('userId', learnerIds);

      if (users) {
        students = users;
      }
    }

    return {
      ...course,
      educatorName: educator?.displayName || 'Unknown Educator',
      educatorEmail: educator?.email || 'N/A',
      students
    };
  }
}

module.exports = CourseService;