const CourseService = require('../service/CourseService');

class CourseController {
  static async list(req, res) {
    const educatorId = req.user.userId;
    try {
      const courses = await CourseService.listCoursesByEducator(educatorId);
      return res.status(200).json({ courses });
    } catch (error) {
      return res.status(500).json({ message: "Unable to load courses. Please try again." });
    }
  }

  // Basic Flow #1-5 (UC-13)
  static async create(req, res) {
    const educatorId = req.user.userId;
    const { subjectName, courseCode, description } = req.body;

    try {
      const course = await CourseService.createCourse(educatorId, { subjectName, courseCode, description });
      return res.status(201).json({ message: "Course created successfully.", course });
    } catch (error) {
      if (error.message === 'MISSING_REQUIRED_FIELDS') {
        return res.status(400).json({ message: "Please complete all required fields." }); // Alt Flow 3
      }
      return res.status(500).json({ message: "Unable to create course. Please try again." });
    }
  }

  // Alt Flow 1 (UC-13)
  static async update(req, res) {
    const educatorId = req.user.userId;
    const { courseId } = req.params;
    const { subjectName, courseCode, description } = req.body;

    try {
      const course = await CourseService.updateCourse(courseId, educatorId, { subjectName, courseCode, description });
      return res.status(200).json({ message: "Course updated successfully.", course });
    } catch (error) {
      if (error.message === 'MISSING_REQUIRED_FIELDS') {
        return res.status(400).json({ message: "Please complete all required fields." });
      }
      if (error.message === 'COURSE_NOT_FOUND_OR_NOT_OWNED') {
        return res.status(404).json({ message: "Course not found." });
      }
      return res.status(500).json({ message: "Unable to update course. Please try again." });
    }
  }

  // Alt Flow 2 (UC-13)
  static async archive(req, res) {
    const educatorId = req.user.userId;
    const { courseId } = req.params;

    try {
      const course = await CourseService.archiveCourse(courseId, educatorId);
      return res.status(200).json({ message: "Course has been archived.", course });
    } catch (error) {
      if (error.message === 'COURSE_NOT_FOUND_OR_NOT_OWNED') {
        return res.status(404).json({ message: "Course not found." });
      }
      if (error.message === 'COURSE_ALREADY_ARCHIVED') {
        return res.status(400).json({ message: "This course is already archived." });
      }
      return res.status(500).json({ message: "Unable to archive course. Please try again." });
    }
  }

  static async unarchive(req, res) {
    const educatorId = req.user.userId;
    const { courseId } = req.params;

    try {
      const course = await CourseService.unarchiveCourse(courseId, educatorId);
      return res.status(200).json({ message: "Course has been restored.", course });
    } catch (error) {
      if (error.message === 'COURSE_NOT_FOUND_OR_NOT_OWNED') {
        return res.status(404).json({ message: "Course not found." });
      }
      if (error.message === 'COURSE_NOT_ARCHIVED') {
        return res.status(400).json({ message: "This course is not archived." });
      }
      if (error.message === 'COURSE_ARCHIVED_BY_ADMIN') {
        return res.status(403).json({ message: "This course was archived by a System Administrator and can only be restored by an Administrator." });
      }
      return res.status(500).json({ message: "Unable to restore course. Please try again." });
    }
  }

  static async countActive(req, res) {
    try {
      const count = await CourseService.countActiveCourses();
      return res.status(200).json({ activeCourses: count });
    } catch (error) {
      return res.status(500).json({ message: "Unable to count active courses." });
    }
  }

  // Admin API: Get the entire list of courses
  static async getAllForAdmin(req, res) {
    try {
      const query = req.query.query || '';
      const courses = await CourseService.getAllCoursesForAdmin(query);
      return res.status(200).json({ courses });
    } catch (error) {
      console.error("Error fetching course list for Admin:", error);
      return res.status(500).json({ message: "Unable to load courses. Please try again." });
    }
  }

  // Admin API: Archive any course
  static async adminArchiveCourse(req, res) {
    try {
      const { courseId } = req.params;
      const adminId = req.user.userId;
      const { reason } = req.body || {};
      const course = await CourseService.adminArchiveCourse(courseId, adminId, reason);
      return res.status(200).json({ message: "Course has been archived.", course });
    } catch (error) {
      console.error("Error archiving course as Admin:", error);
      return res.status(500).json({ message: "Unable to archive course. Please try again." });
    }
  }

  static async adminUnarchiveCourse(req, res) {
    try {
      const { courseId } = req.params;
      const course = await CourseService.adminUnarchiveCourse(courseId);
      return res.status(200).json({ message: "Course has been restored.", course });
    } catch (error) {
      console.error("Error restoring course as Admin:", error);
      if (error.message === 'COURSE_NOT_FOUND') {
        return res.status(404).json({ message: "Course not found." });
      }
      if (error.message === 'COURSE_NOT_ARCHIVED') {
        return res.status(400).json({ message: "This course is not archived." });
      }
      return res.status(500).json({ message: "Unable to restore course. Please try again." });
    }
  }

  static async getAdminCourseDetail(req, res) {
    try {
      const { courseId } = req.params;
      const courseDetail = await CourseService.getCourseDetailForAdmin(courseId);
      return res.status(200).json(courseDetail);
    } catch (error) {
      console.error("Lỗi lấy chi tiết khóa học cho Admin:", error);
      if (error.message === 'COURSE_NOT_FOUND') return res.status(404).json({ message: "Course not found." });
      return res.status(500).json({ message: "Unable to load course details." });
    }
  }
}

module.exports = CourseController;