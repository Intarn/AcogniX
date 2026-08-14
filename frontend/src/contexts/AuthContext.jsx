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

  // 1. Tải lại / Khôi phục thông tin người dùng từ API hoặc localStorage
  async function refreshUser() {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('currentUser');

    if (!token && !storedUser) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      // Ưu tiên gọi API lấy profile thực tế nếu có token
      if (token && typeof getProfile === 'function') {
        const result = await getProfile();
        const profile = result?.profile || result?.user || result;
        if (profile) {
          const normalizedProfile = {
            ...profile,
            fullname: profile.displayName || profile.fullname || '',
            role: String(profile.role || 'LEARNER').toLowerCase()
          };

          localStorage.setItem('currentUser', JSON.stringify(normalizedProfile));
          setUser(normalizedProfile);
          setLoading(false);
          return normalizedProfile;
        }
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      localStorage.removeItem('accessToken');
    }

    // Dự phòng: Khôi phục từ localStorage nếu không gọi được API profile
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const normalizedUser = {
          ...parsedUser,
          role: String(parsedUser.role || 'LEARNER').toLowerCase()
        };

        setUser(normalizedUser);
        setLoading(false);
        return normalizedUser;
      } catch (e) {
        console.error('Failed to parse user session', e);
        localStorage.removeItem('currentUser');
      }
    }

    setUser(null);
    setLoading(false);
    return null;
  }

  // 2. Xử lý Đăng nhập
  const login = async (email, password) => {
    try {
      let data;
      if (typeof loginRequest === 'function') {
        data = await loginRequest(email, password);
      } else {
        data = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      }

      const token = data?.token || data?.accessToken || data?.session?.access_token;

      if (token) {
        localStorage.setItem('accessToken', token);
      }

      const userRole = String(
        data?.userRole || data?.user?.role || 'LEARNER'
      ).toLowerCase();

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

      localStorage.setItem('currentUser', JSON.stringify(userData));

      const profile = await refreshUser();
      if (!profile) {
        setUser(userData);
      }

      return {
        success: true,
        role: userRole,
        ...data
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Login failed'
      };
    }
  };

  // 3. Xử lý Đăng ký
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
        }),
      });

      return {
        success: true,
        role: formattedRole.toLowerCase(),
        ...data
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Registration failed'
      };
    }
  };

  // 4. Xử lý Đăng xuất
  const logout = async () => {
    try {
      if (typeof logoutRequest === 'function') {
        await logoutRequest();
      } else {
        await apiRequest('/auth/logout', { method: 'POST' });
      }
    } catch (e) {
      console.error("Logout API error:", e);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('currentUser');
      setUser(null);
    }
  };

  // 5. Cập nhật thông tin user trong State & localStorage (Chỉ khai báo 1 lần)
  const updateUser = (newFields) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        ...newFields,
        fullname: newFields.displayName || newFields.fullname || prev.fullname || prev.displayName
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
        updateUser, // Đã thêm vào Provider value
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