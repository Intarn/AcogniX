import { NavLink } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

export default function AdminSidebar() {
  const { user } = useAuth();
  const avatarUrl = user ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&color=fff&size=36` : '';
  
  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
      isActive
        ? 'font-semibold bg-blue-50 text-blue-600'
        : 'font-medium text-gray-500 hover:bg-gray-50'
    }`;

  return (
    <aside className="w-60 h-full bg-white border-r border-gray-100 flex flex-col justify-between flex-shrink-0">
      <div>
        <div className="p-6 flex items-center gap-2.5">
          <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="grad-leg" x1="50" y1="15" x2="80" y2="85" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#8B3DFF"/><stop offset="100%" stopColor="#6B21FF"/></linearGradient>
              <linearGradient id="grad-left" x1="20" y1="85" x2="35" y2="50" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00A3FF"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient>
              <linearGradient id="grad-swoosh" x1="25" y1="70" x2="95" y2="45" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00C2FF"/><stop offset="50%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#6B21FF"/></linearGradient>
            </defs>
            <path d="M 33 55 L 46 25 C 47.5 21.5 52.5 21.5 54 25 L 76 76" stroke="url(#grad-leg)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 22 80 L 26 70" stroke="url(#grad-left)" strokeWidth="14" strokeLinecap="round" />
            <path d="M 26 65 C 50 78 70 70 92 48 C 65 68 45 74 24 73 Z" fill="url(#grad-swoosh)" />
          </svg>
          <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">AcogniX</span>
        </div>
        <nav className="px-3 flex flex-col gap-1.5">
          <NavLink to="/admin/dashboard" className={navLinkClass}>Dashboard</NavLink>
          <NavLink to="/admin/users" className={navLinkClass}>User Management</NavLink>
          <NavLink to="/admin/courses" className={navLinkClass}>Course Management</NavLink>
          <NavLink to="/admin/community" className={navLinkClass}>Community</NavLink>
          <NavLink to="/admin/analytics" className={navLinkClass}>Analytics</NavLink>
          <NavLink to="/admin/settings" className={navLinkClass}>System Settings</NavLink>
        </nav>
      </div>
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <img src={avatarUrl} className="w-9 h-9 rounded-full object-cover bg-gray-200" alt="Avatar" />
          <div className="text-left flex-1 overflow-hidden">
            <p className="text-xs font-bold text-gray-800 leading-tight truncate">{user?.displayName || 'Admin'}</p>
            <p className="text-[10px] text-gray-400">System Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}