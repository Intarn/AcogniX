// frontend/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/apiClient';
import { finalizeActiveStudyTracking } from '../services/studyTrackingCoordinator';
import {
  getProfile,
  login as loginRequest,
  logout as logoutRequest
} from '../features/auth/authApi';

export const AuthContext = createContext(null);

function normalizeAuthenticatedUser(profile = {}, fallback = {}) {
  const displayName =
    profile.displayName ||
    profile.fullname ||
    fallback.displayName ||
    fallback.fullname ||
    fallback.email?.split('@')[0] ||
    '';

  return {
    ...fallback,
    ...profile,
    email: profile.email || fallback.email || '',
    displayName,
    fullname: displayName,
    avatarUrl: profile.avatarUrl || fallback.avatarUrl || '',
    role: String(profile.role || fallback.role || '').toLowerCase()
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore and validate an existing authenticated session.
  async function refreshUser() {
    const pendingLogoutToken = sessionStorage.getItem('pendingLogoutToken');
    if (pendingLogoutToken) {
      try {
        await apiRequest('/auth/logout', { method: 'POST', authToken: pendingLogoutToken });
        sessionStorage.removeItem('pendingLogoutToken');
      } catch (error) {
        // Remain logged out locally and retry revocation on the next refresh.
        console.warn('Deferred logout revocation is still pending:', error);
      }
      localStorage.removeItem('accessToken');
      localStorage.removeItem('currentUser');
      setUser(null);
      setLoading(false);
      return null;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      // A cached user without a token is not an authenticated session.
      localStorage.removeItem('currentUser');
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const result = await getProfile();
      const profile = result?.profile || result?.user || result;

      if (!profile) {
        throw new Error('PROFILE_NOT_FOUND');
      }

      const normalizedProfile = normalizeAuthenticatedUser(profile);

      if (!normalizedProfile.role) {
        throw new Error('ROLE_NOT_FOUND');
      }

      localStorage.setItem('currentUser', JSON.stringify(normalizedProfile));
      setUser(normalizedProfile);
      setLoading(false);
      return normalizedProfile;
    } catch (error) {
      console.error('Failed to restore authenticated session:', error);

      // Never treat localStorage alone as proof of authentication.
      localStorage.removeItem('accessToken');
      localStorage.removeItem('currentUser');
      setUser(null);
      setLoading(false);
      return null;
    }
  }

  // UC21 - Log In
  const login = async (email, password) => {
    try {
      const data = typeof loginRequest === 'function'
        ? await loginRequest(email, password)
        : await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
          });

      const token = data?.token || data?.accessToken || data?.session?.access_token;
      const rawRole = data?.userRole || data?.user?.role;

      if (!token || !rawRole) {
        return {
          success: false,
          status: 500,
          code: 'SESSION_CREATION_FAILED',
          error: 'Unable to log in at this time. Please try again.'
        };
      }

      const userRole = String(rawRole).toLowerCase();
      const loginUser = {
        ...(data?.user || {}),
        email: data?.user?.email || email,
        role: userRole,
        displayName:
          data?.user?.displayName ||
          data?.user?.fullname ||
          email?.split('@')[0] ||
          '',
        avatarUrl: data?.user?.avatarUrl || '',
        redirectTo: data?.redirectTo || '/'
      };

      // Store the token before requesting /profile because apiRequest reads the
      // bearer token from localStorage. Hydrating the profile here gives every
      // layout (Topbar + Sidebar) the same displayName/avatar on the very first
      // render after login instead of waiting for a browser refresh.
      localStorage.setItem('accessToken', token);

      let userData = normalizeAuthenticatedUser({}, loginUser);
      try {
        const profileResult = await getProfile();
        const profile =
          profileResult?.profile ||
          profileResult?.user ||
          profileResult;

        if (profile) {
          userData = normalizeAuthenticatedUser(profile, loginUser);
        }
      } catch (profileError) {
        // Authentication already succeeded. Keep the valid login session and
        // fall back to the login payload if profile hydration is temporarily
        // unavailable.
        console.warn('Unable to hydrate profile immediately after login:', profileError);
      }

      localStorage.setItem('currentUser', JSON.stringify(userData));
      setUser(userData);

      return {
        ...data,
        success: true,
        role: userData.role || userRole,
        userRole: rawRole,
        user: userData
      };
    } catch (error) {
      // Preserve backend status/code/message so Login.jsx can display the
      // exact expected message for each UC21 alternative flow.
      return {
        success: false,
        status: error?.status,
        code: error?.code,
        error: error?.message || 'Unable to log in at this time. Please try again.'
      };
    }
  };

  // UC20 - Sign Up
  const register = async (email, password, displayName, role) => {
    try {
      const formattedRole = role ? role.toUpperCase() : 'LEARNER';

      const data = await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          displayName,
          role: formattedRole
        })
      });

      return {
        success: true,
        role: formattedRole.toLowerCase(),
        ...data
      };
    } catch (error) {
      return {
        success: false,
        status: error?.status,
        code: error?.code,
        error: error?.message || 'Registration failed'
      };
    }
  };

  // UC22 - Log Out
  const logout = async () => {
    const token = localStorage.getItem('accessToken');

    // UC03-UI05: finalize Study Sessions while authentication is still valid.
    // A tracking persistence error must not prevent the user from logging out.
    try {
      await finalizeActiveStudyTracking('logout');
    } catch (trackingError) {
      console.warn('Unable to finalize Study Session during logout:', trackingError);
    }

    try {
      if (typeof logoutRequest === 'function') {
        await logoutRequest();
      } else {
        await apiRequest('/auth/logout', { method: 'POST' });
      }
      sessionStorage.removeItem('pendingLogoutToken');
    } catch (e) {
      console.error('Logout API error:', e);
      // UC22-UI04: clear authentication locally immediately, but keep the old
      // token only in sessionStorage so revocation can be retried after network
      // recovery without restoring the previous authenticated UI.
      if (token) sessionStorage.setItem('pendingLogoutToken', token);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('currentUser');
      setUser(null);
    }
  };


  const updateUser = (newFields) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        ...newFields,
        fullname:
          newFields.displayName ||
          newFields.fullname ||
          prev.fullname ||
          prev.displayName
      };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        updateUser,
        loading,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
