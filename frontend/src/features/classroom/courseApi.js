import { apiRequest } from '../../services/apiClient';

// UC-13: Manage Course

export function getCourses() {
  return apiRequest('/courses');
}

export function createCourse(courseData) {
  return apiRequest('/courses', {
    method: 'POST',
    body: JSON.stringify(courseData)
  });
}

export function updateCourse(
  courseId,
  courseData
) {
  return apiRequest(
    `/courses/${courseId}`,
    {
      method: 'PUT',
      body: JSON.stringify(courseData)
    }
  );
}

export function archiveCourse(courseId) {
  return apiRequest(
    `/courses/${courseId}/archive`,
    {
      method: 'POST'
    }
  );
}