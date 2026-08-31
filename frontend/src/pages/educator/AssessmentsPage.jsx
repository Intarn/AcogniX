import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';
import {
  deleteAssessment,
  getManagedAssessments
} from '../../features/assessment/assessmentApi';

function formatDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getStatusBadge(status) {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'SCHEDULED':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'IN_PROGRESS':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'CLOSED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function isEditableAssessment(assessment) {
  return assessment.status === 'DRAFT' || assessment.status === 'SCHEDULED';
}

function canDeleteAssessment(assessment) {
  return assessment.status === 'DRAFT' || assessment.status === 'SCHEDULED';
}

export default function AssessmentsPage() {
  const { courseId: routeCourseId } = useParams();
  const courseId = routeCourseId || null;

  const [course, setCourse] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [assessmentToDelete, setAssessmentToDelete] = useState(null);
  const [blockedAssessment, setBlockedAssessment] = useState(null);
  const [deletingAssessment, setDeletingAssessment] = useState(false);
  const deleteAssessmentInFlightRef = useRef(false);

  useEffect(() => {
    if (!courseId) {
      setCourse(null); setAssessments([]); setLoadError(''); setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadAssessmentsPage() {
      try {
        setLoading(true); setLoadError('');
        const [courseResult, assessmentResult] = await Promise.all([
          getCourses(),
          getManagedAssessments(courseId)
        ]);
        const courses = Array.isArray(courseResult?.courses) ? courseResult.courses : [];
        const foundCourse = courses.find((item) => String(item.courseId) === String(courseId)) || null;
        const loadedAssessments = Array.isArray(assessmentResult?.assessments) ? assessmentResult.assessments : [];

        if (!cancelled) {
          setCourse(foundCourse);
          setAssessments(loadedAssessments);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Unable to load assessments.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAssessmentsPage();
    return () => { cancelled = true; };
  }, [courseId]);

  const courseAssessments = useMemo(() => {
    return assessments
      .filter((assessment) => String(assessment.courseId) === String(courseId))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [assessments, courseId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading assessments...</p>
        </div>
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50 space-y-4">
        <p className="text-sm font-bold text-red-500">{loadError || 'Course not found.'}</p>
        <Link to="/educator/courses" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition">
          Back to My Courses
        </Link>
      </div>
    );
  }

  const isArchived = course.status === 'ARCHIVED';

  function requestDelete(assessment) {
    if (!canDeleteAssessment(assessment)) {
      setBlockedAssessment(assessment);
      return;
    }
    setAssessmentToDelete(assessment);
  }

  async function confirmDelete() {
    if (!assessmentToDelete || deleteAssessmentInFlightRef.current) return;

    deleteAssessmentInFlightRef.current = true;
    setDeletingAssessment(true);

    try {
      await deleteAssessment(assessmentToDelete.assessmentId);
      setAssessments((prev) => prev.filter((a) => String(a.assessmentId) !== String(assessmentToDelete.assessmentId)));
      setAssessmentToDelete(null);
    } catch (error) {
      alert(error.message || 'Unable to delete assessment.');
    } finally {
      deleteAssessmentInFlightRef.current = false;
      setDeletingAssessment(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1">
            <Link to="/educator/courses" className="hover:text-blue-600 transition">My Courses</Link>
            <span>/</span>
            <Link to={`/educator/courses/${course.courseId}`} className="hover:text-blue-600 transition">{course.subjectName}</Link>
            <span>/</span>
            <span className="text-gray-700">Assessments</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Assessments & Quizzes</h1>
        </div>
        {!isArchived && (
          <Link to={`/educator/courses/${course.courseId}/assessments/new`} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-md transition flex items-center gap-2">
            <span>+</span> Create Assessment
          </Link>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {isArchived && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-2xl px-5 py-4 flex items-center gap-3">
            <span>⚠️</span>
            <p>This course is archived. Existing assessments are available for viewing only.</p>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <SummaryCard label="Total Assessments" value={courseAssessments.length} color="text-blue-600" />
          <SummaryCard label="Drafts" value={courseAssessments.filter((a) => a.status === 'DRAFT').length} color="text-gray-600" />
          <SummaryCard label="Scheduled" value={courseAssessments.filter((a) => a.status === 'SCHEDULED').length} color="text-blue-600" />
          <SummaryCard label="In Progress" value={courseAssessments.filter((a) => a.status === 'IN_PROGRESS').length} color="text-emerald-600" />
        </div>

        {/* ASSESSMENTS TABLE CONTAINER */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
            <div>
              <h2 className="text-base font-black text-gray-900">Course Assessment List</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Manage quizzes and official assignments for this class.</p>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{courseAssessments.length} items</span>
          </div>

          {courseAssessments.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold mb-3">✍️</div>
              <h3 className="text-base font-black text-gray-900">No assessments yet</h3>
              <p className="text-xs text-gray-400 mt-1 mb-6">Create a quiz or assignment to evaluate your learners.</p>
              {!isArchived && (
                <Link to={`/educator/courses/${course.courseId}/assessments/new`} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md transition">
                  Create Assessment Now
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-400 uppercase font-black tracking-wider">
                  <tr>
                    <th className="px-4 py-4">Assessment Title</th>
                    <th className="px-4 py-4">Type</th>
                    <th className="px-4 py-4">Start Time</th>
                    <th className="px-4 py-4">Deadline</th>
                    <th className="px-4 py-4">Points</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Submissions</th>
                    <th className="px-4 py-4 text-right w-[190px] min-w-[190px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                  {courseAssessments.map((assessment) => {
                    const editable = !isArchived && isEditableAssessment(assessment);
                    const deletable = !isArchived && canDeleteAssessment(assessment);
                    return (
                      <tr key={assessment.assessmentId} className="hover:bg-gray-50/50 transition">
                        <td className="px-4 py-4 max-w-[230px]">
                          <p className="text-sm font-bold text-gray-900 truncate">{assessment.title}</p>
                          {assessment.description && (
                            <p className="text-[11px] text-gray-400 font-medium truncate max-w-xs mt-0.5">{assessment.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${assessment.type === 'QUIZ' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {assessment.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-500 whitespace-nowrap">{formatDateTime(assessment.startTime)}</td>
                        <td className="px-4 py-4 text-gray-500 whitespace-nowrap">{formatDateTime(assessment.deadline)}</td>
                        <td className="px-4 py-4 font-bold text-gray-900 whitespace-nowrap">{assessment.totalPoints ?? 0} pts</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusBadge(assessment.status)}`}>
                            {assessment.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Link to={`/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/submissions`} className="text-xs font-bold text-blue-600 hover:underline">
                            View Submissions &rarr;
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-right w-[190px] min-w-[190px]">
                          <div className="inline-grid grid-cols-3 gap-1.5 items-center">
                            <Link
                              to={`/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}`}
                              className="w-[54px] h-8 inline-flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-lg transition"
                            >
                              View
                            </Link>

                            {editable ? (
                              <Link
                                to={`/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/edit`}
                                className="w-[54px] h-8 inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition"
                              >
                                Edit
                              </Link>
                            ) : (
                              <button
                                type="button"
                                disabled
                                aria-disabled="true"
                                title="This assessment cannot be edited in its current status."
                                className="w-[54px] h-8 inline-flex items-center justify-center bg-gray-100 text-gray-300 font-bold rounded-lg cursor-not-allowed"
                              >
                                Edit
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={!deletable}
                              aria-disabled={!deletable}
                              title={deletable ? 'Delete assessment' : 'This assessment cannot be deleted in its current status.'}
                              onClick={() => deletable && requestDelete(assessment)}
                              className={`w-[60px] h-8 inline-flex items-center justify-center font-bold rounded-lg transition ${
                                deletable
                                  ? 'bg-red-50 hover:bg-red-100 text-red-600'
                                  : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                              }`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* DELETE CONFIRM MODAL */}
      {assessmentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
            <div className="w-14 h-14 mx-auto bg-red-50 text-red-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">🗑️</div>
            <h2 className="text-lg font-black text-gray-900">Delete Assessment?</h2>
            <p className="text-xs text-gray-500 mt-2 font-medium">Are you sure you want to delete this assessment? This action cannot be undone.</p>
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-800 border border-gray-100 truncate">{assessmentToDelete.title}</div>
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setAssessmentToDelete(null)}
                disabled={deletingAssessment}
                className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingAssessment}
                className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-md transition disabled:opacity-50"
              >
                {deletingAssessment ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCKED MODAL */}
      {blockedAssessment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
            <div className="w-14 h-14 mx-auto bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">⚠️</div>
            <h2 className="text-lg font-black text-gray-900">Cannot Modify Assessment</h2>
            <p className="text-xs text-gray-500 mt-2 font-medium">This assessment is currently active or has already been closed. It can no longer be edited or deleted.</p>
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-800 border border-gray-100 truncate">{blockedAssessment.title}</div>
            <button onClick={() => setBlockedAssessment(null)} className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md transition">Got It</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl shadow-xs p-6 flex flex-col justify-between">
      <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{label}</p>
      <p className={`text-3xl font-black mt-3 ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}