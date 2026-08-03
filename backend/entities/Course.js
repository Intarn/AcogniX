const { CourseStatus } = require('../enums/ClassroomEnums');

class Course {
  constructor({
    courseId,
    educatorId,
    subjectName,
    courseCode,
    description = null,
    enrollmentCode,
    status = CourseStatus.ACTIVE,
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.courseId = courseId;
    this.educatorId = educatorId;
    this.subjectName = subjectName;
    this.courseCode = courseCode;
    this.description = description;
    this.enrollmentCode = enrollmentCode;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isActive() {
    return this.status === CourseStatus.ACTIVE;
  }

  isManagedBy(educatorId) {
    return this.educatorId === educatorId;
  }
}

module.exports = Course;
