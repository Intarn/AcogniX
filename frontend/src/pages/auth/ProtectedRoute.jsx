// frontend/src/routes/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Hiển thị một component loading trong khi chờ xác thực
    return <div>Đang kiểm tra quyền truy cập...</div>;
  }

  // Nếu người dùng chưa đăng nhập, chuyển hướng đến trang login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Nếu route yêu cầu vai trò cụ thể và vai trò người dùng không khớp
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Chuyển hướng về trang chủ, nơi sẽ có logic điều hướng tiếp
    return <Navigate to="/" replace />;
  }

  // Nếu mọi thứ đều hợp lệ, hiển thị nội dung của route con
  return <Outlet />;
};

export default ProtectedRoute;