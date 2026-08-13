import { useState, useEffect } from 'react';
import { getTotalUsers, getActiveCoursesCount } from '../../services/adminService';
import { getApiUsage, getSystemHealth } from '../../services/infrastructureService';
import { getTicketsCount } from '../../services/supportService';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeCourses: 0,
    aiTokensUsed: 0,
    supportTickets: 0,
    databaseStatus: 'UNAVAILABLE',
    databaseLatencyMs: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    const intervalId = window.setInterval(fetchDashboardStats, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const [userResponse, courseResponse, apiUsageResponse, ticketResponse, healthResponse] = await Promise.all([
        getTotalUsers().catch(() => ({ totalUsers: 0 })),
        getActiveCoursesCount().catch(() => ({ activeCourses: 0 })),
        getApiUsage().catch(() => null),
        getTicketsCount().catch(() => ({ totalTickets: 0 })),
        getSystemHealth().catch(() => null)
      ]);

      setStats({
        totalUsers: userResponse?.totalUsers || 0,
        activeCourses: courseResponse?.activeCourses || 0,
        aiTokensUsed: apiUsageResponse?.estimatedTokensConsumed || 0,
        supportTickets: ticketResponse?.totalTickets || 0,
        databaseStatus: healthResponse?.databaseStatus || 'UNAVAILABLE',
        databaseLatencyMs: healthResponse?.databaseLatencyMs ?? null
      });
    } catch (error) {
      console.error('Failed to fetch dashboard statistics:', error);
      
      setStats({
        totalUsers: 0,
        activeCourses: 0,
        aiTokensUsed: 0,
        supportTickets: 0,
        databaseStatus: 'UNAVAILABLE',
        databaseLatencyMs: null
      });
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
           <div className="flex items-center justify-between mb-3">
             <h3 className="text-base font-bold text-gray-800">System Health</h3>
             <span className={`text-sm font-bold ${stats.databaseStatus === 'ONLINE' ? 'text-emerald-600' : stats.databaseStatus === 'DEGRADED' ? 'text-amber-600' : stats.databaseStatus === 'OFFLINE' ? 'text-red-600' : 'text-gray-500'}`}>
               {loading ? '...' : stats.databaseStatus}
             </span>
           </div>
           <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${stats.databaseStatus === 'ONLINE' ? 'bg-emerald-500 w-full' : stats.databaseStatus === 'DEGRADED' ? 'bg-amber-500 w-2/3' : stats.databaseStatus === 'OFFLINE' ? 'bg-red-500 w-1/4' : 'bg-gray-300 w-1/3'}`}></div>
           </div>
           <p className="text-xs text-gray-500 mt-2">
             {stats.databaseStatus === 'ONLINE'
               ? `Supabase is reachable${stats.databaseLatencyMs != null ? ` · ${stats.databaseLatencyMs} ms` : ''}.`
               : stats.databaseStatus === 'DEGRADED'
                 ? 'Supabase is reachable, but its health query reported an application/database problem.'
                 : stats.databaseStatus === 'OFFLINE'
                   ? 'Supabase could not be reached from the backend.'
                   : 'Health information is currently unavailable.'}
           </p>
        </div>
      </main>
    </div>
  );
}