import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';

export default function AddUserPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'LEARNER'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    // TODO: Connect user creation API if necessary
    showToast('User added successfully.', 'success');
    navigate('/admin/users');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center px-8 py-4 flex-shrink-0 gap-2">
        <button onClick={() => navigate('/admin/users')} className="text-xs font-bold text-gray-400 hover:text-gray-700">Users</button>
        <span className="text-gray-300">/</span>
        <h1 className="text-base font-black text-gray-900 tracking-tight">Add New User</h1>
      </header>

      {/* CONTENT */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl bg-white rounded-3xl border border-gray-100 shadow-xs p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Display Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.displayName}
                onChange={e => setFormData({...formData, displayName: e.target.value})}
                placeholder="E.g., John Doe"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="E.g., john@example.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Temporary Password <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                placeholder="Initial account password"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">System Role <span className="text-red-500">*</span></label>
              <select
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-gray-800 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
              >
                <option value="LEARNER">Learner</option>
                <option value="EDUCATOR">Educator</option>
              </select>
            </div>

            <div className="pt-4 border-t border-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => navigate('/admin/users')} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">
                Cancel
              </button>
              <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition">
                Create User
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}