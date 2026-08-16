import { apiRequest } from '../../services/apiClient';

export function login(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',

    body: JSON.stringify({
      email,
      password
    })
  });
}

export function signUp({
  email,
  password,
  confirmPassword,
  displayName,
  role
}) {
  return apiRequest('/auth/signup', {
    method: 'POST',

    body: JSON.stringify({
      email,
      password,
      confirmPassword,
      displayName,
      role
    })
  });
}

export function logout() {
  return apiRequest('/auth/logout', {
    method: 'POST'
  });
}

export function getProfile() {
  return apiRequest('/profile');
}