// frontend/src/pages/learner/MyCourses.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCourses, enrollInClass } from '../../services/courseService';
import { useToast } from '../../contexts/ToastContext';

export default function MyCourses() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [filter, setFilter] = useState('Active');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Enroll in Class
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await getCourses();
      const rawList = Array.isArray(data) ? data : data?.courses || data?.data || [];

      const realCourses = rawList.map((course) => ({
        id: course.courseId,
        name: course.subjectName || 'Unnamed Course',
        code: course.courseCode || 'N/A',
        teacher:
          course.educator?.displayName ||
          course.educator?.email ||
          'Educator',
        description: course.description || 'No detailed description available for this course.',
        status: course.status || 'ACTIVE',
        enrollmentStatus: course.enrollmentStatus || 'APPROVED',
        approvedAt: course.approvedAt,
        progress: 0,
        isArchived: course.status === 'ARCHIVED'
      }));

      setCourses(realCourses);
    } catch (err) {
      console.error('[MyCourses Error]:', err);
      setErrorMsg(err.message || 'Unable to load course list.');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleEnrollClass = async (e) => {
    e.preventDefault();
    const normalizedCode = courseCode.trim().toUpperCase();

    if (!normalizedCode) {
      setCodeError('Class code cannot be empty.');
      return;
    }
    setCodeError('');

    try {
      setSubmitting(true);
      const result = await enrollInClass(normalizedCode);

      showToast(
        result?.message || 'Class enrollment request sent successfully!',
        'success'
      );
      setIsModalOpen(false);
      setCourseCode('');
    } catch (err) {
      console.error('[Enroll Error]:', err);
      let message = 'Unable to send class enrollment request.';

      switch (err.code) {
        case 'INVALID_OR_EXPIRED_CLASS_CODE':
          message = 'Invalid or expired class code. Please check with your Educator and try again.';
          break;
        case 'ALREADY_ENROLLED':
          message = 'You are already enrolled in this class.';
          break;
        case 'ENROLLMENT_REQUEST_PENDING':
          message = 'Your enrollment request is pending approval.';
          break;
        case 'CLASS_CODE_REQUIRED':
          message = 'Class code cannot be empty.';
          break;
        default:
          message = err.message || message;
          break;
      }
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCourses = courses
    .filter((course) => {
      if (filter === 'Active') return course.status === 'ACTIVE';
      if (filter === 'Archived') return course.status === 'ARCHIVED';
      return true;
    })
    .filter((course) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        course.name.toLowerCase().includes(q) ||
        course.code.toLowerCase().includes(q) ||
        course.teacher.toLowerCase().includes(q)
      );
    });

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-gray-50/50 p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading course list...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8 bg-gray-50/50 relative">
      {/* HEADER & TOP CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Courses</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Manage and access the classes you have enrolled in
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-gray-200 rounded-2xl pl-9 pr-4 py-2.5 text-xs font-semibold outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 transition-all shadow-xs w-48 sm:w-60"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              🔍
            </span>
          </div>

          {/* Filter Status */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-600 shadow-xs cursor-pointer"
          >
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
            <option value="All Courses">All Courses</option>
          </select>

          {/* Enroll Button */}
          <button
            onClick={() => {
              setCodeError('');
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-md shadow-blue-600/15 hover:shadow-lg transition-all flex items-center gap-2"
          >
            <span>+</span> Join New Class
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* COURSE CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCourses.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-100 p-8 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-3 font-bold">
              📚
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1">No courses found</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mb-6">
              {searchQuery
                ? `No results match "${searchQuery}". Try searching with a different keyword.`
                : 'You do not have any courses in this category. Enter a class code from your educator.'}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md transition-all inline-flex items-center gap-2"
            >
              <span>+</span> Enter Class Code
            </button>
          </div>
        ) : (
          filteredCourses.map((course) => {
            const isArchived = course.status === 'ARCHIVED';

            return (
              <div
                key={course.id}
                className={`bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group ${
                  isArchived ? 'opacity-75' : ''
                }`}
              >
                {/* Card Banner */}
                <div className="h-32 bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 p-5 flex flex-col justify-between text-white relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {course.code}
                    </span>
                    <span
                      className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isArchived
                          ? 'bg-gray-800/60 text-gray-200'
                          : 'bg-emerald-400/30 text-emerald-100 backdrop-blur-sm'
                      }`}
                    >
                      {course.status}
                    </span>
                  </div>
                  <h3
                    className="text-base font-black text-white line-clamp-1 group-hover:text-blue-100 transition-colors"
                    title={course.name}
                  >
                    {course.name}
                  </h3>
                </div>

                {/* Card Body */}
                <div className="p-5 flex flex-col flex-1 justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>👨‍🏫</span>
                      <span className="font-bold text-gray-800 truncate">{course.teacher}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-gray-50">
                    <Link
                      to={`/learner/courses/${course.id}`}
                      className={`w-full py-2.5 rounded-2xl text-xs font-bold text-center block transition-all shadow-xs ${
                        isArchived
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          : 'bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white'
                      }`}
                    >
                      {isArchived ? 'Review Course →' : 'Go to Class →'}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL ENROLL IN CLASS */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-gray-900">Join Class</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the class code provided by your educator.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEnrollClass} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Class Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={courseCode}
                  onChange={(e) => {
                    setCourseCode(e.target.value);
                    if (codeError) setCodeError('');
                  }}
                  placeholder="Example: CS101, PHY2026..."
                  className={`w-full bg-gray-50 border rounded-2xl p-3.5 text-xs font-bold text-gray-900 outline-none uppercase tracking-wider transition-all ${
                    codeError
                      ? 'border-red-400 bg-red-50/20 focus:border-red-500'
                      : 'border-gray-200 focus:border-blue-600 focus:bg-white'
                  }`}
                />
                {codeError && (
                  <p className="text-[11px] font-bold text-red-500 mt-1.5 flex items-center gap-1">
                    <span>⚠️</span> {codeError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {submitting ? 'Checking code...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}