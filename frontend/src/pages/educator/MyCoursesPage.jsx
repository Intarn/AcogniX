import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { archiveCourse, getCourses } from '../../features/classroom/courseApi';
import { useToast } from '../../contexts/ToastContext';

export default function MyCoursesPage() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchCourses() {
      try {
        setLoading(true);
        const res = await getCourses();
        const list = Array.isArray(res?.courses) ? res.courses : Array.isArray(res) ? res : [];
        if (!cancelled) setCourses(list);
      } catch (err) {
        showToast('Failed to load courses.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCourses();
    return () => { cancelled = true; };
  }, []);

  const filteredCourses = courses.filter((c) => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesSearch = !searchTerm.trim() || 
      c.subjectName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.courseCode?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });


  function requestArchive(course) {
    if (!course || course.status === 'ARCHIVED') return;
    setArchiveTarget(course);
  }

  function cancelArchive() {
    if (archiving) return;
    setArchiveTarget(null);
  }

  async function confirmArchive() {
    if (!archiveTarget || archiving) return;

    try {
      setArchiving(true);
      const result = await archiveCourse(archiveTarget.courseId);
      const archivedCourse = result?.course || { ...archiveTarget, status: 'ARCHIVED' };

      setCourses((current) => current.map((course) =>
        String(course.courseId) === String(archiveTarget.courseId)
          ? { ...course, ...archivedCourse, status: 'ARCHIVED' }
          : course
      ));

      showToast(result?.message || 'Course has been archived.', 'success');
      setArchiveTarget(null);
    } catch (error) {
      showToast(error?.message || 'Unable to archive course. Please try again.', 'error');
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 py-4 flex-shrink-0 gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Course Management</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">Create, manage, and archive your instructional classes.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-blue-600 focus:bg-white transition w-60 shadow-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-600 transition shadow-xs cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <Link
            to="/educator/courses/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-md transition flex items-center gap-2 whitespace-nowrap"
          >
            <span>+</span> Create New Course
          </Link>
        </div>
      </header>

      {/* MAIN GRID */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCourses.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-100 shadow-xs p-8">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-3 font-bold">📚</div>
              <h3 className="text-base font-black text-gray-900 mb-1">No courses found</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto mb-6">Get started by creating your first instructional course.</p>
              <Link to="/educator/courses/new" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md transition inline-flex items-center gap-2">
                <span>+</span> Create Course
              </Link>
            </div>
          ) : (
            filteredCourses.map((course) => {
              const isArchived = course.status === 'ARCHIVED';
              return (
                <div key={course.courseId} className={`bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group ${isArchived ? 'opacity-75' : ''}`}>
                  <div className="h-32 bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 p-5 flex flex-col justify-between text-white relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {course.courseCode}
                      </span>
                      <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${isArchived ? 'bg-gray-800/60 text-gray-200' : 'bg-emerald-400/30 text-emerald-100 backdrop-blur-sm'}`}>
                        {course.status}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-white line-clamp-1 group-hover:text-blue-100 transition-colors" title={course.subjectName}>
                      {course.subjectName}
                    </h3>
                  </div>
                  <div className="p-5 flex flex-col flex-1 justify-between gap-4">
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {course.description || 'No description provided for this course.'}
                    </p>
                    <div className="pt-3 border-t border-gray-50 flex gap-2">
                      <Link
                        to={`/educator/courses/${course.courseId}`}
                        className={`flex-1 py-2.5 rounded-2xl text-xs font-bold text-center block transition shadow-xs ${isArchived ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white'}`}
                      >
                        {isArchived ? 'View Archived' : 'View Details'}
                      </Link>

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => requestArchive(course)}
                          className="px-4 py-2.5 rounded-2xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition shadow-xs"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {archiveTarget && (
        <div
          className="fixed inset-0 z-50 bg-gray-950/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-course-title"
        >
          <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-2xl p-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl mb-4">⚠️</div>
            <h2 id="archive-course-title" className="text-lg font-black text-gray-900">Archive Course?</h2>
            <p className="text-xs text-gray-600 leading-relaxed mt-2">
              This Course will no longer be available as an active Course. Do you want to continue?
            </p>
            <p className="text-[11px] text-gray-400 mt-3">
              {archiveTarget.subjectName} ({archiveTarget.courseCode}) will remain available as historical Course information, but new enrollment requests will be disabled.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={cancelArchive}
                disabled={archiving}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                disabled={archiving}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {archiving ? 'Archiving...' : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}