// frontend/src/pages/auth/Settings.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { getUserProfile, updateUserProfile, changePassword } from '../../services/profileService';

const EMPTY_PROFILE = {
  displayName: '',
  email: '',
  role: '',
  status: '',
  avatarUrl: '',
  avatarFile: null,
  avatarPreview: ''
};

function buildProfileState(profile = {}, user = {}) {
  return {
    displayName:
      profile.displayName ||
      user?.displayName ||
      user?.name ||
      user?.fullname ||
      '',
    email: profile.email || user?.email || '',
    role: profile.role || user?.role || 'LEARNER',
    status: profile.status || user?.status || 'ACTIVE',
    avatarUrl: profile.avatarUrl || user?.avatarUrl || '',
    avatarFile: null,
    avatarPreview: ''
  };
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [originalProfile, setOriginalProfile] = useState(EMPTY_PROFILE);
  const [displayNameError, setDisplayNameError] = useState('');
  const [avatarError, setAvatarError] = useState('');

  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notificationForm, setNotificationForm] = useState({
    emailNotifications: true,
    pushNotifications: false
  });

  useEffect(() => {
    let cancelled = false;

    const fetchProfileData = async () => {
      try {
        setLoading(true);
        const res = await getUserProfile();
        if (cancelled) return;

        const nextProfile = buildProfileState(res.profile || res, user);
        setProfileForm(nextProfile);
        setOriginalProfile(nextProfile);
        setIsEditingProfile(false);
        setDisplayNameError('');
        setAvatarError('');
      } catch (err) {
        if (cancelled) return;

        const fallbackProfile = buildProfileState({}, user);
        setProfileForm(fallbackProfile);
        setOriginalProfile(fallbackProfile);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfileData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const beginProfileEdit = () => {
    setOriginalProfile({
      ...profileForm,
      avatarFile: null,
      avatarPreview: ''
    });
    setDisplayNameError('');
    setAvatarError('');
    setIsEditingProfile(true);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      const message = 'Avatar file size must not exceed 5 MB.';
      setAvatarError(message);
      setProfileForm((prev) => ({
        ...prev,
        avatarFile: null,
        avatarPreview: ''
      }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast(message, 'error');
      return;
    }

    setAvatarError('');
    setProfileForm((prev) => ({
      ...prev,
      avatarFile: file,
      avatarPreview: URL.createObjectURL(file)
    }));
  };

  const handleCancelProfileEdit = () => {
    if (profileForm.avatarPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(profileForm.avatarPreview);
    }

    setProfileForm({
      ...originalProfile,
      avatarFile: null,
      avatarPreview: ''
    });
    setDisplayNameError('');
    setAvatarError('');
    setIsEditingProfile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!isEditingProfile) return;

    const cleanDisplayName = profileForm.displayName.trim();
    if (!cleanDisplayName) {
      const message = 'Display name cannot be empty.';
      setDisplayNameError(message);
      showToast(message, 'error');
      return;
    }

    if (avatarError) {
      showToast(avatarError, 'error');
      return;
    }

    try {
      setSubmitting(true);
      setDisplayNameError('');

      const res = await updateUserProfile(cleanDisplayName, profileForm.avatarFile);
      const updated = res.profile || {};
      const nextProfile = {
        ...profileForm,
        displayName: updated.displayName || cleanDisplayName,
        email: updated.email || profileForm.email,
        role: updated.role || profileForm.role,
        status: updated.status || profileForm.status,
        avatarUrl: updated.avatarUrl || profileForm.avatarUrl,
        avatarFile: null,
        avatarPreview: ''
      };

      if (profileForm.avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(profileForm.avatarPreview);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';

      setProfileForm(nextProfile);
      setOriginalProfile(nextProfile);
      setAvatarError('');
      setIsEditingProfile(false);

      if (updateUser) {
        updateUser({
          displayName: nextProfile.displayName,
          avatarUrl: nextProfile.avatarUrl
        });
      }

      showToast('Profile updated successfully.', 'success');
    } catch (err) {
      const message = err.message || 'Unable to update profile. Please try again.';
      if (/display name/i.test(message)) {
        setDisplayNameError(message);
      }
      if (/5\s*MB|size/i.test(message)) {
        setAvatarError(message);
      }
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSecurity = async (e) => {
    e.preventDefault();
    if (!securityForm.currentPassword || !securityForm.newPassword) {
      showToast('Please enter complete password information.', 'warning');
      return;
    }

    if (securityForm.newPassword !== securityForm.confirmPassword) {
      showToast('Confirmation password does not match.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await changePassword(securityForm.currentPassword, securityForm.newPassword);
      showToast('Password changed successfully!', 'success');
      setSecurityForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.message || 'Failed to change password.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNotifications = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setTimeout(() => {
        showToast('Notification settings saved!', 'success');
        setSubmitting(false);
      }, 300);
    } catch (err) {
      showToast('Failed to save settings.', 'error');
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Confirm Logout',
      message: 'Are you sure you want to log out your account from this device?',
      confirmLabel: 'Log Out',
      cancelLabel: 'Cancel',
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
        <p className="text-xs text-gray-500 font-semibold">Synchronizing settings information...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6 lg:p-8 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
          <p className="text-xs text-gray-500 mt-1">
            View your account information, update your profile, and configure account preferences.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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

          <div className="p-6 lg:p-8">
            {activeTab === 'profile' && (
              <div className="space-y-6 max-w-2xl">
                <form onSubmit={handleSaveProfile} noValidate className="space-y-6">
                  <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100 flex items-center gap-4">
                    <div className="relative group flex-shrink-0">
                      <img
                        src={displayAvatar}
                        alt={`${profileForm.displayName || 'User'} avatar`}
                        className="w-14 h-14 rounded-full object-cover shadow-sm border-2 border-white"
                      />
                      {isEditingProfile && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 bg-black/40 rounded-full text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        >
                          Edit Photo
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-xs font-bold text-gray-800 truncate">
                          {profileForm.displayName || 'User'}
                        </h3>
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-blue-50 text-blue-600">
                          {String(profileForm.role || '').replace('_', ' ')}
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
                      disabled={!isEditingProfile}
                    />

                    {isEditingProfile ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      >
                        Upload Photo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={beginProfileEdit}
                        className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      >
                        Edit Profile
                      </button>
                    )}
                  </div>

                  {avatarError && (
                    <p className="text-xs font-semibold text-red-600" role="alert">
                      {avatarError}
                    </p>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={profileForm.displayName}
                        disabled={!isEditingProfile}
                        aria-invalid={Boolean(displayNameError)}
                        onChange={(e) => {
                          setProfileForm({ ...profileForm, displayName: e.target.value });
                          if (displayNameError) setDisplayNameError('');
                        }}
                        className={`w-full text-xs border rounded-xl px-3.5 py-2.5 outline-none transition-all text-gray-800 ${
                          displayNameError
                            ? 'border-red-500 bg-red-50/40 focus:border-red-500'
                            : isEditingProfile
                              ? 'border-gray-200 focus:border-blue-500 bg-gray-50/30 focus:bg-white'
                              : 'border-gray-200 bg-gray-100 text-gray-600 cursor-not-allowed'
                        }`}
                      />
                      {displayNameError && (
                        <p className="text-[11px] font-semibold text-red-600 mt-1" role="alert">
                          {displayNameError}
                        </p>
                      )}
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
                        Your account email cannot be self-edited.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Role</p>
                        <p className="text-xs font-bold text-gray-800 mt-1">
                          {String(profileForm.role || 'Member').replace('_', ' ')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Account Status</p>
                        <p className="text-xs font-bold text-gray-800 mt-1">
                          {profileForm.status || 'ACTIVE'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isEditingProfile && (
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                      >
                        {submitting ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelProfileEdit}
                        disabled={submitting}
                        className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold text-xs px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </form>

              </div>
            )}

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
                    placeholder="Minimum 6 characters..."
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
                    placeholder="Confirm new password..."
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

            {activeTab === 'notifications' && (
              <form onSubmit={handleSaveNotifications} className="space-y-6 max-w-xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">Email Notifications</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Receive class and assignment notifications via Email.
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

                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">Push Notifications</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Receive floating notifications directly on the browser interface.
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

        <div className="bg-red-50/60 border border-red-100 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-red-700">Danger Zone</h3>
            <p className="text-xs text-red-500/80 mt-0.5">
              End the account login session on this device.
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
