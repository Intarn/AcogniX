import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAuth } from '../../hooks/useAuth';
import { getProgressOverview } from '../../services/progressService';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Math.round(Number(value))}%`;
};

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Progress() {
  const { user } = useAuth();
  const userEmail = user?.email || '';
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [timeRange, setTimeRange] = useState('Last 7 days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overview, setOverview] = useState(null);
  const today = getLocalDateInputValue();
  const isCustomRange = timeRange === 'Custom range';
  const isCustomRangeComplete = Boolean(startDate && endDate);
  const isCustomRangeValid = !isCustomRange || (
    isCustomRangeComplete &&
    startDate <= endDate &&
    endDate <= today
  );

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await getProgressOverview(userEmail, timeRange, startDate, endDate);
      setOverview(data);
    } catch (error) {
      console.error('[Progress Error]:', error);
      setOverview(null);
      setErrorMsg('Unable to load your learning statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCustomRange && !isCustomRangeValid) {
      setLoading(false);
      return;
    }

    fetchProgressData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, timeRange, startDate, endDate]);

  if (loading) {
    return (
      <main className="flex-1 p-8 flex justify-center items-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-xs font-bold text-gray-500">Loading learning statistics...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="flex-1 p-8 flex flex-col justify-center items-center bg-gray-50/50 space-y-4">
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-xl font-bold">!</div>
        <p className="text-gray-800 text-sm font-bold">{errorMsg}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={fetchProgressData}
            className="px-6 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-md transition"
          >
            Retry
          </button>
          <Link
            to="/learner/dashboard"
            className="px-6 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const safeOverview = overview || {
    timeStudied: '0h 0m',
    materialsStudied: 0,
    practiceQuizScores: null,
    overallPerformance: 0,
    quizzesPassed: 0,
    flashcardsReviewed: 0,
    recommendedForReview: [],
    hasEnoughDataForTrend: false,
    hasLearningData: false,
    chartData: { labels: [], data: [] },
    courseProgressList: []
  };

  const chartLabels = safeOverview.chartData?.labels || [];
  const chartValues = safeOverview.chartData?.data || [];

  const chartConfig = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Study Hours',
        data: chartValues,
        backgroundColor: '#2563EB',
        borderRadius: 8,
        barThickness: 24
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#F3F4F6' },
        ticks: {
          font: { size: 10, weight: 'bold' },
          color: '#9CA3AF',
          callback: (value) => `${value}h`
        }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10, weight: 'bold' }, color: '#9CA3AF' }
      }
    }
  };

  const recommendations = Array.isArray(safeOverview.recommendedForReview)
    ? safeOverview.recommendedForReview
    : [];
  const courseProgressList = Array.isArray(safeOverview.courseProgressList)
    ? safeOverview.courseProgressList
    : [];

  return (
    <main className="flex-1 p-8 space-y-8 overflow-y-auto bg-gray-50/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/learner/dashboard" className="text-xs font-bold text-blue-600 hover:underline">
              Dashboard
            </Link>
            <span className="text-xs text-gray-300">/</span>
            <span className="text-xs font-bold text-gray-500">Progress</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Personal Statistics</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Aggregated learning metrics across your Class Projects and Personal Projects.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={timeRange}
              onChange={(event) => {
                const value = event.target.value;
                setTimeRange(value);
                setErrorMsg('');

                if (value !== 'Custom range') {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              className="bg-white text-xs font-bold text-gray-700 border border-gray-200 rounded-2xl px-4 py-2.5 outline-none focus:border-blue-600 shadow-xs cursor-pointer"
            >
              <option value="Last 7 days">Last 7 days</option>
              <option value="Last 4 Weeks">Last 4 Weeks</option>
              <option value="Last 30 days">Last 30 days</option>
              <option value="All time">All time</option>
              <option value="Custom range">Custom range</option>
            </select>

            {isCustomRange && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-500">From</span>
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || today}
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      setErrorMsg('');
                    }}
                    className="bg-white text-xs font-bold text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-600"
                  />
                </label>

                <label className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-500">To</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    max={today}
                    onChange={(event) => {
                      setEndDate(event.target.value);
                      setErrorMsg('');
                    }}
                    className="bg-white text-xs font-bold text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-600"
                  />
                </label>
              </div>
            )}
          </div>

          {isCustomRange && !isCustomRangeComplete && (
            <p className="text-[11px] font-semibold text-gray-400">
              Select both From and To dates to load statistics.
            </p>
          )}
          {isCustomRange && isCustomRangeComplete && startDate > endDate && (
            <p className="text-[11px] font-semibold text-red-500">
              From date cannot be later than To date.
            </p>
          )}
          {isCustomRange && isCustomRangeComplete && endDate > today && (
            <p className="text-[11px] font-semibold text-red-500">
              To date cannot be later than today.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-5">
        <MetricCard label="Active Study Time" value={safeOverview.timeStudied || '0h 0m'} helper="Tracked learning activity" tone="blue" />
        <MetricCard label="Materials Studied" value={safeOverview.materialsStudied ?? 0} helper="Documents used in learning" tone="purple" />
        <MetricCard label="Quiz Results" value={formatPercent(safeOverview.practiceQuizScores)} helper="Average graded quiz score" tone="emerald" />
        <MetricCard
          label="Overall Performance"
          value={safeOverview.practiceQuizScores === null || safeOverview.practiceQuizScores === undefined ? '—' : formatPercent(safeOverview.overallPerformance)}
          helper="Overall graded performance"
          tone="indigo"
        />
        <MetricCard label="Quizzes Passed" value={safeOverview.quizzesPassed ?? 0} helper="Score at least 70%" tone="cyan" />
        <MetricCard label="Flashcards Reviewed" value={safeOverview.flashcardsReviewed ?? 0} helper="Reviewed flashcards" tone="amber" />
      </div>

      {!safeOverview.hasLearningData && (
        <section className="bg-white p-10 rounded-3xl border border-gray-100 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto font-bold">📊</div>
          <h2 className="text-base font-black text-gray-900">No learning data is available yet.</h2>
          <p className="text-xs text-gray-500 max-w-lg mx-auto leading-relaxed">
            Start a study session, review learning materials, or complete a practice quiz to generate your personal statistics.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link to="/learner/ai-workspace" className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-md transition">
              Start a Study Session
            </Link>
            <Link to="/learner/my-courses" className="px-5 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition">
              Review Learning Materials
            </Link>
            <Link to="/learner/ai-quizzes" className="px-5 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition">
              Complete a Practice Quiz
            </Link>
          </div>
        </section>
      )}

      {recommendations.length > 0 && (
        <section className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <h2 className="text-sm font-black text-amber-900 uppercase tracking-wider">Recommended for Review</h2>
          </div>
          <p className="text-xs text-amber-700">
            Based on your recent performance, these topics may need additional review.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {recommendations.map((item, index) => (
              <div key={`${item.topic}-${index}`} className="bg-white p-3.5 rounded-2xl border border-amber-200/80 shadow-xs flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{item.topic}</p>
                  <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                    Score: {item.score}/{item.totalPoints} ({item.percentage}%)
                  </p>
                </div>
                <Link to="/learner/ai-workspace" className="text-[11px] font-bold text-blue-600 hover:underline flex-shrink-0">
                  Review →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-gray-900">Learning Progress Over Time</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Active study time for the selected period</p>
          </div>
          <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl">{safeOverview.timeStudied || '0h 0m'}</span>
        </div>

        <div className="h-64 w-full pt-2">
          {chartLabels.length > 0 ? (
            <Bar data={chartConfig} options={chartOptions} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-100 rounded-2xl">
              <p className="text-xs font-bold text-gray-700">No study activity found for this period.</p>
              <p className="text-[11px] text-gray-400 mt-1 max-w-sm">
                Your study-time chart will appear when learning activity is recorded in the selected period.
              </p>
            </div>
          )}
        </div>
      </section>

      {courseProgressList.length > 0 && (
        <section className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-gray-900">Progress by Enrolled Course</h2>
          <div className="space-y-4">
            {courseProgressList.map((course) => (
              <div key={course.id} className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-800">{course.name} ({course.code})</span>
                  <span className="font-black text-blue-600">{course.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${course.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function MetricCard({ label, value, helper, tone }) {
  const tones = {
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    cyan: 'text-cyan-700 bg-cyan-50',
    amber: 'text-amber-700 bg-amber-50'
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-32">
      <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full w-max ${tones[tone] || tones.blue}`}>
        {label}
      </span>
      <div className="mt-4">
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{helper}</p>
      </div>
    </div>
  );
}
