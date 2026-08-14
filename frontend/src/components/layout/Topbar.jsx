// frontend/src/components/layout/Topbar.jsx
export default function Topbar({ user }) {
  // Link avatar hiển thị: Ưu tiên user.avatarUrl -> Fallback về ui-avatars
  const avatarSrc = user?.avatarUrl || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullname || 'Guest')}&color=fff&size=32`;

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 flex-shrink-0">
      <div className="relative w-[480px]">
        <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          type="text" 
          placeholder="Search for files, chapters, quizzes..." 
          className="w-full bg-gray-50/80 text-xs rounded-full pl-10 pr-4 py-2 border border-gray-100 outline-none focus:bg-white focus:border-blue-300"
        />
      </div>

      <div className="flex items-center gap-5">
        <button className="relative p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
        <div className="flex items-center gap-3 cursor-pointer">
          <img 
            src={avatarSrc} 
            alt="Avatar" 
            className="w-8 h-8 rounded-full object-cover bg-gray-200 border border-gray-100 shadow-sm" 
          />
          <div className="text-left">
            <p className="text-xs font-bold text-gray-800 leading-tight">Hi, {user?.fullname}</p>
            <p className="text-[10px] text-gray-400 capitalize">{user?.role}</p>
          </div>
          <span className="text-gray-400 text-[10px]">▼</span>
        </div>
      </div>
    </header>
  );
}