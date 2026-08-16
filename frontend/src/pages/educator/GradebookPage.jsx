import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';
import { getCourseGradebook } from '../../features/assessment/assessmentApi';

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
}

function calculatePercentage(score, totalPoints) {
  const numericScore = Number(score);
  const numericTotal = Number(totalPoints);
  if (!Number.isFinite(numericScore) || !Number.isFinite(numericTotal) || numericTotal <= 0) return null;
  return (numericScore / numericTotal) * 100;
}

export default function GradebookPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get('courseId') || '';

  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
  const [courses, setCourses] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [enrolledLearners, setEnrolledLearners] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingGradebook, setLoadingGradebook] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch available courses
  useEffect(() => {
    let cancelled = false;
    async function loadCoursesList() {
      try {
        setLoadingCourses(true);
        const result = await getCourses();
        if (!cancelled) setCourses(Array.isArray(result?.courses) ? result.courses : []);
      } catch (err) {
        if (!cancelled) console.error('Failed to load courses', err);
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    }
    loadCoursesList();
    return () => { cancelled = true; };
  }, []);

  // 2. Fetch Gradebook data when course is selected
  useEffect(() => {
    if (!selectedCourseId) {
      setAssessments([]); setEnrolledLearners([]); setSubmissions([]); setLoadError(''); setLoadingGradebook(false);
      return;
    }

    let cancelled = false;
    async function loadGradebook() {
      try {
        setLoadingGradebook(true); setLoadError('');
        const result = await getCourseGradebook(selectedCourseId);
        if (cancelled) return;
        setAssessments(Array.isArray(result?.assessments) ? result.assessments : []);
        setEnrolledLearners(Array.isArray(result?.learners) ? result.learners : []);
        setSubmissions(Array.isArray(result?.submissions) ? result.submissions : []);
      } catch (error) {
        if (!cancelled) {
          setAssessments([]); setEnrolledLearners([]); setSubmissions([]);
          setLoadError(error.message || 'Unable to load gradebook.');
        }
      } finally {
        if (!cancelled) setLoadingGradebook(false);
      }
    }
    loadGradebook();
    return () => { cancelled = true; };
  }, [selectedCourseId]);

  const availableCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      if (a.status === b.status) return String(a.subjectName || '').localeCompare(String(b.subjectName || ''));
      return a.status === 'ACTIVE' ? -1 : 1;
    });
  }, [courses]);

  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null;
    return courses.find((course) => String(course.courseId) === String(selectedCourseId));
  }, [courses, selectedCourseId]);

  const courseAssessments = useMemo(() => {
    if (!selectedCourseId) return [];
    return assessments
      .filter((a) => String(a.courseId) === String(selectedCourseId) && a.status !== 'DRAFT')
      .sort((a, b) => new Date(a.startTime || a.createdAt || 0) - new Date(b.startTime || b.createdAt || 0));
  }, [assessments, selectedCourseId]);

  const gradebookRows = useMemo(() => {
    return enrolledLearners.map((learner) => {
      const assessmentScores = courseAssessments.map((assessment) => {
        const submissionEntry = submissions.find((item) => {
          const currentSubmission = item?.submission || item;
          return (
            String(currentSubmission.assessmentId) === String(assessment.assessmentId) &&
            String(currentSubmission.learnerId) === String(learner.userId ?? learner.id) &&
            currentSubmission.status === 'GRADED'
          );
        });
        const submission = submissionEntry?.submission || submissionEntry || null;
        return { assessment, submission };
      });

      const percentages = assessmentScores.map(({ assessment, submission }) => {
        if (!submission) return null;
        return calculatePercentage(submission.score, assessment.totalPoints);
      }).filter((val) => val !== null);

      const average = percentages.length > 0 ? percentages.reduce((total, val) => total + val, 0) / percentages.length : null;
      return { learner, assessmentScores, average };
    });
  }, [enrolledLearners, courseAssessments, submissions]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return gradebookRows;
    return gradebookRows.filter(({ learner }) => {
      const name = (learner.displayName || learner.fullname || '').toLowerCase();
      const email = (learner.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [gradebookRows, searchTerm]);

  function handleCourseChange(e) {
    const nextCourseId = e.target.value;
    setSelectedCourseId(nextCourseId);
    setSearchTerm('');
    if (nextCourseId) {
      setSearchParams({ courseId: nextCourseId });
    } else {
      setSearchParams({});
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Class Gradebook</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">View official assessment scores and performance across your courses.</p>
        </div>
        <button disabled className="bg-gray-100 text-gray-400 text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs cursor-not-allowed">
          Export CSV (Coming Soon)
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* CONTROLS */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Course</label>
              <select
                value={selectedCourseId}
                onChange={handleCourseChange}
                disabled={loadingCourses}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-xs font-semibold text-gray-800 bg-gray-50 hover:bg-white focus:bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all cursor-pointer"
              >
                <option value="">{loadingCourses ? 'Loading courses...' : '-- Choose a Course --'}</option>
                {availableCourses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.subjectName} ({c.courseCode}){c.status === 'ARCHIVED' ? ' - Archived' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Search Student</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter name or email..."
                  disabled={!selectedCourseId}
                  className="w-full rounded-2xl border border-gray-200 pl-10 pr-4 py-3.5 text-xs font-semibold text-gray-800 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all disabled:opacity-50"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
            </div>
          </div>
        </section>

        {/* MESSAGES & LOADING */}
        {loadError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold flex items-center gap-2">
            ⚠️ {loadError}
          </div>
        )}

        {loadingGradebook ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mb-4"></div>
            <p className="text-xs font-bold text-gray-500">Loading gradebook matrix...</p>
          </div>
        ) : !selectedCourse ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-base font-black text-gray-900">No Course Selected</h2>
            <p className="text-xs text-gray-500 font-medium mt-2">Please select a course from the dropdown above to view grades.</p>
          </div>
        ) : (
          <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
            {/* COURSE SUMMARY HEADER */}
            <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">{selectedCourse.subjectName}</h2>
                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mt-1">{selectedCourse.courseCode}</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-center shadow-xs">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Students</p>
                  <p className="text-base font-black text-gray-900">{enrolledLearners.length}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-center shadow-xs">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assessments</p>
                  <p className="text-base font-black text-gray-900">{courseAssessments.length}</p>
                </div>
              </div>
            </div>

            {/* GRADEBOOK MATRIX */}
            {courseAssessments.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-bold text-gray-600">No published assessments.</p>
                <p className="text-xs text-gray-400 mt-1 font-medium">Create and publish an assessment to start grading.</p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-bold text-gray-600">No students found.</p>
                <p className="text-xs text-gray-400 mt-1 font-medium">Try adjusting your search term.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-black">
                    <tr>
                      <th className="px-6 py-4 sticky left-0 bg-gray-50 z-10 w-64 shadow-[1px_0_0_0_#f3f4f6]">Student</th>
                      {courseAssessments.map((a) => (
                        <th key={a.assessmentId} className="px-6 py-4 text-center border-l border-gray-100">
                          <div className="truncate max-w-[120px] mx-auto" title={a.title}>{a.title}</div>
                          <div className="text-[9px] text-blue-500 mt-1">{a.totalPoints} pts max</div>
                        </th>
                      ))}
                      <th className="px-6 py-4 text-center bg-gray-50 border-l border-gray-100">Average %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                    {filteredRows.map(({ learner, assessmentScores, average }) => {
                      const isAtRisk = average !== null && average < 50;
                      return (
                        <tr key={learner.userId ?? learner.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-6 py-4 sticky left-0 bg-white shadow-[1px_0_0_0_#f3f4f6]">
                            <div className="flex items-center gap-3">
                              {learner.avatarUrl ? (
                                <img src={learner.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black">
                                  {getInitials(learner.displayName || learner.fullname)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-gray-900 truncate">{learner.displayName || learner.fullname || 'Unknown'}</p>
                                <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">{learner.email}</p>
                              </div>
                            </div>
                          </td>
                          {assessmentScores.map(({ assessment, submission }) => (
                            <td key={assessment.assessmentId} className="px-6 py-4 text-center border-l border-gray-50">
                              {submission ? (
                                <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-black ${calculatePercentage(submission.score, assessment.totalPoints) < 50 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-800'}`}>
                                  {submission.score}
                                </span>
                              ) : (
                                <span className="text-gray-300 font-medium">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-6 py-4 text-center bg-gray-50/50 border-l border-gray-50">
                            {average !== null ? (
                              <span className={`inline-flex items-center justify-center w-12 h-6 rounded-full text-[11px] font-black ${isAtRisk ? 'bg-red-500 text-white shadow-sm' : 'bg-emerald-100 text-emerald-700'}`}>
                                {average.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-300 font-medium">N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}