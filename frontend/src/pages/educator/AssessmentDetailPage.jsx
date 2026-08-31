import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';
import {
  getAssessmentById,
  getAssessmentQuestions,
  getAssessmentSubmissions,
  getAssessmentInstructionFileBlob
} from '../../features/assessment/assessmentApi';
import DocumentPreviewModal from '../../components/common/DocumentPreviewModal';
import { getFileNameFromContentDisposition } from '../../utils/documentPreview';

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

function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined) return '';
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.ceil(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusBadge(status) {
  switch (status) {
    case 'DRAFT': return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'SCHEDULED': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'IN_PROGRESS': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'CLOSED': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

export default function AssessmentDetailPage() {
  const { courseId: routeCourseId, assessmentId: routeAssessmentId } = useParams();
  const courseId = routeCourseId || null;
  const assessmentId = routeAssessmentId || null;

  const [course, setCourse] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [instructionFileAction, setInstructionFileAction] = useState('');
  const [instructionPreview, setInstructionPreview] = useState(null);
  const instructionFileInFlightRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!courseId || !assessmentId) {
      setLoading(false); return;
    }
    let cancelled = false;

    async function loadDetail() {
      try {
        setLoading(true); setLoadError('');
        const [courseRes, assessRes, qRes, subRes] = await Promise.all([
          getCourses(),
          getAssessmentById(assessmentId),
          getAssessmentQuestions(assessmentId),
          getAssessmentSubmissions(assessmentId)
        ]);

        const courses = Array.isArray(courseRes?.courses) ? courseRes.courses : [];
        const foundCourse = courses.find((c) => String(c.courseId) === String(courseId)) || null;
        const loadedAssessment = assessRes?.assessment || assessRes || null;

        if (cancelled) return;
        setCourse(foundCourse);
        setAssessment(loadedAssessment);
        setQuestions(Array.isArray(qRes?.questions) ? qRes.questions : []);
        setSubmissions(Array.isArray(subRes?.submissions) ? subRes.submissions : []);
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Unable to load assessment details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDetail();
    return () => { cancelled = true; };
  }, [assessmentId, courseId]);

  const questionPointsTotal = useMemo(() => {
    return questions.reduce((total, q) => total + Number(q.points || 0), 0);
  }, [questions]);

  const pendingReviewCount = useMemo(() => submissions.filter((s) => s?.status === 'PENDING_REVIEW').length, [submissions]);
  const gradedCount = useMemo(() => submissions.filter((s) => s?.status === 'GRADED').length, [submissions]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading assessment details...</p>
        </div>
      </div>
    );
  }

  if (loadError || !assessment || !course) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50 space-y-4">
        <p className="text-sm font-bold text-red-500">{loadError || 'Assessment not found.'}</p>
        <Link to={`/educator/courses/${courseId}/assessments`} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition">
          Back to Assessments
        </Link>
      </div>
    );
  }

  const courseArchived = course.status === 'ARCHIVED';
  const editable = !courseArchived && (assessment.status === 'DRAFT' || assessment.status === 'SCHEDULED');

  async function handleInstructionFile(action) {
    if (!assessmentId || instructionFileInFlightRef.current) return;

    instructionFileInFlightRef.current = true;
    setInstructionFileAction(action);

    try {
      const { blob, contentType, contentDisposition } =
        await getAssessmentInstructionFileBlob(assessmentId, {
          download: action === 'download'
        });
      const fallbackName =
        assessment.instructionFileName ||
        `Assessment-${assessmentId}-Instruction`;
      const fileName = getFileNameFromContentDisposition(
        contentDisposition,
        fallbackName
      );

      if (action === 'download') {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
      } else {
        setInstructionPreview({ blob, contentType, fileName });
      }
    } catch (error) {
      alert(
        error.message ||
        'Unable to access Assessment instruction file.'
      );
    } finally {
      instructionFileInFlightRef.current = false;
      setInstructionFileAction('');
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
            <span className="text-gray-700 truncate">{assessment.title}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-black text-gray-900 tracking-tight">{assessment.title}</h1>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusBadge(assessment.status)}`}>
              {assessment.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/submissions`} className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs">
            View Submissions ({submissions.length})
          </Link>
          {editable && (
            <Link to={`/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/edit`} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md">
              Edit Assessment
            </Link>
          )}
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {courseArchived && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-2xl px-5 py-4">
            This course is archived. Assessment information is available for viewing only.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* OVERVIEW CARD */}
            <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-black text-gray-900">Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Type</span>
                  <span className="text-xs font-black text-gray-900 mt-1 block uppercase">{assessment.type}</span>
                </div>
                <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Points</span>
                  <span className="text-lg font-black text-gray-900 mt-1 block">{assessment.totalPoints ?? 0}</span>
                </div>
                <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Questions</span>
                  <span className="text-lg font-black text-gray-900 mt-1 block">{questions.length}</span>
                </div>
                <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Submissions</span>
                  <span className="text-lg font-black text-blue-600 mt-1 block">{submissions.length}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Description</p>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50/40 p-4 rounded-2xl border border-gray-50">
                  {assessment.description || 'No description provided.'}
                </p>
              </div>
            </section>

            {/* INSTRUCTIONS & FILE */}
            <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-black text-gray-900">Instructions & Reference File</h2>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50/40 p-4 rounded-2xl border border-gray-50">
                {assessment.instructions || 'No written instructions provided.'}
              </p>
              {assessment.instructionFileUrl && (
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Instruction File</p>
                    <p className="text-xs font-bold text-gray-800 truncate mt-0.5">{assessment.instructionFileName || 'Assessment instruction file'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleInstructionFile('open')}
                      disabled={Boolean(instructionFileAction)}
                      className="text-xs font-bold text-blue-600 bg-white border border-blue-200 px-4 py-2 rounded-xl shadow-xs hover:bg-blue-50 disabled:opacity-50 transition"
                    >
                      {instructionFileAction === 'open'
                        ? 'Opening...'
                        : 'View'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInstructionFile('download')}
                      disabled={Boolean(instructionFileAction)}
                      className="text-xs font-bold text-emerald-700 bg-white border border-emerald-200 px-4 py-2 rounded-xl shadow-xs hover:bg-emerald-50 disabled:opacity-50 transition"
                    >
                      {instructionFileAction === 'download'
                        ? 'Downloading...'
                        : 'Download'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* QUESTIONS LIST */}
            <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-gray-900">Questions ({questions.length})</h2>
                <span className="text-xs font-bold text-gray-500">{questionPointsTotal} / {assessment.totalPoints ?? 0} points</span>
              </div>
              {questions.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-gray-400">No questions added yet.</div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <div key={q.questionId || idx} className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-blue-600">Question {idx + 1}</span>
                        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-gray-200">{q.points} pts</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 leading-relaxed">{q.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-6">
            <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Schedule</h2>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-gray-400 font-semibold block">Start Time</span>
                  <span className="font-bold text-gray-800 mt-0.5 block">{formatDateTime(assessment.startTime)}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block">Deadline</span>
                  <span className="font-bold text-gray-800 mt-0.5 block">{formatDateTime(assessment.deadline)}</span>
                </div>
                <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-gray-400 font-semibold">Late Submission</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${assessment.allowLateSubmission ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {assessment.allowLateSubmission ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Submissions</h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-semibold">Total Submissions</span>
                  <span className="font-black text-gray-900">{submissions.length}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-semibold">Pending Review</span>
                  <span className="font-black text-amber-600">{pendingReviewCount}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 font-semibold">Graded</span>
                  <span className="font-black text-emerald-600">{gradedCount}</span>
                </div>
              </div>
              <Link to={`/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/submissions`} className="block w-full text-center py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md transition">
                Manage Submissions &rarr;
              </Link>
            </section>
          </div>
        </div>
      </main>

      <DocumentPreviewModal
        open={Boolean(instructionPreview)}
        title={assessment?.title ? `${assessment.title} - Instruction File` : 'Instruction File'}
        fileName={instructionPreview?.fileName}
        blob={instructionPreview?.blob}
        contentType={instructionPreview?.contentType}
        onClose={() => setInstructionPreview(null)}
        onDownload={() => handleInstructionFile('download')}
        downloading={instructionFileAction === 'download'}
      />
    </div>
  );
}