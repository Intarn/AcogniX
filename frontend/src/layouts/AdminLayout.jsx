import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AdminSidebar from '../components/layout/AdminSidebar';

export default function AdminLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans overflow-hidden text-gray-800">
      <AdminSidebar />
      <div className="flex-1 h-full min-h-0 overflow-hidden">
        <Outlet context={{ user }} />
      </div>
    </div>
  );
}
