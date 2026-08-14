// frontend/src/components/layout/Topbar.jsx
import NotificationPopover from '../common/NotificationPopover';

export default function Topbar({ user }) {
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 z-30">
      {/* Bên trái: Breadcrumb / Tiêu đề chào mừng */}
      <div>
        <h2 className="text-sm font-bold text-gray-800">
          Xin chào, {user?.fullname || 'Learner'}! 👋
        </h2>
        <p className="text-[11px] text-gray-400">
          Chúc bạn có một buổi học hiệu quả trên AcogniX.
        </p>
      </div>

      {/* Bên phải: Nút Thông báo + Profile User */}
      <div className="flex items-center gap-4">
        {/* POPUP THÔNG BÁO HỆ THỐNG */}
        <NotificationPopover />

        <div className="h-6 w-px bg-gray-200" />

        {/* Thông tin User & Avatar */}
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullname}
              className="w-9 h-9 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
              {user?.fullname?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-gray-800 leading-tight">
              {user?.fullname}
            </p>
            <p className="text-[10px] text-gray-400 font-semibold capitalize">
              {user?.role}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}