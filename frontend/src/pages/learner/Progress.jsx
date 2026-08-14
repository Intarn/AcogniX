import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

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
import { getProgressOverview } from '../../services/progressService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

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
    chartData: {
      labels: [],
      data: []
    }
  });

  // ========================================================
  // FETCH PROGRESS DATA
  // ========================================================
  const fetchProgressData = async () => {
    try {
      setLoading(true);

      const data = await getProgressOverview(
        userEmail,
        timeRange
      );

      if (data) {
        setOverview(prev => ({
          ...prev,
          ...data,

          // Luôn đảm bảo đây là array
          activities: Array.isArray(data.activities)
            ? data.activities
            : [],

          courseProgressList: Array.isArray(data.courseProgressList)
            ? data.courseProgressList
            : [],

          // Luôn đảm bảo chartData có shape hợp lệ
          chartData: {
            labels: Array.isArray(data.chartData?.labels)
              ? data.chartData.labels
              : [],

            data: Array.isArray(data.chartData?.data)
              ? data.chartData.data
              : []
          }
        }));
      }

    } catch (err) {
      console.error(
        'Lỗi khi tải tiến độ học tập:',
        err
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgressData();
  }, [userEmail, timeRange]);

  // ========================================================
  // SAFE DATA
  // ========================================================

  const activitiesList = Array.isArray(overview?.activities)
    ? overview.activities
    : [];

  const courseList = Array.isArray(overview?.courseProgressList)
    ? overview.courseProgressList
    : [];

  const chartLabels = Array.isArray(overview?.chartData?.labels)
    ? overview.chartData.labels
    : [];

  const chartValues = Array.isArray(overview?.chartData?.data)
    ? overview.chartData.data
    : [];

  // ========================================================
  // CHART CONFIG
  // ========================================================

  const chartConfig = {
    labels: chartLabels,

    datasets: [
      {
        label: 'Study Hours',
        data: chartValues,
        backgroundColor: '#DBEAFE',
        hoverBackgroundColor: '#3B82F6',
        borderRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: false
      },

      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.parsed.y} hours`
        }
      }
    },

    scales: {
      y: {
        beginAtZero: true,

        ticks: {
          callback: (value) => `${value}h`
        }
      },

      x: {
        grid: {
          display: false
        }
      }
    }
  };

  // ========================================================
  // LOADING
  // ========================================================

  if (loading) {
    return (
      <main className="flex-1 p-6 flex justify-center items-center bg-gray-50">
        <p className="text-gray-500 text-sm">
          Đang đồng bộ thống kê từ Server...
        </p>
      </main>
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <main className="flex-1 p-6 space-y-6 overflow-y-auto bg-gray-50">

      {/* ====================================================
          HEADER + TIME RANGE FILTER
      ==================================================== */}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">

          <h1 className="text-lg font-bold text-gray-800">
            My Progress
          </h1>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="
              text-xs
              border
              border-gray-200
              rounded-lg
              px-3
              py-1.5
              bg-white
              outline-none
              focus:ring-1
              focus:ring-blue-300
            "
          >
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>All time</option>
          </select>

        </div>
      </div>

      {/* ====================================================
          KEY METRICS
      ==================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        {/* Time Studied */}
        <div className="
          bg-white
          p-5
          rounded-xl
          border
          border-gray-100
          shadow-sm
          transition-transform
          hover:-translate-y-1
        ">
          <p className="text-sm font-medium text-gray-500">
            Est. Time Studied
          </p>

          <p className="text-3xl font-bold text-blue-600 mt-1">
            {overview?.timeStudied || '0h 0m'}
          </p>
        </div>

        {/* Courses */}
        <div className="
          bg-white
          p-5
          rounded-xl
          border
          border-gray-100
          shadow-sm
          transition-transform
          hover:-translate-y-1
        ">
          <p className="text-sm font-medium text-gray-500">
            Courses Mastered
          </p>

          <p className="text-3xl font-bold text-gray-800 mt-1">
            {overview?.coursesCompleted ?? 0}
          </p>
        </div>

        {/* Flashcards */}
        <div className="
          bg-white
          p-5
          rounded-xl
          border
          border-gray-100
          shadow-sm
          transition-transform
          hover:-translate-y-1
        ">
          <p className="text-sm font-medium text-gray-500">
            Flashcards Reviewed
          </p>

          <p className="text-3xl font-bold text-gray-800 mt-1">
            {overview?.flashcardsReviewed ?? 0}
          </p>
        </div>

        {/* Quizzes */}
        <div className="
          bg-white
          p-5
          rounded-xl
          border
          border-gray-100
          shadow-sm
          transition-transform
          hover:-translate-y-1
        ">
          <p className="text-sm font-medium text-gray-500">
            Quizzes Passed
          </p>

          <p className="text-3xl font-bold text-gray-800 mt-1">
            {overview?.quizzesPassed ?? 0}
          </p>
        </div>

      </div>

      {/* ====================================================
          CHART + RECENT ACTIVITY
      ==================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Study Time Chart */}
        <div className="
          lg:col-span-2
          bg-white
          p-5
          rounded-xl
          border
          border-gray-100
          shadow-sm
        ">

          <h3 className="text-base font-bold text-gray-800 mb-4">
            Study Time ({timeRange})
          </h3>

          <div className="h-64">

            {chartConfig.labels.length > 0 ? (

              <Bar
                data={chartConfig}
                options={chartOptions}
              />

            ) : (

              <div className="
                h-full
                flex
                items-center
                justify-center
              ">
                <p className="text-sm text-gray-400">
                  No study activity found.
                </p>
              </div>

            )}

          </div>
        </div>

        {/* Recent Activity */}
        <div className="
          bg-white
          p-5
          rounded-xl
          border
          border-gray-100
          shadow-sm
          flex
          flex-col
        ">

          <h3 className="
            text-sm
            font-bold
            text-gray-800
            mb-4
            flex-shrink-0
          ">
            Recent Activity
          </h3>

          <div className="
            space-y-4
            overflow-y-auto
            flex-1
            pr-2
          ">

            {activitiesList.length === 0 ? (

              <p className="
                text-xs
                text-gray-500
                text-center
                py-4
              ">
                No recent activity found.
              </p>

            ) : (

              activitiesList.map((activity, index) => {

                const dateObj = new Date(
                  activity.dateObj ||
                  activity.date
                );

                let timeStr = '';

                if (!Number.isNaN(dateObj.getTime())) {

                  const timeDiff = Math.floor(
                    (new Date() - dateObj) / 60000
                  );

                  if (timeDiff < 60) {
                    timeStr = `${Math.max(timeDiff, 0)}m ago`;

                  } else if (timeDiff < 1440) {
                    timeStr =
                      `${Math.floor(timeDiff / 60)}h ago`;

                  } else {
                    timeStr =
                      `${Math.floor(timeDiff / 1440)}d ago`;
                  }
                }

                return (
                  <div
                    key={activity.id || index}
                    className="flex items-center gap-3"
                  >

                    <div
                      className={`
                        w-8
                        h-8
                        ${
                          activity.bgClass ||
                          'bg-blue-100 text-blue-600'
                        }
                        rounded-lg
                        flex
                        items-center
                        justify-center
                        text-sm
                      `}
                    >
                      {activity.icon || '📝'}
                    </div>

                    <div className="min-w-0">

                      <p className="
                        text-xs
                        font-bold
                        text-gray-800
                        truncate
                      ">
                        {activity.title || 'Activity'}
                      </p>

                      <p className="
                        text-[11px]
                        text-gray-400
                      ">
                        {timeStr}
                      </p>

                    </div>

                  </div>
                );
              })

            )}

          </div>
        </div>

      </div>

      {/* ====================================================
          COURSE PROGRESS
      ==================================================== */}

      <div className="
        bg-white
        p-5
        rounded-xl
        border
        border-gray-100
        shadow-sm
      ">

        <h3 className="text-sm font-bold text-gray-800 mb-4">
          Progress by Enrolled Course
        </h3>

        {courseList.length === 0 ? (

          <p className="
            text-center
            text-gray-500
            text-sm
            py-4
          ">
            No courses enrolled.
          </p>

        ) : (

          <div className="
            grid
            grid-cols-1
            md:grid-cols-2
            gap-4
          ">

            {courseList.map((course, index) => {

              const progress = Number.isFinite(
                Number(course?.progress)
              )
                ? Math.min(
                    Math.max(
                      Number(course.progress),
                      0
                    ),
                    100
                  )
                : 0;

              return (
                <div
                  key={course?.id || course?.courseId || index}
                  className="
                    bg-gray-50
                    p-4
                    rounded-xl
                    border
                    border-gray-100
                  "
                >

                  <div className="
                    flex
                    justify-between
                    items-center
                    mb-2
                  ">

                    <p
                      className="
                        text-sm
                        font-bold
                        text-gray-800
                        truncate
                        pr-2
                      "
                      title={course?.name || ''}
                    >
                      {course?.name || 'Unnamed Course'}
                    </p>

                    <p
                      className={`
                        text-xs
                        font-black
                        ${
                          course?.textColor ||
                          'text-blue-600'
                        }
                      `}
                    >
                      {progress}%
                    </p>

                  </div>

                  <div className="
                    w-full
                    bg-gray-200
                    h-2
                    rounded-full
                    overflow-hidden
                  ">

                    <div
                      className={`
                        ${
                          course?.progressColor ||
                          'bg-blue-500'
                        }
                        h-full
                        transition-all
                        duration-1000
                        ease-out
                      `}
                      style={{
                        width: `${progress}%`
                      }}
                    />

                  </div>

                </div>
              );
            })}

          </div>

        )}

      </div>

    </main>
  );
}