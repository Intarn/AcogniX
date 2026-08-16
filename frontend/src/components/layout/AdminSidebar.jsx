// frontend/src/components/layout/AdminSidebar.jsx
import { NavLink } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

export default function AdminSidebar() {
  const { user } = useAuth();
  const avatarUrl = user
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&color=fff&size=36`
    : '';

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
          <svg width="34" height="34" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="admin-grad-leg" x1="50" y1="15" x2="80" y2="85" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#8B3DFF"/><stop offset="100%" stopColor="#6B21FF"/></linearGradient>
              <linearGradient id="admin-grad-left" x1="20" y1="85" x2="35" y2="50" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00A3FF"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient>
              <linearGradient id="admin-grad-swoosh" x1="25" y1="70" x2="95" y2="45" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00C2FF"/><stop offset="50%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#6B21FF"/></linearGradient>
            </defs>
            <path d="M 33 55 L 46 25 C 47.5 21.5 52.5 21.5 54 25 L 76 76" stroke="url(#admin-grad-leg)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 22 80 L 26 70" stroke="url(#admin-grad-left)" strokeWidth="14" strokeLinecap="round" />
            <path d="M 26 65 C 50 78 70 70 92 48 C 65 68 45 74 24 73 Z" fill="url(#admin-grad-swoosh)" />
          </svg>
          <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">AcogniX</span>
        </div>

        <nav className="px-3 flex flex-col gap-1.5">
          <NavLink to="/admin/dashboard" className={navLinkClass}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7m-9 1v7m-4 0h8" /></svg>
            Dashboard
          </NavLink>
          <NavLink to="/admin/users" className={navLinkClass}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m6-10a4 4 0 100-8 4 4 0 000 8zm8-3a3 3 0 110 6m0-6a3 3 0 010 6m0 4h3a2 2 0 012 2v1" /></svg>
            User Management
          </NavLink>
          <NavLink to="/admin/courses" className={navLinkClass}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332 1.253" /></svg>
            Course Management
          </NavLink>
          {/* Đã xóa mục Community tại đây */}
          <NavLink to="/admin/analytics" className={navLinkClass}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            Monitor Infrastructure
          </NavLink>
          <NavLink to="/admin/tickets" className={navLinkClass}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            Support Tickets
          </NavLink>
        </nav>
      </div>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <img src={avatarUrl} className="w-9 h-9 rounded-full object-cover bg-gray-200" alt="Avatar" />
          <div className="text-left flex-1 min-w-0 overflow-hidden">
            <p className="text-xs font-bold text-gray-800 leading-tight truncate">{user?.displayName || 'Admin'}</p>
            <p className="text-[10px] text-gray-400">System Admin</p>
          </div>
          <NavLink
            to="/admin/settings"
            aria-label="System Settings"
            title="System Settings"
            className="ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.573-1.066z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}