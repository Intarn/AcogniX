import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllCoursesForAdmin } from '../../features/admin/adminApi';

export default function CourseManagementPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCourses();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await getAllCoursesForAdmin(search);
      setCourses(response?.courses || []);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 py-4 flex-shrink-0 gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Course Management</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">Inspect platform-wide courses and instructor assignments.</p>
        </div>
        <input
          type="text"
          placeholder="Search courses by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-blue-600 focus:bg-white transition shadow-xs"
        />
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Course Code</th>
                  <th className="px-6 py-4">Course Name</th>
                  <th className="px-6 py-4">Instructor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                {loading ? (
                  <tr><td colSpan="5" className="text-center py-10 text-gray-400 font-bold">Loading courses...</td></tr>
                ) : courses.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-10 text-gray-400 font-bold">No courses found.</td></tr>
                ) : (
                  courses.map((course) => (
                    <tr key={course.courseId} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-900">{course.courseCode}</td>
                      <td className="px-6 py-4 font-bold text-gray-800">{course.subjectName}</td>
                      <td className="px-6 py-4 text-gray-500">{course.educatorName || course.educatorId}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${course.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                          {course.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => navigate(`/admin/courses/${course.courseId}`)} className="px-3.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl transition shadow-xs">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}