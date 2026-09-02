import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';
import { getCourseMembers } from '../../features/classroom/enrollmentApi';
import {
  getAssessmentById,
  getAssessmentQuestions,
  getAssessmentSubmissions,
  getSubmissionById,
  gradeSubmission
} from '../../features/assessment/assessmentApi';

function formatDateTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
}

function getStatusBadge(status) {
  switch (status) {
    case 'IN_PROGRESS': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'SUBMITTED': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'PENDING_REVIEW': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'GRADED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function getFileNameFromUrl(url, index) {
  if (!url) return `Submitted file ${index + 1}`;
  try {
    const cleanUrl = String(url).split('?')[0];
    const storedFileName = cleanUrl.split('/').pop();
    if (!storedFileName) return `Submitted file ${index + 1}`;
    const decodedFileName = decodeURIComponent(storedFileName);
    const separatorIndex = decodedFileName.indexOf('__');
    if (separatorIndex !== -1) return decodedFileName.slice(separatorIndex + 2);
    return decodedFileName || `Submitted file ${index + 1}`;
  } catch {
    return `Submitted file ${index + 1}`;
  }
}

function normalizeFile(file, index) {
  if (typeof file === 'string') {
    return { name: getFileNameFromUrl(file, index), url: file };
  }
  return {
    ...file,
    name: file?.name || file?.fileName || getFileNameFromUrl(file?.url || file?.fileUrl, index),
    url: file?.url || file?.fileUrl || ''
  };
}

function normalizeSubmission(submission) {
  if (!submission) return null;
  const directFiles = Array.isArray(submission.files) ? submission.files : [];
  const uploadedFileUrls = Array.isArray(submission.uploadedFileUrls) ? submission.uploadedFileUrls : [];
  const rawFiles = directFiles.length > 0 ? directFiles : uploadedFileUrls;

  return {
    ...submission,
    isLate: submission.isLate ?? submission.late ?? false,
    answers: Array.isArray(submission.answers) ? submission.answers : [],
    files: rawFiles.map(normalizeFile)
  };
}

export default function AssessmentSubmissionsPage() {
  const { courseId: routeCourseId, assessmentId: routeAssessmentId } = useParams();
  const courseId = routeCourseId || null;
  const assessmentId = routeAssessmentId || null;

  const [course, setCourse] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [learners, setLearners] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  
  const [openingSubmissionId, setOpeningSubmissionId] = useState(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reviewError, setReviewError] = useState('');

  const gradeInFlightRef = useRef(false);
  const openingSubmissionInFlightRef = useRef(new Set());

  useEffect(() => {
    if (!courseId || !assessmentId) {
      setLoading(false); return;
    }
    let cancelled = false;

    async function loadSubmissionsPage() {
      try {
        setLoading(true); setLoadError('');
        const [courseRes, assessRes, qRes, subRes, memberRes] = await Promise.all([
          getCourses(),
          getAssessmentById(assessmentId),
          getAssessmentQuestions(assessmentId),
          getAssessmentSubmissions(assessmentId),
          getCourseMembers(courseId)
        ]);

        const courses = Array.isArray(courseRes?.courses) ? courseRes.courses : [];
        const foundCourse = courses.find((item) => String(item.courseId) === String(courseId)) || null;
        const loadedAssessment = assessRes?.assessment || assessRes || null;
        const loadedQuestions = Array.isArray(qRes?.questions) ? qRes.questions : [];
        const rawEntries = Array.isArray(subRes?.submissions) ? subRes.submissions : [];
        const loadedSubmissions = rawEntries.map((entry) => normalizeSubmission(entry?.submission || entry)).filter(Boolean);

        const embeddedLearners = rawEntries.map((entry) => entry?.learner || entry?.user || null).filter(Boolean);
        const memberRows = Array.isArray(memberRes?.members) ? memberRes.members : [];
        const memberLearners = memberRows.map((m) => m?.learner || m?.user || null).filter(Boolean);

        const learnerMap = new Map();
        [...memberLearners, ...embeddedLearners].forEach((learner) => {
          const lId = learner?.userId ?? learner?.id;
          if (lId) learnerMap.set(String(lId), learner);
        });

        if (cancelled) return;
        setCourse(foundCourse);
        setAssessment(loadedAssessment);
        setAssessmentQuestions(loadedQuestions);
        setSubmissions(loadedSubmissions);
        setLearners(Array.from(learnerMap.values()));
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Unable to load assessment submissions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSubmissionsPage();
    return () => { cancelled = true; };
  }, [assessmentId, courseId]);

  const assessmentSubmissions = useMemo(() => {
    return submissions
      .filter((s) => String(s.assessmentId) === String(assessmentId))
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  }, [submissions, assessmentId]);

  const rows = useMemo(() => {
    return assessmentSubmissions.map((submission) => {
      const learner = learners.find((user) => String(user.userId ?? user.id) === String(submission.learnerId));
      return {
        submission,
        learner: learner || { userId: submission.learnerId, displayName: 'Unknown Learner', email: 'N/A', avatarUrl: null }
      };
    });
  }, [assessmentSubmissions, learners]);

  const filteredRows = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter(({ submission }) => submission.status === filter);
  }, [rows, filter]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading submissions...</p>
        </div>
      </div>
    );
  }

  if (loadError || !course || !assessment) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50 space-y-4">
        <p className="text-sm font-bold text-red-500">{loadError || 'Submissions not found.'}</p>
        <Link to={`/educator/courses/${courseId}/assessments`} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition">
          Back to Assessments
        </Link>
      </div>
    );
  }

  const isArchived = course.status === 'ARCHIVED';
  const pendingReviewCount = assessmentSubmissions.filter((s) => s.status === 'PENDING_REVIEW').length;
  const gradedCount = assessmentSubmissions.filter((s) => s.status === 'GRADED').length;
  const submittedCount = assessmentSubmissions.filter((s) => s.status === 'SUBMITTED').length;

  async function openSubmission(submission) {
    if (!submission) return;

    const submissionId = String(submission.submissionId);
    if (openingSubmissionInFlightRef.current.has(submissionId)) return;

    openingSubmissionInFlightRef.current.add(submissionId);
    setOpeningSubmissionId(submission.submissionId);

    try {
      setReviewError('');
      const result = await getSubmissionById(submission.submissionId);
      const detailSubmission = result?.submission || result || {};
      const merged = normalizeSubmission({
        ...submission,
        ...detailSubmission,
        answers: Array.isArray(result?.answers) ? result.answers : (Array.isArray(detailSubmission?.answers) ? detailSubmission.answers : []),
        files: Array.isArray(result?.files) ? result.files : detailSubmission?.files
      });
      setSelectedSubmission(merged);
      setScore(merged.score ?? '');
      setFeedback(merged.feedback ?? '');
    } catch (error) {
      alert(error.message || 'Unable to load submission details.');
    } finally {
      openingSubmissionInFlightRef.current.delete(submissionId);
      setOpeningSubmissionId(null);
    }
  }

  function closeSubmission() {
    setSelectedSubmission(null); setScore(''); setFeedback(''); setReviewError('');
  }

  async function handleSaveGrade() {
    if (!selectedSubmission || gradeInFlightRef.current) return;
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > Number(assessment.totalPoints)) {
      setReviewError(`Score must be between 0 and ${assessment.totalPoints}.`);
      return;
    }

    gradeInFlightRef.current = true;
    setSavingGrade(true);

    try {
      setReviewError('');
      const result = await gradeSubmission(selectedSubmission.submissionId, numericScore, feedback.trim() || null);
      const graded = normalizeSubmission({ ...selectedSubmission, ...(result?.submission || {}) });

      setSubmissions((prev) => prev.map((s) => String(s.submissionId) === String(graded.submissionId) ? { ...s, ...graded } : s));
      closeSubmission();
    } catch (error) {
      setReviewError(error.message || 'Unable to save grade.');
    } finally {
      gradeInFlightRef.current = false;
      setSavingGrade(false);
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
            <Link to={`/educator/courses/${course.courseId}/assessments`} className="hover:text-blue-600 transition">Assessments</Link>
            <span>/</span>
            <span className="text-gray-700">Submissions</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Assessment Submissions</h1>
        </div>
        <Link to={`/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}`} className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs">
          View Assessment Details
        </Link>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {isArchived && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-2xl px-5 py-4">
            This course is archived. Submission data is available for viewing only.
          </div>
        )}

        {/* ASSESSMENT INFO SUMMARY CARD */}
        <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div>
              <h2 className="text-lg font-black text-gray-900">{assessment.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 rounded-full px-3 py-1 uppercase">{assessment.type}</span>
                <span className="text-xs font-semibold text-gray-400">Total Points: <strong className="text-gray-800">{assessment.totalPoints}</strong></span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Total" value={assessmentSubmissions.length} />
              <MiniStat label="Submitted" value={submittedCount} />
              <MiniStat label="Pending Review" value={pendingReviewCount} color="text-amber-600" />
              <MiniStat label="Graded" value={gradedCount} color="text-emerald-600" />
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterButton active={filter === 'ALL'} label="All Submissions" count={assessmentSubmissions.length} onClick={() => setFilter('ALL')} />
          <FilterButton active={filter === 'SUBMITTED'} label="Submitted" count={submittedCount} onClick={() => setFilter('SUBMITTED')} />
          <FilterButton active={filter === 'PENDING_REVIEW'} label="Pending Review" count={pendingReviewCount} onClick={() => setFilter('PENDING_REVIEW')} />
          <FilterButton active={filter === 'GRADED'} label="Graded" count={gradedCount} onClick={() => setFilter('GRADED')} />
        </div>

        {/* SUBMISSIONS TABLE */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          {filteredRows.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm font-bold text-gray-600">No submissions found</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">There are no submissions matching the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-400 uppercase font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Learner</th>
                    <th className="px-6 py-4">Submitted At</th>
                    <th className="px-6 py-4">Timeliness</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Score</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                  {filteredRows.map(({ submission, learner }) => (
                    <tr key={submission.submissionId} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4"><LearnerIdentity learner={learner} /></td>
                      <td className="px-6 py-4 text-gray-500">{formatDateTime(submission.submittedAt)}</td>
                      <td className="px-6 py-4">
                        {submission.submittedAt ? (
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${submission.isLate ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {submission.isLate ? 'Late' : 'On Time'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400">Not submitted</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusBadge(submission.status)}`}>
                          {submission.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-gray-900">
                        {submission.score === null || submission.score === undefined ? '—' : `${submission.score} / ${assessment.totalPoints}`}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openSubmission(submission)}
                          disabled={String(openingSubmissionId) === String(submission.submissionId)}
                          className={`px-4 py-2 font-bold rounded-xl transition shadow-xs ${submission.status === 'PENDING_REVIEW' ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'}`}
                        >
                          {String(openingSubmissionId) === String(submission.submissionId) ? 'Loading...' : submission.status === 'PENDING_REVIEW' ? 'Review & Grade' : submission.status === 'GRADED' ? 'Edit Grade & Feedback' : 'View Submission'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* REVIEW & GRADING MODAL */}
      {selectedSubmission && (
        <SubmissionReviewModal
          submission={selectedSubmission}
          learner={learners.find((user) => String(user.userId ?? user.id) === String(selectedSubmission.learnerId)) || { displayName: 'Unknown Learner', email: 'N/A' }}
          assessment={assessment}
          questions={assessmentQuestions}
          score={score}
          setScore={setScore}
          feedback={feedback}
          setFeedback={setFeedback}
          error={reviewError}
          savingGrade={savingGrade}
          isArchived={isArchived}
          onClose={closeSubmission}
          onSave={handleSaveGrade}
        />
      )}
    </div>
  );
}

function SubmissionReviewModal({
  submission, learner, assessment, questions, score, setScore, feedback, setFeedback, error, savingGrade, isArchived, onClose, onSave
}) {
  const canGrade = !isArchived && !savingGrade && ['PENDING_REVIEW', 'GRADED'].includes(submission.status);
  const answers = Array.isArray(submission.answers) ? submission.answers : [];
  const files = Array.isArray(submission.files) ? submission.files : [];

  function findQuestionForAnswer(answer, index) {
    return questions.find((q) => String(q.questionId) === String(answer.questionId)) || questions[index] || null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">Submission Review & Grading</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{learner.displayName || learner.fullname || learner.email}</p>
          </div>
          <button
            onClick={onClose}
            disabled={savingGrade}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-400 flex items-center justify-center text-sm shadow-sm disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoBox label="Submitted At" value={formatDateTime(submission.submittedAt)} />
            <InfoBox
              label="Timeliness"
              value={submission.submittedAt ? (submission.isLate ? 'Late' : 'On Time') : 'Not submitted'}
            />
            <InfoBox label="Status" value={submission.status} />
            <InfoBox label="Score" value={submission.score !== null && submission.score !== undefined ? `${submission.score} / ${assessment.totalPoints}` : 'Not Graded'} />
          </div>

          {/* ANSWERS */}
          <section className="space-y-3">
            <h3 className="text-sm font-black text-gray-900">Learner Answers</h3>
            {answers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No text answers submitted.</p>
            ) : (
              <div className="space-y-3">
                {answers.map((answer, index) => {
                  const q = findQuestionForAnswer(answer, index);
                  return (
                    <div key={answer.answerId ?? index} className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-2">
                      <p className="text-[10px] font-black uppercase text-blue-600">Question {index + 1}</p>
                      {q?.content && <p className="text-xs font-bold text-gray-800">{q.content}</p>}
                      <p className="text-xs text-gray-700 bg-white p-3 rounded-xl border border-gray-200 mt-2 whitespace-pre-wrap">{answer.response ?? 'No answer provided.'}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* FILES */}
          {files.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-black text-gray-900">Submitted Files</h3>
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <a key={idx} href={file.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3.5 bg-blue-50/50 hover:bg-blue-100/60 border border-blue-100 rounded-2xl transition group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-base">📎</span>
                      <span className="text-xs font-bold text-gray-800 truncate">{file.name}</span>
                    </div>
                    <span className="text-xs font-bold text-blue-600 group-hover:underline flex-shrink-0 ml-4">Open ↗</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* GRADING SECTION */}
          <section className="border-t border-gray-100 pt-5 space-y-4">
            <h3 className="text-sm font-black text-gray-900">Manual Grading & Feedback</h3>
            {!canGrade && (
              <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-medium">
                {isArchived ? 'Course is archived (read-only).' : 'This submission is not available for manual grading.'}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Score (Max: {assessment.totalPoints})</label>
                <input
                  type="number"
                  min="0"
                  max={assessment.totalPoints}
                  value={score}
                  disabled={!canGrade}
                  onChange={(e) => setScore(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-xs font-bold outline-none focus:border-blue-500 bg-gray-50 disabled:bg-gray-100"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Feedback</label>
                <textarea
                  rows={3}
                  value={feedback}
                  disabled={!canGrade}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide constructive feedback..."
                  className="w-full rounded-xl border border-gray-200 p-3 text-xs outline-none focus:border-blue-500 bg-gray-50 disabled:bg-gray-100 resize-none leading-relaxed"
                />
              </div>
            </div>
            {error && <p className="text-xs font-bold text-red-500">{error}</p>}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={savingGrade}
            className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition disabled:opacity-50"
          >
            Close
          </button>
          {canGrade && (
            <button onClick={onSave} disabled={savingGrade} className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition disabled:opacity-50">
              {savingGrade ? 'Saving...' : submission.status === 'GRADED' ? 'Update Grade & Feedback' : 'Save Grade & Feedback'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LearnerIdentity({ learner }) {
  const displayName = learner.displayName || learner.fullname || 'Unknown Learner';
  return (
    <div className="flex items-center gap-3">
      {learner.avatarUrl ? (
        <img src={learner.avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black border border-blue-100">
          {getInitials(displayName)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-900 truncate">{displayName}</p>
        <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">{learner.email}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-3 min-w-[85px] border border-gray-100">
      <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{label}</p>
      <p className={`text-base font-black mt-1 ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function FilterButton({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-bold px-4 py-2.5 rounded-2xl border transition shadow-xs ${active ? 'border-blue-600 bg-blue-600 text-white shadow-blue-600/15' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
    >
      {label} ({count})
    </button>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
      <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{label}</p>
      <p className="text-xs font-black text-gray-800 mt-1 truncate">{value}</p>
    </div>
  );
}