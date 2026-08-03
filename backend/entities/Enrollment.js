const { EnrollmentStatus } = require('../enums/ClassroomEnums');

class Enrollment {
  constructor({
    enrollmentId,
    courseId,
    learnerId,
    status = EnrollmentStatus.PENDING,
    requestedAt = new Date(),
    approvedAt = null,
    rejectedAt = null,
    removedAt = null
  }) {
    this.enrollmentId = enrollmentId;
    this.courseId = courseId;
    this.learnerId = learnerId;
    this.status = status;
    this.requestedAt = requestedAt;
    this.approvedAt = approvedAt;
    this.rejectedAt = rejectedAt;
    this.removedAt = removedAt;
  }

  isPending() {
    return this.status === EnrollmentStatus.PENDING;
  }

  isApproved() {
    return this.status === EnrollmentStatus.APPROVED;
  }
}

module.exports = Enrollment;
