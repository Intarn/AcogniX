import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { resetUserPassword, requestDeleteUser } from '../../features/admin/adminApi';

export default function EditUserPage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  
  // Mock Data đợi Backend trả về details
  const [user, setUser] = useState({
    userId: userId, email: 'mock@example.com', displayName: 'Mock User', role: 'LEARNER', status: 'ACTIVE'
  });

  const handleResetPassword = async () => {
    if(!confirm("Reset password for this user?")) return;
    try {
      await resetUserPassword(user.userId);
      alert('Password reset successfully. An email has been sent.');
    } catch (err) { alert(err.message); }
  };

  const handleDeleteRequest = async () => {
    if(!confirm("Request account deletion? A 2FA code will be sent to your email.")) return;
    try {
      await requestDeleteUser(user.userId);
      // Chuyển sang bước nhập 2FA code (hoặc hiển thị modal)
      const code = prompt("Enter 2FA code sent to your email:");
      if(code) {
        // Tích hợp confirmDeleteUser(user.userId, code)
        alert('User deleted permanently.');
        navigate('/admin/users');
      }
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
        <button onClick={() => navigate('/admin/users')} className="text-sm font-medium text-gray-500 hover:text-gray-800 mr-2">Users</button>
        <span className="text-sm font-medium text-gray-400 mx-2">/</span>
        <h1 className="text-lg font-bold text-gray-800">Edit User: {user.displayName}</h1>
      </header>

      <main className="p-6 overflow-y-auto space-y-6 max-w-3xl">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4">Account Information</h3>
          {/* Form fields tương tự AddUserPage... */}
        </div>

        <div className="bg-red-50 rounded-xl border border-red-100 shadow-sm p-6">
          <h3 className="text-base font-bold text-red-800 mb-2">Danger Zone</h3>
          <p className="text-xs text-red-600 mb-4">These actions are irreversible or strictly affect user access.</p>
          <div className="flex gap-3">
            <button onClick={handleResetPassword} className="bg-white border border-red-200 text-red-600 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-red-100">
              Reset Password
            </button>
            <button onClick={handleDeleteRequest} className="bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-red-700">
              Delete Account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}