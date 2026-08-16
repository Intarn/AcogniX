import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resetUserPassword, requestDeleteUser } from '../../features/admin/adminApi';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

export default function EditUserPage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  
  const [user] = useState({
    userId: userId, email: 'mock@example.com', displayName: 'Mock User', role: 'LEARNER', status: 'ACTIVE'
  });

  const handleResetPassword = async () => {
    const confirmed = await confirm({
      title: 'Reset User Password?',
      message: 'A password reset email will be sent to this user.',
      confirmLabel: 'Reset Password',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await resetUserPassword(user.userId);
      showToast('Password reset successfully. An email has been sent.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteRequest = async () => {
    const confirmed = await confirm({
      title: 'Request Account Deletion?',
      message: 'A 2FA verification code will be sent to your email before deletion can be completed.',
      confirmLabel: 'Request Deletion',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await requestDeleteUser(user.userId);
      const code = prompt('Enter 2FA verification code sent to your email:');
      if (code) {
        showToast('Deletion confirmation submitted successfully.', 'info');
        navigate('/admin/users');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center px-8 py-4 flex-shrink-0 gap-2">
        <button onClick={() => navigate('/admin/users')} className="text-xs font-bold text-gray-400 hover:text-gray-700">Users</button>
        <span className="text-gray-300">/</span>
        <h1 className="text-base font-black text-gray-900 tracking-tight">Edit User: {user.displayName}</h1>
      </header>

      {/* CONTENT */}
      <main className="flex-1 p-8 overflow-y-auto space-y-6 max-w-3xl">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-8 space-y-4">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Account Information</h3>
          <p className="text-xs text-gray-500 font-medium">Viewing details for user ID: <span className="font-mono text-gray-700">{user.userId}</span></p>
        </div>

        <div className="bg-red-50/70 rounded-3xl border border-red-100 shadow-xs p-8 space-y-4">
          <div>
            <h3 className="text-sm font-black text-red-800 uppercase tracking-wider">Danger Zone</h3>
            <p className="text-xs text-red-600 mt-1 font-medium">These actions are irreversible or directly affect system access privileges.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleResetPassword} className="bg-white border border-red-200 text-red-600 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-50 transition shadow-xs">
              Reset Password
            </button>
            <button onClick={handleDeleteRequest} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md">
              Delete Account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}