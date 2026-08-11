import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import DashboardPage from '../pages/admin/DashboardPage';
import UserManagementPage from '../pages/admin/UserManagementPage';
import AddUserPage from '../pages/admin/AddUserPage';
import EditUserPage from '../pages/admin/EditUserPage';
import CourseManagementPage from '../pages/admin/CourseManagementPage';
import CourseDetailPage from '../pages/admin/CourseDetailPage';
import CommunityManagementPage from '../pages/admin/CommunityManagementPage';
import AnalyticsPage from '../pages/admin/AnalyticsPage';
import SettingsPage from '../pages/admin/SettingsPage';


export const adminRoutes = {
  path: '/admin',
  element: (
    <ProtectedRoute allowedRoles={['SYSTEM_ADMINISTRATOR']}>
      <AdminLayout />
    </ProtectedRoute>
  ),
  children: [
    { index: true, element: <DashboardPage /> },
    { path: 'dashboard', element: <DashboardPage /> },
    { path: 'users', element: <UserManagementPage /> },
    { path: 'users/add', element: <AddUserPage /> },
    { path: 'users/:userId/edit', element: <EditUserPage /> },
    { path: 'courses', element: <CourseManagementPage /> },
    { path: 'courses/:courseId', element: <CourseDetailPage /> },
    { path: 'community', element: <CommunityManagementPage /> },
    { path: 'analytics', element: <AnalyticsPage /> },
    { path: 'settings', element: <SettingsPage /> },
  ]
};