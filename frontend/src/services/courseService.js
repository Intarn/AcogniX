import {
  apiRequest
} from './apiClient';


export const getCourses =
  async () => {
    return apiRequest(
      '/enrollment',
      {
        method: 'GET'
      }
    );
  };


export const enrollInClass =
  async (
    enrollmentCode
  ) => {
    return apiRequest(
      '/enrollment',
      {
        method: 'POST',

        body:
          JSON.stringify({
            enrollmentCode
          })
      }
    );
  };

export function getEnrolledCourses() {
  return apiRequest(
    '/enrollment'
  );
};