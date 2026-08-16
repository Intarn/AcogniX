import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  searchUsers,
  banUser,
  unbanUser,
  changeUserRole,
  resetUserPassword,
  requestDeleteUser,
  confirmDeleteUser
} from '../../features/admin/adminApi';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

export default function UserManagementPage() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionUserId, setActionUserId] = useState(null);
  const [roleDrafts, setRoleDrafts] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async (query = activeSearch) => {
    setLoading(true);
    try {
      const response = await searchUsers(query);
      const nextUsers = response.users || [];
      setUsers(nextUsers);
      setRoleDrafts((previous) => {
        const next = { ...previous };
        nextUsers.forEach((user) => {
          next[user.userId] = user.role;
        });
        return next;
      });
    } catch (error) {
      showToast(error.message || 'Failed to fetch users.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers('');
    // Initial management list only. Searches are intentionally performed by
    // the Search button/Enter key to match UC12 UI01, UI02 and UI09.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    const normalized = searchInput.trim();
    setActiveSearch(normalized);
    await fetchUsers(normalized);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  const handleResetPassword = async (user) => {
    const confirmed = await confirm({
      title: 'Reset User Password?',
      message: `Reset the password for ${user.email} and send the new sign-in information to the user?`,
      confirmLabel: 'Reset Password',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });

    if (!confirmed) return;

    setActionUserId(user.userId);
    try {
      const response = await resetUserPassword(user.userId);
      showToast(
        response.message || 'Password reset completed and the user was notified by email.',
        'success'
      );
    } catch (error) {
      showToast(error.message || 'Unable to reset password.', 'error');
    } finally {
      setActionUserId(null);
    }
  };

  const handleToggleBan = async (user) => {
    const willBan = user.status !== 'BANNED';
    const confirmed = await confirm({
      title: willBan ? 'Ban User Account?' : 'Unban User Account?',
      message: `Are you sure you want to ${willBan ? 'ban' : 'unban'} ${user.email}?`,
      confirmLabel: willBan ? 'Ban Account' : 'Unban Account',
      cancelLabel: 'Cancel',
      tone: willBan ? 'danger' : 'success'
    });

    if (!confirmed) return;

    setActionUserId(user.userId);
    try {
      const response = user.status === 'BANNED'
        ? await unbanUser(user.userId)
        : await banUser(user.userId);

      await fetchUsers(activeSearch);
      showToast(
        response.message || (willBan ? 'Account has been banned.' : 'Account has been unbanned.'),
        'success'
      );
    } catch (error) {
      showToast(error.message || 'Unable to update account status.', 'error');
    } finally {
      setActionUserId(null);
    }
  };

  const handleRoleDraftChange = (userId, role) => {
    setRoleDrafts((previous) => ({
      ...previous,
      [userId]: role
    }));
  };

  const handleAssignRole = async (user) => {
    const newRole = roleDrafts[user.userId] || user.role;

    if (newRole === user.role) {
      showToast('Please choose a different role before assigning it.', 'info');
      return;
    }

    const roleLabel = newRole === 'SYSTEM_ADMINISTRATOR'
      ? 'System Administrator'
      : newRole.charAt(0) + newRole.slice(1).toLowerCase();

    const confirmed = await confirm({
      title: 'Assign New Role?',
      message: `Change ${user.email} from ${user.role} to ${roleLabel}? The user will be notified by email.`,
      confirmLabel: 'Assign Role',
      cancelLabel: 'Cancel',
      tone: 'warning'
    });

    if (!confirmed) {
      setRoleDrafts((previous) => ({
        ...previous,
        [user.userId]: user.role
      }));
      return;
    }

    setActionUserId(user.userId);
    try {
      const response = await changeUserRole(user.userId, newRole);
      await fetchUsers(activeSearch);
      showToast(response.message || 'Role has been updated.', 'success');
    } catch (error) {
      setRoleDrafts((previous) => ({
        ...previous,
        [user.userId]: user.role
      }));
      showToast(error.message || 'Unable to update role.', 'error');
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeleteRequest = async (user) => {
    const confirmed = await confirm({
      title: 'Delete User Account?',
      message: `Deleting ${user.email} is permanent. A 2FA verification code will be sent to your administrator email before deletion can continue.`,
      confirmLabel: 'Continue with 2FA',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });

    if (!confirmed) return;

    setActionUserId(user.userId);
    try {
      const response = await requestDeleteUser(user.userId);
      setDeleteTarget(user);
      setVerificationCode('');
      setVerificationError('');
      showToast(
        response.message || 'A verification code has been sent to your email.',
        'info'
      );
    } catch (error) {
      showToast(error.message || 'Unable to send verification code.', 'error');
    } finally {
      setActionUserId(null);
    }
  };

  const closeDeleteVerification = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setVerificationCode('');
    setVerificationError('');
  };

  const handleConfirmDelete = async () => {
    const code = verificationCode.trim();

    if (!code) {
      setVerificationError('Please enter the verification code sent to your email.');
      return;
    }

    setDeleting(true);
    setVerificationError('');

    try {
      const response = await confirmDeleteUser(deleteTarget.userId, code);
      setDeleteTarget(null);
      setVerificationCode('');
      await fetchUsers(activeSearch);
      showToast(response.message || 'Account has been permanently deleted.', 'success');
    } catch (error) {
      // Keep the dialog open after an invalid code so the administrator can
      // retry and the target account remains untouched (UC12 UI07).
      setVerificationError(
        error.message || 'Invalid or expired verification code.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 py-4 flex-shrink-0 gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">User Management</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Search accounts, manage access status, reset passwords, assign roles, and delete accounts with 2FA verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search exact name or email..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-64 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-blue-600 focus:bg-white transition shadow-xs"
            aria-label="Search users by exact name or email"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition whitespace-nowrap"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/users/add')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-md transition whitespace-nowrap"
          >
            + Add User
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Display Name</th>
                  <th className="px-6 py-4">Email Address</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-400 font-bold">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-400 font-bold">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const busy = actionUserId === user.userId;
                    const roleDraft = roleDrafts[user.userId] || user.role;

                    return (
                      <tr key={user.userId} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4 font-bold text-gray-900">{user.displayName}</td>
                        <td className="px-6 py-4 text-gray-500">{user.email}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={roleDraft}
                              onChange={(event) => handleRoleDraftChange(user.userId, event.target.value)}
                              disabled={busy}
                              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
                              aria-label={`Role for ${user.email}`}
                            >
                              <option value="LEARNER">Learner</option>
                              <option value="EDUCATOR">Educator</option>
                              <option value="SYSTEM_ADMINISTRATOR">Administrator</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAssignRole(user)}
                              disabled={busy || roleDraft === user.role}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                              Assign Role
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              user.status === 'BANNED'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleResetPassword(user)}
                              disabled={busy}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition shadow-xs"
                            >
                              Reset Password
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleBan(user)}
                              disabled={busy}
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-xs disabled:opacity-50 ${
                                user.status === 'BANNED'
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                            >
                              {user.status === 'BANNED' ? 'Unban Account' : 'Ban Account'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRequest(user)}
                              disabled={busy}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition shadow-xs"
                            >
                              Delete Account
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-2fa-title"
          >
            <h2 id="delete-2fa-title" className="text-lg font-black text-gray-900">
              Two-Factor Authentication Required
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Enter the 6-digit verification code sent to your administrator email to permanently delete{' '}
              <span className="font-bold text-gray-700">{deleteTarget.email}</span>.
            </p>

            <label className="block mt-5 text-xs font-black uppercase tracking-wider text-gray-500" htmlFor="delete-verification-code">
              Verification Code
            </label>
            <input
              id="delete-verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verificationCode}
              onChange={(event) => {
                setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                setVerificationError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !deleting) {
                  event.preventDefault();
                  handleConfirmDelete();
                }
              }}
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-center tracking-[0.35em] font-black outline-none transition ${
                verificationError
                  ? 'border-red-400 bg-red-50 focus:border-red-500'
                  : 'border-gray-200 bg-gray-50 focus:border-blue-600 focus:bg-white'
              }`}
              aria-invalid={Boolean(verificationError)}
              autoFocus
            />

            {verificationError && (
              <p className="mt-2 text-xs font-bold text-red-600" role="alert">
                {verificationError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteVerification}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
