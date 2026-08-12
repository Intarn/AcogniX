import { useState } from 'react';
import { useNavigate } from 'react-router';

export default function AddUserPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'LEARNER'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    // TODO: Gắn API tạo user ở đây (hiện tại gọi Auth API signup)
    alert('User added successfully!');
    navigate('/admin/users');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
        <button onClick={() => navigate('/admin/users')} className="text-sm font-medium text-gray-500 hover:text-gray-800 mr-2">Users</button>
        <span className="text-sm font-medium text-gray-400 mx-2">/</span>
        <h1 className="text-lg font-bold text-gray-800">Add New User</h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-800">Display Name</label>
              <input type="text" required className="w-full mt-2 text-sm text-gray-700 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-300 p-2.5"
                value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-800">Email Address</label>
              <input type="email" required className="w-full mt-2 text-sm text-gray-700 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-300 p-2.5"
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-800">Temporary Password</label>
              <input type="text" required className="w-full mt-2 text-sm text-gray-700 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-300 p-2.5"
                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-800">Role</label>
              <select className="w-full mt-2 text-sm text-gray-700 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-300 p-2.5"
                value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="LEARNER">Learner</option>
                <option value="EDUCATOR">Educator</option>
                <option value="SYSTEM_ADMINISTRATOR">Administrator</option>
              </select>
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <button type="button" onClick={() => navigate('/admin/users')} className="text-xs font-semibold text-gray-500 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm">Create User</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}