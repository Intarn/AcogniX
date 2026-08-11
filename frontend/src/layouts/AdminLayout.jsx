// frontend/src/layouts/AdminLayout.jsx
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    window.location.href = '/auth/login';
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-black text-blue-600 tracking-wider">AcogniX Admin</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto text-sm font-semibold">
          <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            Dashboard
          </Link>
          <Link to="/admin/users" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            User Management
          </Link>
          <Link to="/admin/courses" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            Course Management
          </Link>
          <Link to="/admin/community" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            Community Q&A
          </Link>
          <Link to="/admin/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            Analytics
          </Link>
          <Link to="/admin/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            Settings
          </Link>
        </nav>

        {/* Góc thông tin người dùng ở dưới Sidebar */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {user?.fullName?.charAt(0) || 'A'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-gray-800 truncate">{user?.fullName || 'Administrator'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email || 'admin@acognix.com'}</p>
            </div>
          </div>

          {/* Nút biểu tượng bánh răng dẫn đến Settings */}
          <Link
            to="/admin/settings"
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors flex-shrink-0"
            title="Cài đặt hệ thống"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}