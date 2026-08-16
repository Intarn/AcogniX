// frontend/src/pages/learner/CourseDetail.jsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCourses } from '../../services/courseService';
import { getCourseMaterials, getCourseAnnouncements } from '../../features/classroom/courseContentApi';
import { getLearnerAssessments } from '../../services/assessmentService';

function formatDateTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function CourseDetail() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ materials: 0, assessments: 0, announcements: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!courseId) return;
    async function loadCourseHub() {
      try {
        setLoading(true);
        setLoadError('');
        const [courseRes, matRes, assessRes, announceRes] = await Promise.all([
          getCourses(),
          getCourseMaterials(courseId).catch(() => ({ materials: [] })),
          getLearnerAssessments().catch(() => ({ assessments: [] })),
          getCourseAnnouncements(courseId).catch(() => ({ announcements: [] }))
        ]);

        const list = Array.isArray(courseRes?.courses) ? courseRes.courses : (Array.isArray(courseRes) ? courseRes : []);
        const found = list.find((c) => String(c.courseId) === String(courseId));

        if (!found) throw new Error('Course information not found.');

        const allAssessments = Array.isArray(assessRes?.assessments) ? assessRes.assessments : (Array.isArray(assessRes) ? assessRes : []);
        const courseAssessments = allAssessments.filter((a) => String(a.courseId) === String(courseId));
        const loadedAnnouncements = Array.isArray(announceRes?.announcements)
          ? [...announceRes.announcements].sort(
              (a, b) => new Date(b.publishedAt || b.createdAt || 0).getTime() - new Date(a.publishedAt || a.createdAt || 0).getTime()
            )
          : [];

        setCourse(found);
        setAnnouncements(loadedAnnouncements);
        setStats({
          materials: matRes?.materials?.length || 0,
          assessments: courseAssessments.length,
          announcements: loadedAnnouncements.length
        });
      } catch (err) {
        console.error('[CourseDetail Error]:', err);
        setLoadError(err.message || 'Unable to load course information.');
      } finally {
        setLoading(false);
      }
    }
    loadCourseHub();
  }, [courseId]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading course information...</p>
        </div>
      </main>
    );
  }

  if (loadError || !course) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50">
        <p className="text-sm font-bold text-red-500">{loadError || 'Course does not exist.'}</p>
        <Link to="/learner/my-courses" className="mt-4 text-xs font-bold text-blue-600 hover:underline">
          &larr; Back to course list
        </Link>
      </main>
    );
  }

  const isArchived = course.status === 'ARCHIVED';

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8 bg-gray-50/50">
      {/* BREADCRUMB & HEADER */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
          <Link to="/learner/my-courses" className="hover:text-blue-600 transition-colors">My Courses</Link>
          <span>/</span>
          <span className="text-gray-700 font-bold">{course.subjectName}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{course.subjectName}</h1>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${isArchived ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {course.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Course Code: <span className="font-bold text-gray-800">{course.courseCode}</span> | Educator: <span className="font-bold text-gray-800">{course.educator?.displayName || course.educator?.email || 'Educator'}</span></p>
          </div>

          <Link
            to={`/learner/ai-workspace?courseId=${course.courseId}`}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-md transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <span>✨</span> Open in AI Workspace
          </Link>
        </div>
      </div>

      {/* QUICK HUB CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to={`/learner/courses/${course.courseId}/materials`}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold group-hover:scale-105 transition-transform">
              📂
            </div>
            <h3 className="text-base font-black text-gray-900 group-hover:text-blue-600 transition-colors">Study Materials</h3>
            <p className="text-xs text-gray-500 leading-relaxed">View and download lecture notes and course materials attached by the educator.</p>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">{stats.materials} materials</span>
            <span className="text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">Access &rarr;</span>
          </div>
        </Link>

        <Link
          to={`/learner/courses/${course.courseId}/assessments`}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold group-hover:scale-105 transition-transform">
              📝
            </div>
            <h3 className="text-base font-black text-gray-900 group-hover:text-indigo-600 transition-colors">Assessments & Quizzes</h3>
            <p className="text-xs text-gray-500 leading-relaxed">Take quizzes, assignments, and review submitted results.</p>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">{stats.assessments} assessments</span>
            <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">Access &rarr;</span>
          </div>
        </Link>

        <Link
          to={`/learner/courses/${course.courseId}/announcements`}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:border-amber-300 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold group-hover:scale-105 transition-transform">
              📢
            </div>
            <h3 className="text-base font-black text-gray-900 group-hover:text-amber-600 transition-colors">Class Announcements</h3>
            <p className="text-xs text-gray-500 leading-relaxed">Stay updated with important announcements and study schedules from the educator.</p>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">{stats.announcements} announcements</span>
            <span className="text-xs font-bold text-amber-600 group-hover:translate-x-1 transition-transform">Access &rarr;</span>
          </div>
        </Link>
      </div>

      {/* UC16-UI01: DEFAULT ANNOUNCEMENTS BOARD */}
      <section className="bg-white rounded-3xl border border-gray-100 p-7 shadow-xs space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-black text-gray-900">Class Announcements</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Latest updates from your educator</p>
          </div>
          <Link to={`/learner/courses/${course.courseId}/announcements`} className="text-xs font-bold text-blue-600 hover:underline">
            View All ({announcements.length}) &rarr;
          </Link>
        </div>

        {announcements.length === 0 ? (
          <div className="py-8 text-center text-xs font-bold text-gray-400">
            No announcement yet
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.announcementId} className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-black text-gray-900">{a.title}</h3>
                  <span className="text-[10px] text-gray-400">{formatDateTime(a.publishedAt || a.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* COURSE DESCRIPTION */}
      <div className="bg-white rounded-3xl border border-gray-100 p-7 shadow-xs">
        <h3 className="text-sm font-black text-gray-900 mb-2">Course Description</h3>
        <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{course.description || 'No detailed description available for this course.'}</p>
      </div>
    </main>
  );
}