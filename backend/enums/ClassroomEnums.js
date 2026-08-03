const CourseStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED'
});

const EnrollmentStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REMOVED: 'REMOVED'
});

module.exports = {
  CourseStatus,
  EnrollmentStatus
};
