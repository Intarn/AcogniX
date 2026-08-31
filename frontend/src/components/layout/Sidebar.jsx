// frontend/src/components/layout/Sidebar.jsx
import { Link, useLocation } from 'react-router-dom';

function Logo() {
  return (
    <Link to="/learner/dashboard" className="flex items-center gap-3.5 block hover:opacity-95 transition-opacity">
      <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 drop-shadow-sm">
        <defs>
          <linearGradient id="grad-leg" x1="50" y1="15" x2="80" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B3DFF" />
            <stop offset="100%" stopColor="#6B21FF" />
          </linearGradient>
          <linearGradient id="grad-left" x1="20" y1="85" x2="35" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00A3FF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="grad-swoosh" x1="25" y1="70" x2="95" y2="45" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C2FF" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#6B21FF" />
          </linearGradient>
        </defs>
        <path d="M 33 55 L 46 25 C 47.5 21.5 52.5 21.5 54 25 L 76 76" stroke="url(#grad-leg)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 22 80 L 26 70" stroke="url(#grad-left)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 26 65 C 50 78 70 70 92 48 C 65 68 45 74 24 73 Z" fill="url(#grad-swoosh)" />
      </svg>
      <div className="flex flex-col justify-center">
        <span className="text-[26px] font-black text-slate-900 tracking-tight leading-none font-sans">
          Acogni<span className="text-blue-600">X</span>
        </span>
        <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-widest leading-tight mt-1.5">
          Learner Portal
        </span>
      </div>
    </Link>
  );
}

export default function Sidebar({ user }) {
  const location = useLocation();
  const isActive = (path) => location.pathname.includes(path);

  const avatarSrc = user?.avatarUrl || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullname || user?.displayName || 'Learner')}&color=fff&background=2563eb&size=48`;

  const navLinks = [
    {
      path: '/learner/dashboard',
      label: 'Dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    },
    {
      path: '/learner/progress',
      label: 'Progress',
      icon: 'M3 3v18h18M7 16l4-4 3 3 5-6'
    },
    {
      path: '/learner/ai-workspace',
      label: 'AI Workspace',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z'
    },
    {
      path: '/learner/my-courses',
      label: 'My Courses',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
    },
    {
      path: '/learner/flashcards',
      label: 'Flashcards',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
    },
    {
      path: '/learner/ai-quizzes',
      label: 'AI Quizzes',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      path: '/learner/assessments',
      label: 'Assessments',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
    },
    {
      path: '/learner/notes',
      label: 'Personal Notes',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    }  ];

  return (
    <aside className="w-72 h-full min-h-0 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 shadow-sm z-10 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* BRAND HEADER */}
        <div className="p-7 border-b border-gray-100">
          <Logo />
        </div>

        {/* MAIN NAVIGATION */}
        <nav className="p-4 flex flex-col gap-2">
          {navLinks.map((item) => {
            const active = isActive(item.path) || (item.path === '/learner/dashboard' && location.pathname === '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                  active 
                    ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100/50' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <svg className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? "2.5" : "2"} d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-5 mt-3 border-t border-gray-100 flex flex-col gap-2">
            <span className="px-4 text-xs font-extrabold text-gray-400 uppercase tracking-widest block mb-1">
              Support & Settings
            </span>
            <Link
              to="/learner/support"
              className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                isActive('/learner/support')
                  ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100/50'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className={`w-5 h-5 flex-shrink-0 ${isActive('/learner/support') ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive('/learner/support') ? "2.5" : "2"} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Support Desk</span>
            </Link>
            <Link
              to="/learner/settings"
              className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                isActive('/learner/settings')
                  ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100/50'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className={`w-5 h-5 flex-shrink-0 ${isActive('/learner/settings') ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive('/learner/settings') ? "2.5" : "2"} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive('/learner/settings') ? "2.5" : "2"} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Profile Settings</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* FOOTER USER CARD */}
      <div className="p-5 border-t border-gray-100 bg-gray-50/30 flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <img 
            src={avatarSrc} 
            alt="Avatar" 
            className="w-11 h-11 rounded-full object-cover bg-gray-200 border border-gray-200 shadow-sm flex-shrink-0" 
          />
          <div className="text-left flex-1 overflow-hidden">
            <p className="text-sm font-bold text-gray-900 leading-tight truncate">
              {user?.fullname || user?.displayName || 'Learner'}
            </p>
            <p className="text-xs text-gray-500 capitalize mt-0.5">
              {user?.role || 'Learner'}
            </p>
          </div>
          <Link to="/learner/settings" className="ml-auto flex-shrink-0 p-2 rounded-xl hover:bg-gray-200 text-gray-400 transition-colors">
            <span className="text-sm">⚙️</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}