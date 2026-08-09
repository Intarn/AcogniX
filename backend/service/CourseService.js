const supabase = require('../config/supabaseClient');
const crypto = require('crypto');
const { CourseStatus } = require('../enums/CourseEnums');

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
    await this.getOwnedCourse(courseId, educatorId);

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

    if (course.status === CourseStatus.ARCHIVED) {
      const err = new Error('COURSE_ARCHIVED');
      err.status = 400; 
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
      .update({ status: CourseStatus.ARCHIVED, updatedAt: new Date() })
      .eq('courseId', courseId)
      .select()
      .single();

    if (error) {
      const err = new Error('COURSE_ARCHIVE_FAILED');
      err.status = 500;
      throw err;
    }

    return data;
  }
}

module.exports = CourseService;