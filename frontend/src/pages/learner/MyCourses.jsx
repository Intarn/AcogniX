// frontend/src/pages/learner/MyCourses.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCourses, enrollInClass } from '../../services/courseService';

export default function MyCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [filter, setFilter] = useState('Active');

  // Trạng thái quản lý Modal Enroll in Class
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Tải danh sách khóa học thực tế từ Backend
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await getCourses();
      
      const rawList = Array.isArray(data) ? data : data?.courses || data?.data || [];
      
      // Map trực tiếp thuộc tính trả về từ DB/Server
      const realCourses = rawList.map(
        (course) => {
          return {
            id: course.courseId,

            name:
              course.subjectName 
              `Untitled Course`,

            teacher:
              course.educator?.displayName ||
              course.educator?.email ||
              'Unknown Educator',

            category:
              course.courseCode ||
              'General',

            description:
              course.description ||
              '',

            status:
              course.status,

            enrollmentStatus:
              course.enrollmentStatus,

            approvedAt:
              course.approvedAt,

            /*
            
      Backend hiện chưa trả progress.
      Tạm thời giữ 0 để UI cũ
      vẫn render được.*/
      progress: 0,

            /*
            
      Course.status hiện là
      ACTIVE / ARCHIVED,
      không phải completion progress.*/
      isCompleted:
        course.status === 'ARCHIVED',

            imageUrl: null
          };
        }
      );

      setCourses(realCourses);
    } catch (err) {
      console.error("Lỗi kết nối Backend My Courses:", err);
      setErrorMsg(err.message || "Không thể tải danh sách khóa học từ Server.");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Xử lý gửi mã lớp học lên Backend
  const handleEnrollClass = async (e) => {
    e.preventDefault();
    if (!courseCode.trim()) return;

    try {
      setSubmitting(true);
      await enrollInClass(courseCode.trim());

      setIsModalOpen(false);
      setCourseCode('');
      alert("Enrolled successfully!");
      fetchCourses();
    } catch (err) {
      console.error("Lỗi khi tham gia lớp học:", err);
      alert(err.message || "Invalid code or you are already enrolled in this class.");
    } finally {
      setSubmitting(false);
    }
  };

  // Lọc khóa học theo trạng thái
  const filteredCourses =
    courses.filter(
      (course) => {
        if (filter === 'Active') {
          return (
            course.status === 'ACTIVE'
          );
        }

        if (filter === 'Archived') {
          return (
            course.status === 'ARCHIVED'
          );
        }

        return true;
      }
    );

  if (loading) {
    return (
      <main className="flex-1 p-6 flex justify-center items-center bg-gray-50">
        <p className="text-gray-500 text-sm">Đang tải danh sách khóa học từ Backend...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6 overflow-y-auto bg-gray-50 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Courses</h1>
        <div className="flex items-center gap-2">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-300"
          >
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
            <option value="All Courses">All Courses</option>
          </select>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            + Enroll in Class
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCourses.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500 text-xs">No courses found matching this filter.</p>
          </div>
        ) : (
          filteredCourses.map(course => {
            let progressColor = 'bg-emerald-500';
            if (course.progress < 70) progressColor = 'bg-amber-500';
            if (course.progress < 40) progressColor = 'bg-red-500';

            return (
              <div 
                key={course.id} 
                className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col ${course.isCompleted ? 'opacity-75' : ''}`}
              >
                {course.imageUrl ? (
                  <img 
                    src={course.imageUrl} 
                    alt={course.name} 
                    className="h-32 w-full object-cover" 
                  />
                ) : (
                  <div className="h-32 w-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm p-4 text-center">
                    {course.category}
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-sm font-bold text-gray-800 mb-1 line-clamp-1">{course.name}</h3>
                  <p className="text-[11px] text-gray-400 mb-3">By {course.teacher}</p>
                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-gray-500">Progress</span>
                      <span className={`text-[10px] font-semibold ${course.isCompleted ? 'text-gray-500' : 'text-emerald-600'}`}>
                        {course.isCompleted ? '100% Completed' : course.progress + '%'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-3">
                      <div className={`${course.isCompleted ? 'bg-gray-400' : progressColor} h-full`} style={{ width: `${course.isCompleted ? 100 : course.progress}%` }}></div>
                    </div>
                    <Link 
                      to={`/course-detail?id=${course.id}`}
                      className={`block w-full text-center ${course.isCompleted ? 'bg-gray-100 hover:bg-gray-200 text-gray-600' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'} font-bold text-xs py-2 rounded-lg transition-colors`}
                    >
                      {course.isCompleted ? 'Review Course' : 'Continue Learning'}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Popup: Enroll in Class */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Enroll in Class</h2>
            <p className="text-xs text-gray-400 mb-4">Enter your class code provided by your instructor to join.</p>
            
            <form onSubmit={handleEnrollClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Class / Course Code</label>
                <input 
                  type="text" 
                  required
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="Enter Code (e.g., CS101-2026)" 
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 uppercase tracking-wider font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Enrolling...' : 'Join / Enroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}