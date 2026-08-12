import { useState, useEffect } from 'react';
import { apiRequest } from '../../services/apiClient';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeCourses: 0,
    aiTokensUsed: 0,
    supportTickets: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      // To be updated with the actual backend API endpoint later (e.g., /admin/stats)
      // const response = await apiRequest('/admin/stats');
      // setStats(response);

      // Temporary placeholder state until the backend stats endpoint is implemented:
      setStats({
        totalUsers: 0,
        activeCourses: 0,
        aiTokensUsed: 0,
        supportTickets: 0
      });
    } catch (error) {
      console.error('Failed to fetch dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">Admin Dashboard</h1>
      </header>
      <main className="p-6 overflow-y-auto space-y-6">
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Users</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">
              {loading ? '...' : stats.totalUsers}
            </p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Active Courses</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">
              {loading ? '...' : stats.activeCourses}
            </p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-medium text-gray-500">AI Tokens Used</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">
              {loading ? '...' : stats.aiTokensUsed}
            </p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Support Tickets</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">
              {loading ? '...' : stats.supportTickets}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
           <h3 className="text-base font-bold text-gray-800 mb-4">System Health</h3>
           <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="bg-emerald-500 w-11/12 h-full"></div>
           </div>
           <p className="text-xs text-gray-500 mt-2">All backend services are operating normally.</p>
        </div>
      </main>
    </div>
  );
}