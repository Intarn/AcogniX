// frontend/src/pages/learner/CourseAssessments.jsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCourses } from '../../services/courseService';
import { getLearnerAssessments } from '../../services/assessmentService';
import { useToast } from '../../contexts/ToastContext';

function resolveFileUrl(rawUrl, defaultBucket = 'materials') {
  if (!rawUrl) return '';
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const cleanPath = trimmed.replace(/^\/+/, '');
  if (cleanPath.startsWith('materials/') || cleanPath.startsWith('announcements/') || cleanPath.startsWith('avatars/')) {
    return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
  }
  return `${supabaseUrl}/storage/v1/object/public/${defaultBucket}/${cleanPath}`;
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

function getStatusBadge(status) {
  switch (status) {
    case 'IN_PROGRESS':
      return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">Open</span>;
    case 'SCHEDULED':
      return <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">Scheduled</span>;
    case 'CLOSED':
      return <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">Closed</span>;
    default:
      return <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">{status}</span>;
  }
}

export default function CourseAssessments() {
  const { courseId } = useParams();
  const { showToast } = useToast();
  const [course, setCourse] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    async function loadPage() {
      try {
        setLoading(true);
        setLoadError('');
        const [courseResult, assessmentResult] = await Promise.all([
          getCourses(),
          getLearnerAssessments()
        ]);

        const courseList = Array.isArray(courseResult?.courses) ? courseResult.courses : (Array.isArray(courseResult) ? courseResult : []);
        const foundCourse = courseList.find((item) => String(item.courseId) === String(courseId)) || null;
        if (!foundCourse) throw new Error('Class not found.');

        const allAssessments = Array.isArray(assessmentResult?.assessments) ? assessmentResult.assessments : (Array.isArray(assessmentResult) ? assessmentResult : []);
        const courseAssessments = allAssessments
          .filter((a) => String(a.courseId) === String(courseId))
          .sort((a, b) => new Date(a.startTime || a.createdAt || 0).getTime() - new Date(b.startTime || b.createdAt || 0).getTime());

        setCourse(foundCourse);
        setAssessments(courseAssessments);
      } catch (error) {
        setLoadError(error.message || 'Unable to load assessment list.');
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [courseId]);

  const handleDownloadInstruction = async (e, rawUrl, fileName, id) => {
    e.preventDefault();
    e.stopPropagation();
    const resolvedUrl = resolveFileUrl(rawUrl);
    if (!resolvedUrl) {
      showToast('Instruction file unavailable.', 'warning');
      return;
    }

    try {
      setDownloadingId(id);
      const res = await fetch(resolvedUrl);
      if (!res.ok) {
        if (res.status === 404) {
          showToast('Instruction file does not exist in storage (404 Not Found).', 'error');
          return;
        }
        throw new Error(`File download error (Code: ${res.status})`);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'instruction-file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      showToast('Instruction file downloaded successfully!', 'success');
    } catch (err) {
      console.error('[Download Instruction Error]:', err);
      showToast('Unable to download instruction file. Please contact the educator.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenInstruction = (e, rawUrl) => {
    e.preventDefault();
    e.stopPropagation();
    const resolvedUrl = resolveFileUrl(rawUrl);
    if (!resolvedUrl) {
      showToast('Invalid file path.', 'warning');
      return;
    }
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading assessments...</p>
        </div>
      </main>
    );
  }

  if (loadError || !course) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50">
        <p className="text-sm font-bold text-red-500">{loadError}</p>
        <Link to="/learner/my-courses" className="mt-3 text-xs font-bold text-blue-600 hover:underline">
          ← Back to course list
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8 bg-gray-50/50">
      {/* BREADCRUMB & HEADER */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
          <Link to="/learner/my-courses" className="hover:text-blue-600 transition-colors">My Courses</Link>
          <span>/</span>
          <Link to={`/learner/courses/${course.courseId}`} className="hover:text-blue-600 transition-colors">{course.subjectName}</Link>
          <span>/</span>
          <span className="text-gray-700 font-bold">Assessments & Evaluations</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Assessments & Evaluations</h1>
      </div>

      {/* ASSESSMENTS CONTAINER */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
        {assessments.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl mb-3 font-bold">
              📝
            </div>
            <p className="text-sm font-bold text-gray-700">No assessments in this course</p>
            <p className="text-xs text-gray-400 mt-1">Quizzes or assignments from educators will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assessments.map((assessment) => {
              const isQuiz = assessment.type === 'QUIZ';
              const isOpen = assessment.status === 'IN_PROGRESS';
              const isClosed = assessment.status === 'CLOSED';
              const allowsLate = Boolean(assessment.allowLateSubmission);
              const canAttempt = isOpen || (isClosed && allowsLate);
              const submissionStatus = assessment.submission?.status || null;
              const hasSubmitted = ['SUBMITTED', 'PENDING_REVIEW', 'GRADED'].includes(submissionStatus);
              const canReview = isClosed || hasSubmitted;
              const isDownloading = downloadingId === assessment.assessmentId;

              return (
                <div
                  key={assessment.assessmentId}
                  className="border border-gray-100 rounded-2xl p-5 flex items-start justify-between gap-4 hover:border-indigo-200 hover:shadow-xs transition-all bg-white"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 text-xl">
                      {isQuiz ? '⚡' : '📋'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900 truncate">{assessment.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isQuiz ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {assessment.type}
                        </span>
                        {getStatusBadge(assessment.status)}
                      </div>
                      {assessment.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{assessment.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400 font-semibold flex-wrap">
                        <span>Max Points: <strong className="text-gray-700">{assessment.totalPoints ?? 10}</strong></span>
                        <span>• Deadline: <strong className="text-gray-700">{formatDateTime(assessment.deadline)}</strong></span>
                      </div>

                      {/* INSTRUCTION FILE BUTTONS */}
                      {assessment.instructionFileUrl && (
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            type="button"
                            onClick={(e) => handleDownloadInstruction(e, assessment.instructionFileUrl, `Instruction-${assessment.title}`, assessment.assessmentId)}
                            disabled={isDownloading}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline"
                          >
                            <span>{isDownloading ? '⏳' : '📥'}</span> {isDownloading ? 'Downloading...' : 'Download instruction file'}
                          </button>
                          <span className="text-gray-300">•</span>
                          <button
                            type="button"
                            onClick={(e) => handleOpenInstruction(e, assessment.instructionFileUrl)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                          >
                            <span>👁️</span> View directly
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canReview && (
                      <Link
                        to={`/learner/courses/${course.courseId}/assessments/${assessment.assessmentId}/review`}
                        className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
                      >
                        Review Submission
                      </Link>
                    )}
                    {!canReview && canAttempt && (
                      <Link
                        to={isQuiz ? `/learner/quizzes?id=${assessment.assessmentId}` : `/learner/courses/${course.courseId}/assessments/${assessment.assessmentId}/assignment`}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        Start Now →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}