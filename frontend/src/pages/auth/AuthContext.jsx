// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiRequest } from '../services/apiClient'; // apiClient để gọi backend

// Tạo Context
const AuthContext = createContext(null);

// Tạo Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Bắt đầu với trạng thái loading

  useEffect(() => {
    // Hàm này sẽ được gọi khi ứng dụng tải lần đầu để kiểm tra session
    const validateSession = async () => {
      try {
        // Backend cần có một endpoint (ví dụ: /api/auth/session) để xác thực token
        // và trả về thông tin user nếu hợp lệ.
        const sessionUser = await apiRequest('/auth/session', { method: 'GET' });
        if (sessionUser) {
          setUser(sessionUser); // Lưu thông tin user (bao gồm cả role)
        }
      } catch (error) {
        console.log('Không tìm thấy session hợp lệ.');
        setUser(null);
      } finally {
        setLoading(false); // Kết thúc loading
      }
    };

    validateSession();
  }, []);

  // Hàm đăng nhập
  const login = async (email, password) => {
    const sessionData = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(sessionData.user); // Giả sử backend trả về { user: {..., role: '...'} }
    return sessionData.user;
  };

  // Hàm đăng xuất
  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const value = { user, loading, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook để sử dụng AuthContext dễ dàng hơn
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};