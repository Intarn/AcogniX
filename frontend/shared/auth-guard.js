// frontend/shared/auth-guard.js
(function () {
  const API_PROFILE_URL = 'http://localhost:3001/api/profile';
  const LOGIN_PATH = '../auth/login.html';

  function normalizeRole(role) {
    if (role === 'EDUCATOR' || role === 'teacher') return 'teacher';
    if (role === 'SYSTEM_ADMINISTRATOR' || role === 'admin') return 'admin';
    return 'student';
  }

  function normalizeProfile(rawData) {
    let data = rawData;
    if (rawData && rawData.profile) {
      data = rawData.profile;
    } else if (rawData && rawData.data) {
      data = rawData.data;
    } else if (Array.isArray(rawData)) {
      data = rawData[0] || {};
    }

    const safeEmail = data?.email || 'user@acognix.com';
    const userId = data?.userId || data?.id || data?.uid || safeEmail;

    return {
      userId,
      id: userId,
      fullname: data?.displayName || data?.fullname || safeEmail.split('@')[0],
      email: safeEmail,
      role: normalizeRole(data?.role)
    };
  }

  function cacheCurrentUser(user) {
    window.currentUser = user;
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    syncLegacyUser(user);
    populateUserData(user);
    window.dispatchEvent(new CustomEvent('auth:ready', { detail: user }));
  }

  function syncLegacyUser(user) {
    const USERS_KEY = 'acognix_users';

    try {
      const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
      const userIndex = users.findIndex((item) => (
        item.email === user.email ||
        item.userId === user.userId ||
        item.id === user.id
      ));
      const existingUser = userIndex >= 0 ? users[userIndex] : {};
      const legacyUser = {
        ...existingUser,
        userId: user.userId,
        id: existingUser.id || user.id,
        fullname: user.fullname,
        displayName: user.fullname,
        email: user.email,
        role: user.role,
        status: existingUser.status || 'ACTIVE',
        enrolledCourses: existingUser.enrolledCourses || []
      };

      if (userIndex >= 0) {
        users[userIndex] = legacyUser;
      } else {
        users.push(legacyUser);
      }

      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (error) {
      console.warn('Unable to sync legacy user cache:', error);
    }
  }

  function clearSession() {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('currentUser');
    window.currentUser = null;
  }

  function redirectToLogin(message) {
    if (message) alert(message);
    window.location.href = LOGIN_PATH;
  }

  window.authGuardReady = (async function () {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      clearSession();
      redirectToLogin('Please log in to continue.');
      return null;
    }

    try {
      const response = await fetch(API_PROFILE_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        clearSession();
        redirectToLogin('Your session has expired. Please log in again.');
        return null;
      }

      const currentUser = normalizeProfile(await response.json());
      cacheCurrentUser(currentUser);
      return currentUser;
    } catch (error) {
      console.error('Auth Guard Connection Error:', error);
      const cachedUser = sessionStorage.getItem('currentUser');
      if (cachedUser) {
        const currentUser = JSON.parse(cachedUser);
        window.currentUser = currentUser;
        populateUserData(currentUser);
        return currentUser;
      }
      return null;
    }
  })();

  window.getCurrentUser = async function () {
    if (window.authGuardReady) return window.authGuardReady;
    if (window.currentUser) return window.currentUser;

    const cachedUser = sessionStorage.getItem('currentUser');
    return cachedUser ? JSON.parse(cachedUser) : null;
  };
})();

function populateUserData(user) {
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const setSrc = (id, src) => {
    const el = document.getElementById(id);
    if (el) el.src = src;
  };

  const formattedRole = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&color=fff&size=36`;

  setText('user-greeting-topbar', `Hi, ${user.fullname}`);
  setText('user-role-topbar', formattedRole);
  setSrc('user-avatar-topbar', avatarUrl);

  setText('user-fullname-sidebar', user.fullname);
  setText('user-role-sidebar', formattedRole);
  setSrc('user-avatar-sidebar', avatarUrl);
}
