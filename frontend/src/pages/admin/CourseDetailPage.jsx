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
      setErrorMsg(error.message || "Failed to load course details.");
    } finally {
      setLoading(false);
    }
  };

  const handleForceArchive = async () => {
    const confirmed = await confirm({
      title: 'Force archive this course?',
      message: `Are you sure you want to archive \"${course.subjectName}\"? This will restrict further enrollment.`,
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
    return <div className="flex-1 p-6 flex justify-center items-center text-gray-500">Loading real data from Supabase...</div>;
  }

  if (errorMsg || !course) {
    return (
      <div className="flex-1 p-6 flex flex-col justify-center items-center">
        <p className="text-red-500 font-bold mb-4">{errorMsg}</p>
        <Link to="/admin/courses" className="text-blue-600 hover:underline">Back to Course Management</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
        <div className="text-sm">
          <Link to="/admin/courses" className="text-gray-400 hover:text-blue-600">Courses</Link>
          <span className="text-gray-400 mx-2">/</span>
          <span className="font-bold text-gray-800">Course {courseId} Details</span>
        </div>
        
        {course.status !== 'ARCHIVED' ? (
          <button 
            onClick={handleForceArchive}
            disabled={isArchiving}
            className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs px-4 py-2 rounded-lg border border-red-200 transition-colors disabled:opacity-50"
          >
            {isArchiving ? 'Archiving...' : 'Force Archive'}
          </button>
        ) : (
          <span className="bg-gray-100 text-gray-600 font-semibold text-xs px-4 py-2 rounded-lg border border-gray-200">
            Archived
          </span>
        )}
      </header>

      <main className="p-6 overflow-y-auto space-y-6">
        {/* Course Info Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-800">
            {course.subjectName} ({course.courseCode})
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Educator: <span className="font-semibold">{course.educatorName}</span> ({course.educatorEmail})
          </p>
          <p className="text-xs text-gray-400 mt-1">Status: {course.status} | Enrollment Code: {course.enrollmentCode || 'N/A'}</p>
        </div>

        {/* Enrolled Students Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-800">Enrolled Students ({course.students?.length || 0})</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 font-semibold">Student Name</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">User ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!course.students || course.students.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-gray-500 text-sm">
                      No students are currently enrolled in this course.
                    </td>
                  </tr>
                ) : (
                  course.students.map((student) => (
                    <tr key={student.userId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-800">
                        {student.displayName}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs font-mono">
                        {student.userId}
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