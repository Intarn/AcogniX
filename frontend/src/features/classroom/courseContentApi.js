import {
  apiRequest
} from '../../services/apiClient';


// ==============================
// COURSE MATERIALS
// ==============================

export function getCourseMaterials(
  courseId
) {
  return apiRequest(
    `/course-content/${courseId}/materials`
  );
}


export function addCourseMaterial(
  courseId,
  formData
) {
  return apiRequest(
    `/course-content/${courseId}/materials`,
    {
      method: 'POST',
      body: formData
    }
  );
}


export function updateCourseMaterial(
  materialId,
  formData
) {
  return apiRequest(
    `/course-content/materials/${materialId}`,
    {
      method: 'PUT',
      body: formData
    }
  );
}


export function deleteCourseMaterial(
  materialId
) {
  return apiRequest(
    `/course-content/materials/${materialId}`,
    {
      method: 'DELETE'
    }
  );
}


// ==============================
// ANNOUNCEMENTS
// ==============================

export function getCourseAnnouncements(
  courseId
) {
  return apiRequest(
    `/course-content/${courseId}/announcements`
  );
}


export function publishAnnouncement(
  courseId,
  formData
) {
  return apiRequest(
    `/course-content/${courseId}/announcements`,
    {
      method: 'POST',
      body: formData
    }
  );
}

export function reorderCourseMaterials(
  courseId,
  materialOrders
) {
  return apiRequest(
    `/course-content/${courseId}/materials/reorder`,
    {
      method: 'PATCH',

      body: JSON.stringify({
        materialOrders
      })
    }
  );
}