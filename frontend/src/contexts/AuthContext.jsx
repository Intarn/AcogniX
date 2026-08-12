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
        /*
         * Tương thích linh hoạt các kiểu response profile:
         * trực tiếp, dưới dạng 'profile', hoặc 'user'
         */
        const profile = result?.profile || result?.user || result;
        if (profile) {
          const normalizedProfile = {
            ...profile,

            role:
              String(
                profile.role ||
                'LEARNER'
              ).toLowerCase()
          };


          localStorage.setItem(
            'currentUser',
            JSON.stringify(
              normalizedProfile
            )
          );


          setUser(
            normalizedProfile
          );

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
        const parsedUser =
          JSON.parse(
            storedUser
          );


        const normalizedUser = {
          ...parsedUser,

          role:
            String(
              parsedUser.role ||
              'LEARNER'
            ).toLowerCase()
        };


        setUser(
          normalizedUser
        );

        setLoading(false);


        return normalizedUser;
      } catch (e) {
        console.error(
          'Failed to parse user session',
          e
        );

        localStorage.removeItem(
          'currentUser'
        );
      }
    }

    setUser(null);
    setLoading(false);
    return null;
  }

  // 2. Xử lý Đăng nhập (Hợp nhất hỗ trợ đa định dạng Token & API)
  const login = async (email, password) => {
    try {
      let data;
      // Ưu tiên sử dụng authApi nếu có, nếu không fallback sang apiRequest
      if (typeof loginRequest === 'function') {
        data = await loginRequest(email, password);
        console.log(
          'LOGIN RESPONSE:',
          data
        );
      } else {
        data = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      }

      // Đọc Token tương thích với tất cả các dạng trả về từ Backend
      const token =
        data?.token ||
        data?.accessToken ||
        data?.session?.access_token;

      if (token) {
        localStorage.setItem('accessToken', token);
      }

      // Chuẩn hóa role về chữ thường (learner, educator, admin)
      const userRole =
      String(
        data?.userRole ||
        data?.user?.role ||
        'LEARNER'
      ).toLowerCase();

      console.log(
        'NORMALIZED LOGIN ROLE:',
        userRole
      );

      const userData = {
        ...(data?.user || {}),

        email:
          data?.user?.email ||
          email,

        role:
          userRole,

        fullname:
          data?.user?.displayName ||
          data?.user?.fullname ||
          email?.split('@')[0] ||
          '',

        redirectTo:
          data?.redirectTo ||
          '/'
      };

      localStorage.setItem('currentUser', JSON.stringify(userData));

      // Cập nhật trạng thái người dùng
      const profile = await refreshUser();

      console.log(
        'NORMALIZED LOGIN ROLE:',
        userRole
      );
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

  // 3. Xử lý Đăng ký (POST /api/auth/signup)
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

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
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