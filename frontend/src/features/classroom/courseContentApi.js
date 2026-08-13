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
    `/courses/${courseId}/materials`
  );
}


export function addCourseMaterial(
  courseId,
  formData
) {
  return apiRequest(
    `/courses/${courseId}/materials`,
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
    `/courses/materials/${materialId}`,
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
    `/courses/materials/${materialId}`,
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
    `/courses/${courseId}/announcements`
  );
}


export function publishAnnouncement(
  courseId,
  formData
) {
  return apiRequest(
    `/courses/${courseId}/announcements`,
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
    `/courses/${courseId}/materials/reorder`,
    {
      method: 'PATCH',

      body: JSON.stringify({
        materialOrders
      })
    }
  );
}