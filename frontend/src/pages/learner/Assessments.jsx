// frontend/src/pages/learner/Assessments.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getLearnerAssessments } from '../../services/assessmentService';
import { getCourses } from '../../services/courseService';

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
    case 'IN_PROGRESS':
      return (
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
          Open
        </span>
      );
    case 'SCHEDULED':
      return (
        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
          Scheduled
        </span>
      );
    case 'CLOSED':
      return (
        <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
          Closed
        </span>
      );
    default:
      return (
        <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
          {status}
        </span>
      );
  }
}

export default function Assessments() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const navigate = useNavigate();

  const fetchList = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [assessRes, courseRes] = await Promise.all([
        getLearnerAssessments(),
        getCourses().catch(() => ({ courses: [] }))
      ]);

      const rawAssessments = Array.isArray(assessRes)
        ? assessRes
        : Array.isArray(assessRes?.assessments)
        ? assessRes.assessments
        : [];

      const rawCourses = Array.isArray(courseRes?.courses)
        ? courseRes.courses
        : Array.isArray(courseRes)
        ? courseRes
        : [];

      const courseMap = new Map();
      rawCourses.forEach((c) => {
        courseMap.set(String(c.courseId || c.id), c.subjectName || c.name || 'Course');
      });

      const formatted = rawAssessments.map((asmt) => ({
        ...asmt,
        id: asmt.assessmentId || asmt.id,
        courseName: courseMap.get(String(asmt.courseId)) || asmt.courseName || 'Course'
      }));

      setAssessments(formatted);
    } catch (err) {
      console.error('[Assessments Error]:', err);
      setErrorMsg('Unable to load assessment list.');
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filteredAssessments = assessments
    .filter((asmt) => {
      if (typeFilter !== 'ALL' && asmt.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && asmt.status !== statusFilter) return false;
      return true;
    })
    .filter((asmt) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (asmt.title || '').toLowerCase().includes(q) ||
        (asmt.courseName || '').toLowerCase().includes(q) ||
        (asmt.description || '').toLowerCase().includes(q)
      );
    });

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-gray-50/50 p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading assessments...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8 bg-gray-50/50 relative">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Official Assessments</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            List of official assignments and quizzes from courses
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by title, course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-gray-200 rounded-2xl pl-9 pr-4 py-2.5 text-xs font-semibold outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 transition-all shadow-xs w-60"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
          </div>

          {/* Filter Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-600 shadow-xs cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="QUIZ">Quiz</option>
            <option value="ASSIGNMENT">Assignment</option>
          </select>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-600 shadow-xs cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">Open</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* ASSESSMENT CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssessments.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-100 p-8 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-3 font-bold">
              📝
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1">No assessments available</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mb-6 leading-relaxed">
              {searchQuery
                ? `No results match "${searchQuery}".`
                : 'Assignments or tests published by educators will appear fully here.'}
            </p>
            <Link
              to="/learner/my-courses"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md transition-all inline-flex items-center gap-2"
            >
              <span>📚</span> View Courses
            </Link>
          </div>
        ) : (
          filteredAssessments.map((asmt) => {
            const isQuiz = asmt.type === 'QUIZ';
            const isOpen = asmt.status === 'IN_PROGRESS';
            const isClosed = asmt.status === 'CLOSED';
            const allowsLate = Boolean(asmt.allowLateSubmission);
            const canAttempt = isOpen || (isClosed && allowsLate);
            const submissionStatus = asmt.submission?.status || null;
            const hasSubmitted = ['SUBMITTED', 'PENDING_REVIEW', 'GRADED'].includes(submissionStatus);
            const canReview = isClosed || hasSubmitted;

            return (
              <div
                key={asmt.id}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Header Banner */}
                <div
                  className={`p-6 text-white flex flex-col justify-between h-36 relative ${
                    isQuiz
                      ? 'bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600'
                      : 'bg-gradient-to-br from-emerald-600 via-teal-600 to-blue-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full uppercase tracking-wider truncate max-w-[160px]">
                      {asmt.courseName}
                    </span>
                    <span className="text-[9px] font-black bg-white/30 backdrop-blur-sm px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {asmt.type}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white line-clamp-1 group-hover:text-blue-100 transition-colors" title={asmt.title}>
                      {asmt.title}
                    </h3>
                    <p className="text-[11px] text-white/80 mt-0.5 font-bold">
                      Max Points: {asmt.totalPoints ?? 100} pts
                    </p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 flex flex-col justify-between flex-1 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      {getStatusBadge(asmt.status)}
                      <span className="text-[11px] text-gray-400 font-semibold">
                        Deadline: {formatDateTime(asmt.deadline)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-2">
                      {asmt.description || 'No additional instructions provided for this assessment.'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-gray-50 flex items-center justify-between gap-2">
                    {canReview ? (
                      <Link
                        to={`/learner/courses/${asmt.courseId}/assessments/${asmt.id}/review`}
                        className="w-full py-2.5 rounded-2xl text-xs font-bold text-center bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all block shadow-xs"
                      >
                        Review Submission →
                      </Link>
                    ) : canAttempt ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isQuiz) {
                            navigate(`/learner/quizzes?id=${asmt.id}`);
                          } else {
                            navigate(`/learner/courses/${asmt.courseId}/assessments/${asmt.id}/assignment`);
                          }
                        }}
                        className={`w-full py-2.5 rounded-2xl text-xs font-bold text-center text-white transition-all shadow-md ${
                          isQuiz
                            ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/15'
                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/15'
                        }`}
                      >
                        Start Assessment →
                      </button>
                    ) : (
                      <span className="w-full py-2.5 rounded-2xl text-xs font-bold text-center bg-gray-50 text-gray-400 block border border-gray-100">
                        Not Yet Open
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}