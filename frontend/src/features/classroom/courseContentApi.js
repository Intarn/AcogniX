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



export async function getCourseMaterialFileBlob(materialId, { download = false } = {}) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  const token = localStorage.getItem('accessToken');
  const response = await fetch(
    `${API_BASE_URL}/courses/materials/${encodeURIComponent(materialId)}/file${download ? '?download=1' : ''}`,
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.message || 'This file is no longer available.');
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    contentDisposition: response.headers.get('content-disposition') || ''
  };
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