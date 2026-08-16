import { useState } from 'react';
import { updateLLMKey } from '../../services/infrastructureService';
import { useToast } from '../../contexts/ToastContext';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const { showToast } = useToast();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    window.location.href = '/auth/login';
  };

  const handleSaveAIConfig = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setStatusMsg({ text: 'API Key cannot be empty.', type: 'error' });
      return;
    }

    try {
      setIsUpdating(true);
      setStatusMsg({ text: '', type: '' });
      await updateLLMKey(apiKey.trim());
      setStatusMsg({ text: 'AI configuration saved successfully!', type: 'success' });
      showToast('AI configuration saved successfully!', 'success');
      setApiKey('');
    } catch (err) {
      setStatusMsg({ text: err.message || 'Failed to update API Key.', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center px-8 py-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">System Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">Manage global platform configurations and security preferences.</p>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl bg-white rounded-3xl border border-gray-100 p-8 shadow-xs space-y-6">
          {/* Maintenance Mode */}
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-1">Maintenance Mode</h3>
            <p className="text-xs text-gray-500 mb-4 font-medium">Enable this option to restrict system access to administrators only.</p>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              <span className="ml-3 text-xs font-bold text-gray-700">System Offline</span>
            </label>
          </div>

          <hr className="border-gray-50" />

          {/* AI Configuration */}
          <form onSubmit={handleSaveAIConfig} className="space-y-4">
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-1">AI Configuration</h3>
              <label className="block text-xs font-bold text-gray-700 mt-3 mb-1.5">Google Gemini API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="************************"
                className="w-full bg-gray-50 text-xs font-semibold rounded-2xl px-4 py-3 border border-gray-200 outline-none focus:border-blue-500 focus:bg-white transition"
              />
              <p className="text-[10px] text-gray-400 mt-1 font-medium">Leave blank to use the default system environment key.</p>
            </div>

            {statusMsg.text && (
              <p className={`text-xs font-bold ${statusMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {statusMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={isUpdating}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md transition disabled:opacity-50"
            >
              {isUpdating ? 'Saving...' : 'Save AI Settings'}
            </button>
          </form>

          <hr className="border-gray-50" />

          {/* Account Session */}
          <div>
            <h3 className="text-sm font-black text-red-600 uppercase tracking-wider mb-1">Account Session</h3>
            <p className="text-xs text-gray-500 mb-4 font-medium">Terminate your current administrative session securely.</p>
            <button
              onClick={handleLogout}
              className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-5 py-2.5 rounded-xl border border-red-200 transition shadow-xs"
            >
              Log Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}