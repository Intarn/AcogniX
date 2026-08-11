import {
  apiRequest
} from '../../services/apiClient';


// ==============================
// CLASS ANALYTICS
// ==============================

export function getClassAnalytics(
  courseId
) {
  return apiRequest(
    `/analytics/courses/${courseId}`
  );
}