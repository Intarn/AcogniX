// frontend/src/pages/auth/Settings.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { getUserProfile, updateUserProfile, changePassword } from '../../services/profileService';

export default function Settings() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const fileInputRef = useRef(null);

  // Tab State: 'profile' | 'security' | 'notifications'
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    role: '',
    avatarUrl: '',
    avatarFile: null,
    avatarPreview: ''
  });

  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notificationForm, setNotificationForm] = useState({
    emailNotifications: true,
    pushNotifications: false
  });

  // Tải dữ liệu Profile từ Server khi vào trang
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        const res = await getUserProfile();
        const p = res.profile || res;

        setProfileForm({
          displayName: p.displayName || user?.displayName || '',
          email: p.email || user?.email || '',
          role: p.role || user?.role || 'LEARNER',
          avatarUrl: p.avatarUrl || user?.avatarUrl || '',
          avatarFile: null,
          avatarPreview: ''
        });
      } catch (err) {
        // Fallback lấy dữ liệu tạm từ Auth Context nếu gọi API lỗi
        setProfileForm({
          displayName: user?.displayName || user?.name || '',
          email: user?.email || '',
          role: user?.role || 'LEARNER',
          avatarUrl: user?.avatarUrl || '',
          avatarFile: null,
          avatarPreview: ''
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  // Xử lý khi chọn ảnh đại diện mới
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Kích thước ảnh đại diện không được vượt quá 5MB.', 'error');
      return;
    }

    setProfileForm((prev) => ({
      ...prev,
      avatarFile: file,
      avatarPreview: URL.createObjectURL(file)
    }));
  };

  // Submit Tab Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.displayName.trim()) {
      showToast('Họ và tên không được để trống.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await updateUserProfile(
        profileForm.displayName.trim(),
        profileForm.avatarFile
      );

      showToast('Cập nhật thông tin cá nhân thành công!', 'success');
      setProfileForm((prev) => ({
        ...prev,
        avatarUrl: res.profile?.avatarUrl || prev.avatarUrl,
        avatarFile: null
      }));
    } catch (err) {
      showToast(err.message || 'Không thể cập nhật thông tin.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Tab Security
  const handleSaveSecurity = async (e) => {
    e.preventDefault();
    if (!securityForm.currentPassword || !securityForm.newPassword) {
      showToast('Vui lòng nhập đầy đủ thông tin mật khẩu.', 'warning');
      return;
    }

    if (securityForm.newPassword !== securityForm.confirmPassword) {
      showToast('Mật khẩu xác nhận không trùng khớp.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await changePassword(securityForm.currentPassword, securityForm.newPassword);
      showToast('Đổi mật khẩu thành công!', 'success');
      setSecurityForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.message || 'Đổi mật khẩu thất bại.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Tab Notifications
  const handleSaveNotifications = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      // Giả lập lưu cài đặt thông báo
      setTimeout(() => {
        showToast('Đã lưu cấu hình thông báo!', 'success');
        setSubmitting(false);
      }, 500);
    } catch (err) {
      showToast('Lưu cài đặt thất bại.', 'error');
      setSubmitting(false);
    }
  };

  // Đăng xuất tài khoản
  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Xác nhận Đăng Xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất tài khoản khỏi thiết bị này?',
      confirmLabel: 'Đăng xuất',
      cancelLabel: 'Hủy',
      tone: 'danger'
    });

    if (confirmed) {
      if (logout) {
        logout();
      } else {
        localStorage.removeItem('accessToken');
        window.location.href = '/auth/login';
      }
    }
  };

  const displayAvatar =
    profileForm.avatarPreview ||
    profileForm.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      profileForm.displayName || 'User'
    )}&color=fff&background=3b82f6`;

  if (loading) {
    return (
      <main className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
        <p className="text-xs text-gray-500 font-semibold">Đang đồng bộ thông tin cài đặt...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6 lg:p-8 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Personal Settings</h1>
          <p className="text-xs text-gray-500 mt-1">
            Quản lý thông tin hồ sơ cá nhân, mật khẩu bảo mật và tùy chọn thông báo.
          </p>
        </div>

        {/* Card Tabs & Content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-100 px-6 pt-2 bg-white">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-5 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`py-4 px-5 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'security'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Security
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`py-4 px-5 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'notifications'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Notifications
            </button>
          </div>

          {/* Tab Body */}
          <div className="p-6 lg:p-8">
            
            {/* TAB 1: PROFILE */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-xl">
                
                {/* Personal Info Frame */}
                <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className="relative group flex-shrink-0">
                    <img
                      src={displayAvatar}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full object-cover shadow-sm border-2 border-white"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 rounded-full text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                      Sửa ảnh
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-xs font-bold text-gray-800 truncate">
                        {profileForm.displayName || 'User'}
                      </h3>
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-blue-50 text-blue-600">
                        {profileForm.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{profileForm.email}</p>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                  >
                    Tải ảnh lên
                  </button>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={profileForm.displayName}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, displayName: e.target.value })
                      }
                      className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 bg-gray-50/30 focus:bg-white transition-all text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      disabled
                      value={profileForm.email}
                      className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-100 text-gray-500 font-medium cursor-not-allowed outline-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Email đại diện tài khoản và không thể tự chỉnh sửa.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: SECURITY */}
            {activeTab === 'security' && (
              <form onSubmit={handleSaveSecurity} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={securityForm.currentPassword}
                    onChange={(e) =>
                      setSecurityForm({ ...securityForm, currentPassword: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 bg-gray-50/30 focus:bg-white transition-all text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={securityForm.newPassword}
                    onChange={(e) =>
                      setSecurityForm({ ...securityForm, newPassword: e.target.value })
                    }
                    placeholder="Tối thiểu 6 ký tự..."
                    className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 bg-gray-50/30 focus:bg-white transition-all text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={securityForm.confirmPassword}
                    onChange={(e) =>
                      setSecurityForm({ ...securityForm, confirmPassword: e.target.value })
                    }
                    placeholder="Xác nhận mật khẩu mới..."
                    className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 bg-gray-50/30 focus:bg-white transition-all text-gray-800"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <form onSubmit={handleSaveNotifications} className="space-y-6 max-w-xl">
                <div className="space-y-4">
                  {/* Email Notifications */}
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">Email Notifications</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Nhận thông báo lớp học, thông báo bài tập qua Email.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationForm.emailNotifications}
                        onChange={(e) =>
                          setNotificationForm({
                            ...notificationForm,
                            emailNotifications: e.target.checked
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Push Notifications */}
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">Push Notifications</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Nhận thông báo nổi trực tiếp trên giao diện trình duyệt.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationForm.pushNotifications}
                        onChange={(e) =>
                          setNotificationForm({
                            ...notificationForm,
                            pushNotifications: e.target.checked
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50/60 border border-red-100 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-red-700">Danger Zone</h3>
            <p className="text-xs text-red-500/80 mt-0.5">
              Thoát phiên đăng nhập của tài khoản trên thiết bị này.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors flex-shrink-0"
          >
            Log Out
          </button>
        </div>

      </div>
    </main>
  );
}