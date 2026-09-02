import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';

export default function ClassDetailPage() {
  const navigate = useNavigate();
  const { courseId: routeCourseId } = useParams();
  const courseId = routeCourseId || null;

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let initialLoad = true;

    async function loadCourse({ silent = false } = {}) {
      try {
        if (!silent && initialLoad) setLoading(true);
        if (!silent) setLoadError('');
        const result = await getCourses();
        const courses = Array.isArray(result?.courses) ? result.courses : Array.isArray(result) ? result : [];
        const foundCourse = courses.find((item) => String(item.courseId) === String(courseId));
        if (!cancelled) {
          setCourse(foundCourse || null);
          initialLoad = false;
        }
      } catch (error) {
        if (!cancelled && !silent) {
          console.error('Unable to load course:', error);
          setLoadError(error.message || 'Unable to load course.');
        }
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }

    const refreshSilently = () => loadCourse({ silent: true });
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSilently();
    };

    loadCourse();
    window.addEventListener('focus', refreshSilently);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const syncInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshSilently();
    }, 5000);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshSilently);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(syncInterval);
    };
  }, [courseId]);

  async function handleCopyEnrollmentCode() {
    if (!course?.enrollmentCode || course.status === 'ARCHIVED') return;
    try {
      await navigator.clipboard.writeText(course.enrollmentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert(`Enrollment Code: ${course.enrollmentCode}`);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50/50">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-2xl font-bold">!</div>
          <h1 className="text-lg font-black text-gray-800">Course Not Found</h1>
          <p className="text-xs text-gray-500">{loadError || 'The requested course does not exist.'}</p>
          <button onClick={() => navigate('/educator/courses')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md transition">
            Back to My Courses
          </button>
        </div>
      </div>
    );
  }

  const isArchived = course.status === 'ARCHIVED';

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1">
            <Link to="/educator/courses" className="hover:text-blue-600 transition-colors">My Courses</Link>
            <span>/</span>
            <span className="text-gray-700 truncate">{course.subjectName}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-black text-gray-900 tracking-tight">{course.subjectName}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${isArchived ? 'bg-gray-200 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
              {course.status}
            </span>
          </div>
        </div>
        {!isArchived && (
          <Link to={`/educator/courses/${course.courseId}/edit`} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-xs whitespace-nowrap">
            Edit Course
          </Link>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {isArchived && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p>This course is archived.</p>
              <p className="font-medium text-amber-700 mt-0.5">New enrollment is disabled. Historical data remains available for viewing only.</p>
            </div>
          </div>
        )}

        {/* COURSE SUMMARY CARD */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50">
            <h2 className="text-base font-black text-gray-900">Course Overview</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Basic information and classroom access details.</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* CODE */}
              <div className="bg-gray-50/60 rounded-2xl p-5 border border-gray-100">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Course Code</p>
                <p className="text-lg font-black text-gray-900 mt-1">{course.courseCode}</p>
              </div>
              {/* ENROLLMENT CODE */}
              <div className="bg-gray-50/60 rounded-2xl p-5 border border-gray-100">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Enrollment Code</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className={`text-lg font-black tracking-widest ${isArchived ? 'text-gray-400' : 'text-blue-600'}`}>
                    {course.enrollmentCode || 'N/A'}
                  </p>
                  {course.enrollmentCode && !isArchived && (
                    <button
                      onClick={handleCopyEnrollmentCode}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 shadow-xs'}`}
                    >
                      {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                  )}
                </div>
              </div>
              {/* STATUS */}
              <div className="bg-gray-50/60 rounded-2xl p-5 border border-gray-100">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Status</p>
                <p className="text-lg font-black text-gray-900 mt-1 capitalize">{course.status.toLowerCase()}</p>
              </div>
            </div>
            <div className="mt-6">
              <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider mb-2">Description</p>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50/40 p-4 rounded-2xl border border-gray-50">
                {course.description || 'No description provided.'}
              </p>
            </div>
          </div>
        </section>

        {/* CLASSROOM HUB */}
        <section>
          <div className="mb-5">
            <h2 className="text-base font-black text-gray-900">Classroom Management</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Manage content, members, assessments, and track performance.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <HubCard to={`/educator/courses/${course.courseId}/materials`} icon="📚" color="blue" title="Materials" desc="Upload and organize learning materials." />
            <HubCard to={`/educator/courses/${course.courseId}/members`} icon="👥" color="violet" title="Members" desc="Review requests and manage learners." />
            <HubCard to={`/educator/courses/${course.courseId}/announcements`} icon="📢" color="amber" title="Announcements" desc="Post updates and notify the class." />
            <HubCard to={`/educator/courses/${course.courseId}/assessments`} icon="✍️" color="emerald" title="Assessments" desc="Create quizzes, assignments & schedule." />
            <HubCard to={`/educator/analytics?courseId=${course.courseId}`} icon="📈" color="cyan" title="Analytics" desc="Review class performance statistics." />
            <HubCard to={`/educator/gradebook?courseId=${course.courseId}`} icon="📊" color="rose" title="Gradebook" desc="View official scores across the class." />
          </div>
        </section>
      </main>
    </div>
  );
}

function HubCard({ to, icon, color, title, desc }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-300',
    violet: 'bg-violet-50 text-violet-600 border-violet-100 hover:border-violet-300',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 hover:border-amber-300',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:border-emerald-300',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100 hover:border-cyan-300',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 hover:border-rose-300',
  };

  return (
    <Link to={to} className={`bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all group flex flex-col justify-between`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold mb-4 transition-transform group-hover:scale-105 ${colorMap[color].split(' ')[0]} ${colorMap[color].split(' ')[1]}`}>
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-black text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}