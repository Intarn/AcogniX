import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import EducatorSidebar from '../components/layout/EducatorSidebar';
import Topbar from '../components/layout/Topbar';

export default function EducatorLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  const userInfo = {
    ...user,
    displayName:
      user.displayName ||
      user.fullname ||
      user.email?.split('@')[0] ||
      'Educator',
    fullname:
      user.displayName ||
      user.fullname ||
      user.email?.split('@')[0] ||
      'Educator',
    avatarUrl: user.avatarUrl || '',
    role: user.role || 'educator'
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans overflow-hidden text-gray-800">
      <EducatorSidebar />
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        <Topbar user={userInfo} />
        <Outlet />
      </div>
    </div>
  );
}
