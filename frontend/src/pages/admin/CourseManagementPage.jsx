import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getAllCoursesForAdmin } from '../../features/admin/adminApi';

export default function CourseManagementPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCourses();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await getAllCoursesForAdmin(search);
      // Update according to the actual API response structure later
      setCourses(response.courses || []);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">Course Management</h1>
        <input 
          type="text" 
          placeholder="Search courses..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 bg-gray-50 text-xs rounded-lg px-4 py-2 border border-gray-200 outline-none focus:border-blue-300" 
        />
      </header>
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
              <tr>
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3">Course Name</th>
                <th className="px-6 py-3">Educator</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                 <tr><td colSpan="5" className="text-center py-4">Loading courses...</td></tr>
              ) : courses.length === 0 ? (
                 <tr><td colSpan="5" className="text-center py-4 text-gray-500">No courses found.</td></tr>
              ) : (
                courses.map(course => (
                  <tr key={course.courseId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-800">{course.courseCode}</td>
                    <td className="px-6 py-4 text-gray-700">{course.subjectName}</td>
                    <td className="px-6 py-4 text-gray-600">{course.educatorId}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${course.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                        {course.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => navigate(`/admin/courses/${course.courseId}`)} className="text-xs font-bold text-blue-600 hover:underline">View Details</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}