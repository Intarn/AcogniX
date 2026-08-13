import { useCallback, useEffect, useState } from 'react';
import { getSystemHealth, getApiUsage, getPlatformAnalytics } from '../../services/infrastructureService';

const EMPTY_ANALYTICS = {
  overview: {
    totalUsers: 0,
    activeLearnersLast15Minutes: 0,
    activeCourses: 0,
    approvedEnrollments: 0,
    studyMinutesToday: 0,
    gradedOrSubmittedToday: 0,
    supportTicketsCreatedToday: 0
  },
  activityTrend: [],
  topCourses: [],
  aiUsage: {
    requestsToday: 0,
    chatResponsesToday: 0,
    quizzesGeneratedToday: 0,
    flashcardSetsGeneratedToday: 0,
    estimatedTokensConsumed: 0,
    tokenUsageIsEstimated: true,
    quotaWarning: false
  }
};

function healthLabel(status) {
  if (status === 'ONLINE') return { label: 'ONLINE', className: 'text-green-600' };
  if (status === 'DEGRADED') return { label: 'DEGRADED', className: 'text-amber-600' };
  if (status === 'OFFLINE') return { label: 'OFFLINE', className: 'text-red-600' };
  return { label: 'UNAVAILABLE', className: 'text-gray-500' };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [health, setHealth] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshError, setRefreshError] = useState(false);

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setRefreshError(false);

    const [healthResult, usageResult, analyticsResult] = await Promise.allSettled([
      getSystemHealth(),
      getApiUsage(),
      getPlatformAnalytics()
    ]);

    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    else setHealth(null);

    if (usageResult.status === 'fulfilled') setUsage(usageResult.value);
    else setUsage(null);

    if (analyticsResult.status === 'fulfilled') {
      setAnalytics({ ...EMPTY_ANALYTICS, ...analyticsResult.value });
    } else {
      setAnalytics(EMPTY_ANALYTICS);
      setRefreshError(true);
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
    const intervalId = window.setInterval(fetchAnalyticsData, 30000);
    return () => window.clearInterval(intervalId);
  }, [fetchAnalyticsData]);

  const healthState = healthLabel(health?.databaseStatus);
  const trend = analytics.activityTrend || [];
  const maxStudyMinutes = Math.max(...trend.map(day => Number(day.studyMinutes || 0)), 1);
  const topCourses = analytics.topCourses || [];
  const aiUsage = analytics.aiUsage || usage || EMPTY_ANALYTICS.aiUsage;
  const totalStudyHoursToday = (Number(analytics.overview?.studyMinutesToday || 0) / 60).toFixed(1);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-800">System Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Live data from application activity and Supabase
            {lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchAnalyticsData}
          disabled={loading}
          className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      <main className="p-6 overflow-y-auto space-y-6">
        {refreshError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
            Some analytics data could not be refreshed. Existing database/health values are not being replaced with fake zeros.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 uppercase">Total Users</p>
            <p className="text-2xl font-black text-gray-800 mt-1">{loading ? '...' : formatNumber(analytics.overview.totalUsers)}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 uppercase">Active Learners (15m)</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{loading ? '...' : formatNumber(analytics.overview.activeLearnersLast15Minutes)}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 uppercase">Active Courses</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{loading ? '...' : formatNumber(analytics.overview.activeCourses)}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 uppercase">Study Hours Today</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">{loading ? '...' : totalStudyHoursToday}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-800">Server & Database Health</h3>
              <p className="text-xs text-gray-400 mt-1">The database status reflects Supabase reachability, not whether another application endpoint returned an error.</p>
            </div>
            <span className={`text-sm font-bold ${healthState.className}`}>{healthState.label}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 uppercase">OS</p>
              <p className="text-sm font-bold text-gray-800 mt-1">{health?.os || 'Unavailable'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 uppercase">Database</p>
              <p className={`text-sm font-bold mt-1 ${healthState.className}`}>{healthState.label}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 uppercase">DB Latency</p>
              <p className="text-sm font-bold text-gray-800 mt-1">{health?.databaseLatencyMs ?? '--'} ms</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 uppercase">CPU Load</p>
              <p className="text-sm font-bold text-blue-600 mt-1">{health?.cpuLoad ?? '--'}%</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 uppercase">RAM</p>
              <p className="text-sm font-bold text-indigo-600 mt-1">
                {health?.ram ? `${health.ram.usedGB} / ${health.ram.totalGB} GB` : '--'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-800">Platform Activity — Last 7 Days</h3>
              <p className="text-xs text-gray-400 mt-1">Users created, recorded study time, and successful AI responses/generations.</p>
            </div>
          </div>
          <div className="h-64 flex items-end gap-3 px-2">
            {trend.map(day => (
              <div key={day.date} className="flex-1 h-full flex flex-col justify-end items-center gap-2">
                <span className="text-[10px] text-gray-500">{day.studyMinutes || 0}m</span>
                <div
                  className="w-full max-w-12 bg-indigo-400 rounded-t-md min-h-[4px]"
                  style={{ height: `${Math.max(4, (Number(day.studyMinutes || 0) / maxStudyMinutes) * 180)}px` }}
                  title={`${day.date}: ${day.studyMinutes || 0} study minutes, ${day.users || 0} new users, ${day.aiRequests || 0} AI requests`}
                />
                <span className="text-[10px] text-gray-400">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-1">Top Active Courses</h3>
            <p className="text-xs text-gray-400 mb-4">Ranked by study time during the last 7 days, with enrollment count shown for context.</p>
            <div className="space-y-3">
              {topCourses.length === 0 ? (
                <p className="text-center py-6 text-gray-400 text-sm">No active course activity recorded.</p>
              ) : topCourses.map(course => (
                <div key={course.courseId} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0 pr-4">
                    <p className="text-sm font-semibold text-gray-800 truncate">{course.code}</p>
                    <p className="text-xs text-gray-500 truncate">{course.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-800">{formatNumber(course.studyMinutesLast7Days)} min</p>
                    <p className="text-xs text-gray-400">{formatNumber(course.students)} students</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-base font-bold text-gray-800">AI Usage Today</h3>
              {aiUsage.quotaWarning && (
                <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-1 rounded">Estimated quota exceeded</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">Counts come from persisted AI chat, quiz, and flashcard records.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-center">
                <p className="text-xs text-gray-500 uppercase">AI Requests</p>
                <p className="text-2xl font-black text-gray-800 mt-1">{formatNumber(aiUsage.requestsToday)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-center">
                <p className="text-xs text-gray-500 uppercase">Est. Tokens</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{formatNumber(aiUsage.estimatedTokensConsumed)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-center">
                <p className="text-xs text-gray-500 uppercase">Quiz / Flashcards</p>
                <p className="text-lg font-black text-indigo-600 mt-1">
                  {formatNumber((aiUsage.quizzesGeneratedToday || 0) + (aiUsage.flashcardSetsGeneratedToday || 0))}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-center">
                <p className="text-xs text-gray-500 uppercase">Study Submissions</p>
                <p className="text-lg font-black text-blue-600 mt-1">{formatNumber(analytics.overview.gradedOrSubmittedToday)}</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-4">Token consumption is explicitly marked as estimated because Gemini token-usage metadata is not currently persisted in Supabase.</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-sm text-gray-600">
          <span className="font-semibold text-gray-800">Other activity today:</span>{' '}
          {formatNumber(analytics.overview.approvedEnrollments)} approved enrollments · {formatNumber(analytics.overview.supportTicketsCreatedToday)} new support tickets.
        </div>
      </main>
    </div>
  );
}
