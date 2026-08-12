// frontend/src/pages/auth/Settings.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getUserProfile, updateUserProfile } from '../../services/profileService';

export default function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    displayName: '',
    email: '',
    bio: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Tải thông tin profile từ Backend (/api/profile)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const data = await getUserProfile();
        // data.profile chứa thông tin user từ Supabase[cite: 9]
        const userObj = data?.profile || data;
        setProfile({
          displayName: userObj.displayName || userObj.fullname || '',
          email: userObj.email || '',
          bio: userObj.bio || ''
        });
      } catch (err) {
        console.error("Không thể tải profile từ backend:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setMessage(null);
      await updateUserProfile(profile);
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
      setMessage({ type: 'error', text: 'Cập nhật thất bại. Vui lòng thử lại.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý Đăng xuất
  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <p className="text-sm text-gray-500">Đang đồng bộ dữ liệu từ Backend...</p>
      </div>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto bg-gray-50">
      <div className="max-w-xl mx-auto bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-6">
        <h1 className="text-xl font-bold text-gray-800">Account Settings</h1>

        {message && (
          <div className={`p-3 rounded-lg text-xs font-semibold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Display Name</label>
            <input 
              type="text" 
              value={profile.displayName}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email (Read-only)</label>
            <input 
              type="email" 
              value={profile.email}
              disabled
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Bio / Giới thiệu bản thân</label>
            <textarea 
              rows="3"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              placeholder="Nhập thông tin giới thiệu..."
            />
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {submitting ? 'Đang lưu thay đổi...' : 'Lưu thay đổi'}
          </button>
        </form>

        {/* Khối Đăng Xuất */}
        <div className="pt-4 border-t border-gray-100">
          <button 
            type="button"
            onClick={handleLogout}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs py-2.5 rounded-xl transition border border-red-100 flex items-center justify-center gap-2"
          >
            🚪 Đăng xuất khỏi tài khoản
          </button>
        </div>
      </div>
    </main>
  );
}