// frontend/src/components/layout/Topbar.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

function TopbarAvatar({ user }) {
  const [imgError, setImgError] = useState(false);
  const displayName = user?.displayName || user?.fullname || user?.email || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    setImgError(false);
  }, [user?.avatarUrl]);

  if (user?.avatarUrl && !imgError) {
    return (
      <img
        src={user.avatarUrl}
        alt={displayName}
        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs ring-1 ring-gray-200"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black shadow-xs ring-1 ring-blue-100">
      {initial}
    </div>
  );
}

export default function Topbar({ user }) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const displayName = user?.displayName || user?.fullname || user?.email?.split('@')[0] || 'User';
  const roleName = user?.role || 'Member';

  const settingsPath =
    roleName.toLowerCase().includes('admin') ? '/admin/settings' :
    roleName.toLowerCase().includes('educator') ? '/educator/settings' : '/learner/settings';

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 flex-shrink-0 z-20 shadow-xs">
      <div className="flex items-center gap-3.5">
        <div className="w-2.5 h-8 bg-blue-600 rounded-full"></div>
        <div>
          <h1 className="text-base font-black text-gray-900 tracking-tight leading-tight">
            Welcome back, <span className="text-blue-600">{displayName}</span> 👋
          </h1>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">
            Have a productive and successful day ahead!
          </p>
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setProfileMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
          className="flex items-center gap-3.5 p-2 rounded-2xl hover:bg-gray-50/80 transition-all border border-transparent hover:border-gray-100 group"
        >
          <TopbarAvatar user={user} />
          <div className="text-left hidden md:block">
            <p className="text-xs font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
              {displayName}
            </p>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mt-0.5">
              {roleName.replace('_', ' ')}
            </p>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ml-1 hidden md:block ${profileMenuOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {profileMenuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-100 bg-white p-2 shadow-lg"
          >
            <div className="px-3 py-2 border-b border-gray-100 mb-1 md:hidden">
              <p className="text-xs font-bold text-gray-900 truncate">{displayName}</p>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-wide mt-0.5">
                {roleName.replace('_', ' ')}
              </p>
            </div>
            <Link
              to={settingsPath}
              role="menuitem"
              onClick={() => setProfileMenuOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <span>My Profile</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
