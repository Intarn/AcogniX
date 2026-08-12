// frontend/src/routes/router.jsx
import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Layouts & Protected Route
import AppLayout from '../layouts/AppLayout'; // Layout chung
import LearnerLayout from '../layouts/LearnerLayout';
import EducatorLayout from '../layouts/EducatorLayout';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from './ProtectedRoute';

// Pages
import LoginPage from '../pages/auth/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import LearnerDashboard from '../pages/learner/Dashboard';
import CourseDetail from '../pages/learner/CourseDetail'; // File này đã có
import EducatorDashboard from '../pages/educator/Dashboard';
import AdminDashboard from '../pages/admin/Dashboard';
import CommunityPage from "../pages/shared/CommunityPage";

/**
 * Component này điều hướng người dùng đến dashboard phù hợp
 * với vai trò của họ ngay sau khi đăng nhập.
 */
const RoleBasedRedirect = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'learner':
      return <Navigate to="/learner/dashboard" replace />;
    case 'educator':
      return <Navigate to="/educator/dashboard" replace />;
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <ProtectedRoute />, // Bảo vệ trang chủ
        children: [{ index: true, element: <RoleBasedRedirect /> }],
      },
      // --- Nhóm Route cho LEARNER ---
      {
        element: <ProtectedRoute allowedRoles={['learner']} />,
        children: [
          {
            path: 'learner',
            element: <LearnerLayout />,
            children: [
              { path: 'dashboard', element: <LearnerDashboard /> },
              { path: 'course', element: <CourseDetail /> },
              { path: 'community', element: <CommunityPage /> },
            ],
          },
        ],
      },
      // --- Nhóm Route cho EDUCATOR ---
      {
        element: <ProtectedRoute allowedRoles={['educator']} />,
        children: [
          {
            path: 'educator',
            element: <EducatorLayout />,
            children: [{ path: 'dashboard', element: <EducatorDashboard /> }, { path: 'community', element: <CommunityPage /> }],
          },
        ],
      },
      // --- Nhóm Route cho ADMIN ---
      {
        element: <ProtectedRoute allowedRoles={['admin']} />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [{ path: 'dashboard', element: <AdminDashboard /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);