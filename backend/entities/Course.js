const { CourseStatus } = require('../enums/CourseEnums');

class Course {
  constructor(courseId, educatorId, subjectName, courseCode, description, enrollmentCode, status, createdAt, updatedAt) {
    this.courseId = courseId;
    this.educatorId = educatorId;
    this.subjectName = subjectName;
    this.courseCode = courseCode;
    this.description = description;
    this.enrollmentCode = enrollmentCode;
    this.status = status || CourseStatus.ACTIVE;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  isActive() {
    return this.status === CourseStatus.ACTIVE;
  }
}

module.exports = Course;