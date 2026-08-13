import { apiRequest } from './apiClient';

export const getCourses = async () => {
  return apiRequest('/enrollment', { method: 'GET' });
};

// Alias để tương thích với các component gọi getEnrolledCourses
export const getEnrolledCourses = getCourses;

export const enrollInClass = async (enrollmentCode) => {
  return apiRequest('/enrollment', {
    method: 'POST',
    body: JSON.stringify({ enrollmentCode })
  });
};

// Thêm alias joinClass để khớp với lệnh import đang bị lỗi
export const joinClass = enrollInClass;