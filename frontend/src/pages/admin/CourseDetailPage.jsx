import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAdminCourseDetail, adminArchiveCourse } from '../../services/adminService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    fetchCourseDetail();
  }, [courseId]);

  const fetchCourseDetail = async () => {
    try {
      setLoading(true);
      const data = await getAdminCourseDetail(courseId);
      setCourse(data);
    } catch (error) {
      setErrorMsg(error.message || 'Failed to load course details.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceArchive = async () => {
    const confirmed = await confirm({
      title: 'Force Archive Course?',
      message: `Are you sure you want to archive "${course.subjectName}"? This will restrict further student enrollment.`,
      confirmLabel: 'Force Archive',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      setIsArchiving(true);
      await adminArchiveCourse(courseId);
      showToast('Course archived successfully.', 'success');
      navigate('/admin/courses');
    } catch (error) {
      showToast(`Failed to archive course: ${error.message}`, 'error');
    } finally {
      setIsArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading course telemetry...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !course) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50 space-y-4">
        <p className="text-sm font-bold text-red-500">{errorMsg || 'Course not found.'}</p>
        <Link to="/admin/courses" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition">
          Back to Course Management
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 py-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
          <Link to="/admin/courses" className="hover:text-blue-600 transition">Courses</Link>
          <span>/</span>
          <span className="text-gray-700 font-bold">Course Details</span>
        </div>
        
        {course.status !== 'ARCHIVED' ? (
          <button
            onClick={handleForceArchive}
            disabled={isArchiving}
            className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-4 py-2.5 rounded-xl border border-red-200 transition shadow-xs disabled:opacity-50"
          >
            {isArchiving ? 'Archiving...' : 'Force Archive Course'}
          </button>
        ) : (
          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-4 py-2 rounded-xl border border-gray-200">
            Archived
          </span>
        )}
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6 max-w-5xl mx-auto w-full">
        <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xs space-y-3">
          <h1 className="text-xl font-black text-gray-900 tracking-tight">
            {course.subjectName} <span className="text-blue-600">({course.courseCode})</span>
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            Instructor: <strong className="text-gray-800">{course.educatorName}</strong> ({course.educatorEmail})
          </p>
          <div className="flex items-center gap-3 pt-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${course.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {course.status}
            </span>
            <span className="text-xs text-gray-400 font-semibold">Enrollment Code: <strong className="text-gray-800">{course.enrollmentCode || 'N/A'}</strong></span>
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-base font-black text-gray-900">Enrolled Students ({course.students?.length || 0})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Email Address</th>
                  <th className="px-6 py-4">User ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                {!course.students || course.students.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-10 text-gray-400 font-bold">No students are currently enrolled in this course.</td></tr>
                ) : (
                  course.students.map((student) => (
                    <tr key={student.userId} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-900">{student.displayName}</td>
                      <td className="px-6 py-4 text-gray-500">{student.email}</td>
                      <td className="px-6 py-4 font-mono text-gray-400">{student.userId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}