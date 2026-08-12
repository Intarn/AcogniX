import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router'; // 1. Import useNavigate
import { searchUsers, banUser, unbanUser, changeUserRole } from '../../features/admin/adminApi';

export default function UserManagementPage() {
  const navigate = useNavigate(); // 2. Khởi tạo navigate
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await searchUsers(search);
      setUsers(response.users || []);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handleToggleBan = async (user) => {
    if (!confirm(`Are you sure you want to ${user.status === 'BANNED' ? 'unban' : 'ban'} ${user.email}?`)) return;
    try {
      if (user.status === 'BANNED') await unbanUser(user.userId);
      else await banUser(user.userId);
      fetchUsers(); 
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await changeUserRole(userId, newRole);
      alert('Role updated successfully');
      fetchUsers();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">User Management</h1>
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            className="w-64 bg-gray-50 text-xs rounded-lg px-4 py-2 border border-gray-200 outline-none focus:bg-white focus:border-blue-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* 3. THÊM SỰ KIỆN ONSCLICK ĐỂ CHUYỂN TRANG */}
          <button 
            onClick={() => navigate('/admin/users/add')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm"
          >
            + Add User
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
              <tr>
                <th className="px-6 py-3">Display Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="text-center py-4">Loading...</td></tr>
              ) : users.map(user => (
                <tr key={user.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-800">{user.displayName}</td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <select 
                      className="text-xs border-gray-200 rounded p-1 outline-none"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.userId, e.target.value)}
                    >
                      <option value="LEARNER">Learner</option>
                      <option value="EDUCATOR">Educator</option>
                      <option value="SYSTEM_ADMINISTRATOR">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${user.status === 'BANNED' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex gap-3">
                    <button className="text-xs font-bold text-blue-600 hover:underline">Edit</button>
                    <button 
                      onClick={() => handleToggleBan(user)}
                      className={`text-xs font-bold hover:underline ${user.status === 'BANNED' ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {user.status === 'BANNED' ? 'Unban' : 'Ban'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}