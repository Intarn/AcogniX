// frontend/src/pages/learner/Progress.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getProgressOverview } from '../../services/progressService';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Progress() {
  const { user } = useAuth();
  const userEmail = user?.email || 'student@acognix.com';

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('Last 7 days');
  const [overview, setOverview] = useState({
    timeStudied: '0h 0m',
    coursesCompleted: 0,
    flashcardsReviewed: 0,
    quizzesPassed: 0,
    activities: [],
    courseProgressList: [],
    chartData: { labels: [], data: [] }
  });

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      const data = await getProgressOverview(userEmail, timeRange);
      if (data) {
        setOverview(data);
      }
    } catch (err) {
      console.error("Lỗi khi tải tiến độ học tập:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgressData();
  }, [userEmail, timeRange]);

  // Bảo vệ an toàn dữ liệu mảng cho biểu đồ
  const chartConfig = {
    labels: overview?.chartData?.labels || [],
    datasets: [{
      label: 'Study Hours',
      data: overview?.chartData?.data || [],
      backgroundColor: '#DBEAFE',
      hoverBackgroundColor: '#3B82F6',
      borderRadius: 6,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${c.parsed.y} hours` } }
    },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v) => `${v}h` } },
      x: { grid: { display: false } }
    }
  };

  if (loading) {
    return (
      <main className="flex-1 p-6 flex justify-center items-center bg-gray-50">
        <p className="text-gray-500 text-sm">Đang đồng bộ thống kê từ Server...</p>
      </main>
    );
  }

  // Khai báo an toàn các mảng tránh lỗi undefined.length
  const activitiesList = overview?.activities || [];
  const courseList = overview?.courseProgressList || [];

  return (
    <main className="flex-1 p-6 space-y-6 overflow-y-auto bg-gray-50">
      
      {/* Header filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-800">My Progress</h1>
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-300"
          >
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>All time</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm transition-transform hover:-translate-y-1">
          <p className="text-sm font-medium text-gray-500">Est. Time Studied</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{overview?.timeStudied || '0h 0m'}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm transition-transform hover:-translate-y-1">
          <p className="text-sm font-medium text-gray-500">Courses Mastered</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{overview?.coursesCompleted || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm transition-transform hover:-translate-y-1">
          <p className="text-sm font-medium text-gray-500">Flashcards Reviewed</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{overview?.flashcardsReviewed || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm transition-transform hover:-translate-y-1">
          <p className="text-sm font-medium text-gray-500">Quizzes Passed</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{overview?.quizzesPassed || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ thời gian học */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-base font-bold text-gray-800 mb-4">Study Time ({timeRange})</h3>
          <div className="h-64">
            {chartConfig.labels.length > 0 && (
              <Bar data={chartConfig} options={chartOptions} />
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex-shrink-0">Recent Activity</h3>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {activitiesList.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No recent activity found.</p>
            ) : (
              activitiesList.map((act, index) => {
                const dateObj = new Date(act.dateObj || act.date);
                const timeDiff = Math.floor((new Date() - dateObj) / 60000);
                const timeStr = timeDiff < 60 ? `${timeDiff}m ago` : (timeDiff < 1440 ? `${Math.floor(timeDiff / 60)}h ago` : `${Math.floor(timeDiff / 1440)}d ago`);

                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${act.bgClass || 'bg-blue-100 text-blue-600'} rounded-lg flex items-center justify-center text-sm`}>{act.icon || '📝'}</div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">{act.title}</p>
                      <p className="text-[11px] text-gray-400">{timeStr}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Tiến độ khóa học */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-4">Progress by Enrolled Course</h3>
        <div className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {courseList.length === 0 ? (
            <p className="text-center text-gray-500 text-sm md:col-span-2">No courses enrolled.</p>
          ) : (
            courseList.map(course => (
              <div key={course.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-bold text-gray-800 truncate pr-2" title={course.name}>{course.name}</p>
                  <p className={`text-xs font-black ${course.textColor || 'text-blue-600'}`}>{course.progress}%</p>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div className={`${course.progressColor || 'bg-blue-500'} h-full transition-all duration-1000 ease-out`} style={{ width: `${course.progress}%` }}></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </main>
  );
}