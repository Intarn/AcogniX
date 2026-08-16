import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center px-8 flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">Platform overview and real-time infrastructure health.</p>
        </div>
      </header>

      {/* CONTENT */}
      <main className="p-8 overflow-y-auto space-y-8">
        {/* KPI METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard label="Total Users" value={stats.totalUsers} loading={loading} color="text-blue-600" bgColor="bg-blue-50" icon="👥" />
          <MetricCard label="Active Courses" value={stats.activeCourses} loading={loading} color="text-emerald-600" bgColor="bg-emerald-50" icon="📚" />
          <MetricCard label="AI Tokens Used" value={stats.aiTokensUsed} loading={loading} color="text-violet-600" bgColor="bg-violet-50" icon="⚡" />
          <MetricCard label="Support Tickets" value={stats.supportTickets} loading={loading} color="text-amber-600" bgColor="bg-amber-50" icon="🎫" />
        </div>

        {/* SYSTEM HEALTH CARD */}
        <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-gray-900">System Health & Database</h3>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Supabase reachability status monitoring.</p>
            </div>
            <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${stats.databaseStatus === 'ONLINE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : stats.databaseStatus === 'DEGRADED' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {loading ? 'Checking...' : stats.databaseStatus}
            </span>
          </div>

          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${stats.databaseStatus === 'ONLINE' ? 'bg-emerald-500 w-full' : stats.databaseStatus === 'DEGRADED' ? 'bg-amber-500 w-2/3' : 'bg-red-500 w-1/4'}`}></div>
          </div>

          <p className="text-xs text-gray-500 font-medium pt-1">
            {stats.databaseStatus === 'ONLINE'
              ? `Supabase is fully reachable${stats.databaseLatencyMs != null ? ` · Response latency: ${stats.databaseLatencyMs} ms` : ''}.`
              : 'System checks indicate connectivity constraints or degraded performance.'}
          </p>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, loading, color, bgColor, icon }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase ${color} ${bgColor} px-2.5 py-1 rounded-full`}>
          {label}
        </span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="mt-4">
        <span className="text-3xl font-black text-gray-900">{loading ? '...' : Number(value).toLocaleString()}</span>
        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Updated live</p>
      </div>
    </div>
  );
}