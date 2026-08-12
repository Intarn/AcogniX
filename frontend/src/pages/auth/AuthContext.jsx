// src/contexts/AuthContext.jsx
import { createContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/apiClient';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session khi reload trang
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('accessToken');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
      }
    }
    setLoading(false);
  }, []);

  // HÀM LOGIN CHUẨN
  const login = async (email, password) => {
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Nếu không có token trả về -> Coi như thất bại
      if (!data || !data.token) {
        throw new Error('Đăng nhập thất bại. Không nhận được mã xác thực.');
      }

      // Lưu Session
      localStorage.setItem('accessToken', data.token);
      
      const userInfo = { 
        email, 
        role: data.userRole || 'LEARNER',
        token: data.token 
      };
      
      setUser(userInfo);
      localStorage.setItem('currentUser', JSON.stringify(userInfo));

      return data.userRole; // Trả về role để Login.jsx điều hướng
    } catch (err) {
      // QUAN TRỌNG: BẮT BUỘC PHẢI THROW LỖI RA NGOÀI ĐỂ Login.jsx CÓ THỂ CATCH VÀ BÁO TOAST ERROR
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}