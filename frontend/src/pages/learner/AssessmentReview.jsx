// frontend/src/pages/learner/AssessmentReview.jsx
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCourses } from '../../services/courseService';
import { getAssessmentReview, getAssessmentInstructionFileBlob } from '../../services/quizService';
import { useToast } from '../../contexts/ToastContext';

async function fetchStorageBlob(rawUrl, defaultBucket = 'assessment-files') {
  if (!rawUrl) return null;
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const res = await fetch(trimmed);
      if (res.ok) {
        const blob = await res.blob();
        return { blob, url: trimmed };
      }
    } catch {}
  }

  const cleanPath = trimmed
    .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\//i, '')
    .replace(/^\/+/, '');

  let pathWithoutBucket = cleanPath;
  const candidateBuckets = ['assessment-files', 'assessments', 'materials', 'announcements'];
  for (const b of candidateBuckets) {
    if (cleanPath.startsWith(`${b}/`)) {
      pathWithoutBucket = cleanPath.slice(b.length + 1);
      break;
    }
  }

  for (const bucket of candidateBuckets) {
    const candidateUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${pathWithoutBucket}`;
    try {
      const res = await fetch(candidateUrl);
      if (res.ok) {
        const blob = await res.blob();
        return { blob, url: candidateUrl };
      }
    } catch {}
  }

  return null;
}

function getSubmittedFileName(fileUrl, index) {
  if (!fileUrl) return `Submitted file ${index + 1}`;

  try {
    const cleanValue = decodeURIComponent(String(fileUrl).split('?')[0]);
    const storedName = cleanValue.split('/').pop() || '';
    if (!storedName) return `Submitted file ${index + 1}`;

    // Submission files are stored as: <uuid>__<original-file-name>
    return storedName.replace(/^[0-9a-fA-F-]{36}__/, '') || storedName;
  } catch {
    return `Submitted file ${index + 1}`;
  }
}

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

export default function AssessmentReview() {
  const { courseId, assessmentId } = useParams();
  const { showToast } = useToast();
  const [course, setCourse] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [downloadingInstruction, setDownloadingInstruction] = useState(false);
  const [openingInstruction, setOpeningInstruction] = useState(false);
  const instructionFileInFlightRef = useRef(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setLoadError('');

        const [courseRes, reviewRes] = await Promise.all([
          getCourses(),
          getAssessmentReview(assessmentId)
        ]);

        const courseList = Array.isArray(courseRes?.courses) ? courseRes.courses : (Array.isArray(courseRes) ? courseRes : []);
        const foundCourse = courseList.find(c => String(c.courseId) === String(courseId));
        if (!foundCourse) throw new Error('Course not found.');

        const reviewAssessment = reviewRes?.assessment;
        if (!reviewAssessment) throw new Error('Assessment not found.');

        setCourse(foundCourse);
        setAssessment({
          ...reviewAssessment,
          submission: reviewRes?.submission || null,
          submittedFiles: Array.isArray(reviewRes?.files) ? reviewRes.files.filter(Boolean) : [],
          answers: Array.isArray(reviewRes?.answers) ? reviewRes.answers : [],
          questions: Array.isArray(reviewRes?.questions) ? reviewRes.questions : []
        });
      } catch (err) {
        console.error('[AssessmentReview Error]:', err);
        setLoadError(err.message || 'Unable to load submission details.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [courseId, assessmentId]);

  const handleDownloadInstruction = async (e, _rawUrl, fileName) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !assessmentId ||
      instructionFileInFlightRef.current
    ) {
      return;
    }

    instructionFileInFlightRef.current = true;

    try {
      setDownloadingInstruction(true);

      const { blob } =
        await getAssessmentInstructionFileBlob(
          assessmentId,
          { download: true }
        );

      const blobUrl =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = blobUrl;
      link.download =
        fileName ||
        'instruction-file';

      document.body
        .appendChild(link);

      link.click();
      link.remove();

      window.URL
        .revokeObjectURL(blobUrl);

      showToast(
        'Instruction file downloaded successfully!',
        'success'
      );
    } catch (error) {
      showToast(
        error.message ||
        'Unable to download instruction file.',
        'error'
      );
    } finally {
      instructionFileInFlightRef.current = false;
      setDownloadingInstruction(false);
    }
  };

  const handleOpenInstruction = async (e, _rawUrl) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !assessmentId ||
      instructionFileInFlightRef.current
    ) {
      return;
    }

    instructionFileInFlightRef.current = true;

    const previewWindow =
      window.open('', '_blank');

    if (!previewWindow) {
      instructionFileInFlightRef.current = false;
      showToast(
        'Unable to open the preview window. Please allow pop-ups for this site and try again.',
        'warning'
      );
      return;
    }

    previewWindow.opener = null;

    try {
      setOpeningInstruction(true);

      const { blob } =
        await getAssessmentInstructionFileBlob(
          assessmentId
        );

      const blobUrl =
        window.URL.createObjectURL(blob);

      if (!previewWindow.closed) {
        previewWindow.location.href = blobUrl;
      }

      window.setTimeout(
        () =>
          window.URL
            .revokeObjectURL(blobUrl),
        60_000
      );
    } catch (error) {
      if (!previewWindow.closed) {
        previewWindow.close();
      }
      showToast(
        error.message ||
        'Unable to open instruction file.',
        'error'
      );
    } finally {
      instructionFileInFlightRef.current = false;
      setOpeningInstruction(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading submission results...</p>
        </div>
      </main>
    );
  }

  if (loadError || !assessment) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50">
        <p className="text-sm font-bold text-red-500">{loadError || 'Assessment does not exist.'}</p>
        <Link to={`/learner/courses/${courseId}/assessments`} className="mt-3 text-xs font-bold text-blue-600 hover:underline">
          ← Back to assessment list
        </Link>
      </main>
    );
  }

  const submission = assessment.submission || {};
  const isAssignment = assessment.type === 'ASSIGNMENT';

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-6 bg-gray-50/50">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* BREADCRUMB */}
        <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold flex-wrap">
          <Link to="/learner/my-courses" className="hover:text-blue-600 transition-colors">My Courses</Link>
          <span>/</span>
          <Link to={`/learner/courses/${courseId}`} className="hover:text-blue-600 transition-colors">{course?.subjectName || 'Course'}</Link>
          <span>/</span>
          <Link to={`/learner/courses/${courseId}/assessments`} className="hover:text-blue-600 transition-colors">Assessments</Link>
          <span>/</span>
          <span className="text-gray-700 font-bold">{assessment.title}</span>
        </div>

        {/* TOP BANNER */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800 flex items-center justify-between">
          <div>
            <p className="font-bold">Read-only assessment review</p>
            <p className="text-blue-600 mt-0.5">The assessment is closed. You can review the instructions and your submission results.</p>
          </div>
          <span className="px-2.5 py-1 bg-white rounded-xl text-[10px] font-black uppercase text-blue-700 shadow-xs">
            {assessment.status}
          </span>
        </div>

        {/* ASSESSMENT HEADER CARD */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-gray-900 tracking-tight">{assessment.title}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${isAssignment ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                {assessment.type}
              </span>
            </div>
            <Link
              to={`/learner/courses/${courseId}/assessments`}
              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 transition-colors self-start sm:self-auto"
            >
              Back to Assessments
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50/60 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Points</span>
              <span className="text-lg font-black text-gray-900 mt-1 block">{assessment.totalPoints ?? 100}</span>
            </div>
            <div className="p-4 bg-gray-50/60 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Start Time</span>
              <span className="text-xs font-bold text-gray-800 mt-1 block">{formatDateTime(assessment.startTime)}</span>
            </div>
            <div className="p-4 bg-gray-50/60 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Deadline</span>
              <span className="text-xs font-bold text-gray-800 mt-1 block">{formatDateTime(assessment.deadline)}</span>
            </div>
            <div className="p-4 bg-gray-50/60 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Course</span>
              <span className="text-xs font-bold text-gray-800 mt-1 block truncate">{course?.subjectName}</span>
            </div>
          </div>
        </div>

        {/* SUBMISSION DETAILS */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-black text-gray-900">Your Submission</h2>
            <p className="text-xs text-gray-400 mt-0.5">Submission status, score and feedback.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50/60 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Status</span>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-white rounded-lg text-xs font-black uppercase text-gray-800 border border-gray-200">
                {submission.status || 'NOT SUBMITTED'}
              </span>
            </div>
            <div className="p-4 bg-gray-50/60 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Submitted At</span>
              <span className="text-xs font-bold text-gray-800 mt-1 block">{formatDateTime(submission.submittedAt)}</span>
            </div>
            <div className="p-4 bg-gray-50/60 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Score</span>
              <span className="text-lg font-black text-blue-600 mt-1 block">
                {submission.score !== undefined && submission.score !== null ? `${submission.score} / ${assessment.totalPoints ?? 100}` : 'Pending'}
              </span>
            </div>
            <div className="p-4 bg-gray-50/60 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Submission Time</span>
              {submission.submittedAt ? (
                submission.late || submission.isLate ? (
                  <span className="inline-block mt-1 px-2.5 py-0.5 bg-red-50 text-red-700 rounded-lg text-[10px] font-black uppercase border border-red-200">
                    Turned in late
                  </span>
                ) : (
                  <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase border border-emerald-200">
                    ON TIME
                  </span>
                )
              ) : (
                <span className="inline-block mt-1 text-xs font-bold text-gray-500">
                  Not submitted
                </span>
              )}
            </div>
          </div>

          {isAssignment && (
            <div>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Submitted Files
              </h3>

              {Array.isArray(assessment.submittedFiles) && assessment.submittedFiles.length > 0 ? (
                <div className="space-y-2">
                  {assessment.submittedFiles.map((fileUrl, index) => {
                    const fileName = getSubmittedFileName(fileUrl, index);

                    return (
                      <div
                        key={`${fileUrl}-${index}`}
                        className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="text-base flex-shrink-0">📎</span>
                          <span
                            className="text-xs font-bold text-gray-700 truncate"
                            title={fileName}
                          >
                            {fileName}
                          </span>
                        </div>

                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-xl transition"
                        >
                          Open File ↗
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-500">
                  No submitted file is attached to this submission.
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Educator Feedback</h3>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-600 leading-relaxed italic">
              {submission.feedback || 'No feedback has been provided yet.'}
            </div>
          </div>
        </div>

        {/* QUESTIONS / INSTRUCTIONS */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-black text-gray-900">Assessment Content</h2>
            <p className="text-xs text-gray-400 mt-0.5">Instructions and submitted answers.</p>
          </div>

          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
            {assessment.description || 'No additional instructions provided for this assessment.'}
          </div>

          {assessment.instructionFileUrl && (
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => handleDownloadInstruction(e, assessment.instructionFileUrl, `Instruction-${assessment.title}`)}
                disabled={downloadingInstruction || openingInstruction}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition shadow-xs disabled:opacity-50"
              >
                <span>{downloadingInstruction ? '⏳' : '📥'}</span>
                {downloadingInstruction ? 'Downloading...' : 'Download attached instruction file'}
              </button>

              <button
                type="button"
                onClick={(e) => handleOpenInstruction(e, assessment.instructionFileUrl)}
                disabled={downloadingInstruction || openingInstruction}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition shadow-xs disabled:opacity-50"
              >
                <span>👁️</span>
                {openingInstruction ? 'Opening...' : 'View instruction directly'}
              </button>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}