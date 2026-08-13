import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/layout/AdminSidebar';

export default function AdminLayout() {
  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans overflow-hidden text-gray-800">
      <AdminSidebar />

      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}