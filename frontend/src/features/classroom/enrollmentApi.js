import { apiRequest } from '../../services/apiClient';

// UC-15: Enroll in Class
export function joinClass(enrollmentCode) {
  return apiRequest('/enrollment', {
    method: 'POST',

    body: JSON.stringify({
      enrollmentCode
    })
  });
}

// UC-14: Manage Class Members
export function getCourseMembers(
  courseId,
  status
) {
  const query =
    status
      ? `?status=${encodeURIComponent(status)}`
      : '';

  return apiRequest(
    `/enrollment/courses/${courseId}/members${query}`
  );
}

export function approveEnrollment(
  enrollmentId
) {
  return apiRequest(
    `/enrollment/${enrollmentId}/approve`,
    {
      method: 'PATCH'
    }
  );
}

export function rejectEnrollment(
  enrollmentId
) {
  return apiRequest(
    `/enrollment/${enrollmentId}/reject`,
    {
      method: 'PATCH'
    }
  );
}

export function removeMember(
  enrollmentId
) {
  return apiRequest(
    `/enrollment/${enrollmentId}/remove`,
    {
      method: 'PATCH'
    }
  );
}