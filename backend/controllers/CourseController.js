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
}

module.exports = CourseController;