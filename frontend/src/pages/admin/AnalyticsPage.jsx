import { useState, useEffect } from 'react';
import { apiRequest } from '../../services/apiClient';

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState({
    topCourses: [],
    tokenConsumption: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // To be updated with the actual backend API endpoint later (e.g., /admin/analytics)
      // const response = await apiRequest('/admin/analytics');
      // setAnalyticsData(response);

      // Temporary placeholder state until the backend analytics endpoint is implemented:
      setAnalyticsData({
        topCourses: [],
        tokenConsumption: null
      });
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">System Analytics</h1>
      </header>
      <main className="p-6 overflow-y-auto space-y-6">
        {/* Platform Usage Chart Section */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-base font-bold text-gray-800 mb-4">Platform Usage Over Time</h3>
          <div className="h-64 bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center rounded-lg">
            <span className="text-gray-400 text-sm">
              {loading ? 'Loading chart data...' : 'Chart.js Line Chart goes here'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Top Active Courses Section */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-4">Top Active Courses</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              {loading ? (
                <li className="text-center py-2 text-gray-400">Loading courses...</li>
              ) : analyticsData.topCourses.length === 0 ? (
                <li className="text-center py-2 text-gray-400">No active courses data available</li>
              ) : (
                analyticsData.topCourses.map((course, idx) => (
                  <li key={idx} className="flex justify-between border-b pb-2">
                    <span>{course.code}</span>
                    <span>{course.students} Students</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* AI Token Consumption Section */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-4">AI Token Consumption</h3>
            <div className="h-32 bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center rounded-lg">
              <span className="text-gray-400 text-sm">
                {loading ? 'Loading token data...' : 'Pie Chart goes here'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}