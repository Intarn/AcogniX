// frontend/src/pages/admin/SettingsPage.jsx
import { useState } from 'react';
import { updateLLMKey } from '../../services/infrastructureService';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  const handleLogout = () => {
    // 1. Xóa thông tin xác thực lưu trong localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    
    // 2. Ép trình duyệt reload lại trang và chuyển hướng về đăng nhập
    window.location.href = '/auth/login';
  };

  // Hàm xử lý lưu API Key
  const handleSaveAIConfig = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setStatusMsg({ text: 'API Key không được để trống.', type: 'error' });
      return;
    }

    try {
      setIsUpdating(true);
      setStatusMsg({ text: '', type: '' });
      await updateLLMKey(apiKey.trim());
      setStatusMsg({ text: 'Lưu cấu hình AI thành công!', type: 'success' });
      setApiKey(''); // Xóa field cho an toàn sau khi lưu
    } catch (err) {
      setStatusMsg({ text: err.message || 'Lỗi khi cập nhật API Key.', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">System Settings</h1>
      </header>

      <main className="p-6 overflow-y-auto max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          
          {/* Maintenance Mode (Giữ nguyên của bạn) */}
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

          {/* AI Configuration (Được bọc thành Form) */}
          <form onSubmit={handleSaveAIConfig}>
            <h3 className="text-sm font-bold text-gray-800 mb-2">AI Configuration</h3>
            <label className="block text-xs text-gray-700 mb-1">Google Gemini API Key</label>
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="************************" 
              className="w-full bg-gray-50 text-sm rounded-lg px-4 py-2 border border-gray-200 outline-none focus:border-blue-300" 
            />
            <p className="text-[10px] text-gray-400 mt-1 mb-3">Leave blank to use environment default.</p>

            {/* Hiển thị thông báo lỗi/thành công */}
            {statusMsg.text && (
              <p className={`text-xs font-semibold mb-3 ${statusMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {statusMsg.text}
              </p>
            )}

            <div className="pt-2">
              <button 
                type="submit"
                disabled={isUpdating}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm disabled:opacity-50"
              >
                {isUpdating ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>

          <hr className="border-gray-100" />

          {/* Khu vực Logout */}
          <div>
            <h3 className="text-sm font-bold text-red-600 mb-1">Account Session</h3>
            <p className="text-xs text-gray-500 mb-3">Log out of your current system administration session.</p>
            <button
              onClick={handleLogout}
              className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-5 py-2 rounded-lg shadow-sm transition-colors border border-red-200"
            >
              Logout
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}