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
    archivedByRole = null,
    archivedByUserId = null,
    archiveReason = null,
    archivedAt = null,
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
    this.archivedByRole = archivedByRole;
    this.archivedByUserId = archivedByUserId;
    this.archiveReason = archiveReason;
    this.archivedAt = archivedAt;
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