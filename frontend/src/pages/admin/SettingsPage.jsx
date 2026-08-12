// frontend/src/pages/admin/SettingsPage.jsx
export default function SettingsPage() {
  const handleLogout = () => {
    // 1. Xóa thông tin xác thực lưu trong localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    
    // 2. Ép trình duyệt reload lại trang và chuyển hướng về đăng nhập
    window.location.href = '/auth/login';
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">System Settings</h1>
      </header>

      <main className="p-6 overflow-y-auto max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">Maintenance Mode</h3>
            <p className="text-xs text-gray-500 mb-3">Enable this to prevent non-admins from logging in.</p>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700">System Offline</span>
            </label>
          </div>
          
          <hr className="border-gray-100" />

          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">AI Configuration</h3>
            <label className="block text-xs text-gray-700 mb-1">Google Gemini API Key</label>
            <input type="password" placeholder="************************" className="w-full bg-gray-50 text-sm rounded-lg px-4 py-2 border border-gray-200 outline-none focus:border-blue-300" />
            <p className="text-[10px] text-gray-400 mt-1">Leave blank to use environment default.</p>
          </div>

          <div className="pt-2">
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm">
              Save Settings
            </button>
          </div>

          <hr className="border-gray-100" />

          {/* Khu vực Logout */}
          <div>
            <h3 className="text-sm font-bold text-red-600 mb-1">Account Session</h3>
            <p className="text-xs text-gray-500 mb-3">Đăng xuất khỏi phiên quản trị hệ thống hiện tại của bạn.</p>
            <button
              onClick={handleLogout}
              className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-5 py-2 rounded-lg shadow-sm transition-colors border border-red-200"
            >
              Đăng xuất (Logout)
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}