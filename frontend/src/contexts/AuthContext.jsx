// frontend/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/apiClient';
import {
  getProfile,
  login as loginRequest,
  logout as logoutRequest
} from '../features/auth/authApi';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore and validate an existing authenticated session.
  async function refreshUser() {
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

      const normalizedProfile = {
        ...profile,
        fullname: profile.displayName || profile.fullname || '',
        role: String(profile.role || '').toLowerCase()
      };

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

      const userData = {
        ...(data?.user || {}),
        email: data?.user?.email || email,
        role: userRole,
        fullname:
          data?.user?.displayName ||
          data?.user?.fullname ||
          email?.split('@')[0] ||
          '',
        avatarUrl: data?.user?.avatarUrl || '',
        redirectTo: data?.redirectTo || '/'
      };

      localStorage.setItem('accessToken', token);
      localStorage.setItem('currentUser', JSON.stringify(userData));
      setUser(userData);

      return {
        success: true,
        role: userRole,
        userRole: rawRole,
        ...data
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
    try {
      if (typeof logoutRequest === 'function') {
        await logoutRequest();
      } else {
        await apiRequest('/auth/logout', { method: 'POST' });
      }
    } catch (e) {
      console.error('Logout API error:', e);
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
