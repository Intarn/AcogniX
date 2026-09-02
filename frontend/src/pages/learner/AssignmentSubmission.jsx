// frontend/src/pages/learner/AssignmentSubmission.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getOpenAssessment,
  startSubmission,
  getSubmissionAnswers,
  saveAnswer,
  uploadSubmissionFiles,
  deleteSubmissionFile,
  submitSubmissionAPI,
  getAssessmentInstructionFileBlob
} from '../../services/quizService';
import { useConfirm } from '../../contexts/ConfirmContext';
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
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getOriginalFileName(fileUrl, index = 0) {
  if (!fileUrl) return `File ${index + 1}`;
  const storedName = String(fileUrl).split('/').pop();
  if (!storedName) return `File ${index + 1}`;
  const separatorIndex = storedName.indexOf('__');
  if (separatorIndex === -1) return storedName;
  return storedName.slice(separatorIndex + 2);
}

export default function AssignmentSubmission() {
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const { courseId, assessmentId } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [savingQuestionId, setSavingQuestionId] = useState(null);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingFileUrl, setDeletingFileUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [downloadingInstruction, setDownloadingInstruction] = useState(false);
  const [openingInstruction, setOpeningInstruction] = useState(false);
  const instructionFileActionInFlightRef = useRef(false);

  const isResubmission = ['SUBMITTED', 'PENDING_REVIEW'].includes(submission?.status);

  useEffect(() => {
    if (!courseId || !assessmentId) {
      setLoading(false);
      setLoadError('Missing Course ID or Assessment ID.');
      return;
    }

    let cancelled = false;

    async function initializeAssignment() {
      try {
        setLoading(true);
        setLoadError('');

        const { assessment: loadedAssessment, questions: loadedQuestions } =
          await getOpenAssessment(assessmentId);

        if (!loadedAssessment) throw new Error('Assignment not found.');
        if (String(loadedAssessment.courseId) !== String(courseId)) {
          throw new Error('This assignment does not belong to the selected course.');
        }

        if (cancelled) return;
        setAssessment(loadedAssessment);
        setQuestions(Array.isArray(loadedQuestions) ? loadedQuestions : []);

        try {
          const submissionResult = await startSubmission(assessmentId);
          if (cancelled) return;

          const currentSubmission = submissionResult.submission;
          setSubmission(currentSubmission);

          const answerResult = await getSubmissionAnswers(currentSubmission.submissionId);
          const savedAnswers = Array.isArray(answerResult?.answers) ? answerResult.answers : [];

          const answerMap = {};
          savedAnswers.forEach((ans) => {
            answerMap[ans.questionId] = ans.response ?? '';
          });
          setUserAnswers(answerMap);

          const existingFileUrls = Array.isArray(currentSubmission?.uploadedFileUrls)
            ? currentSubmission.uploadedFileUrls
            : [];

          setUploadedFiles(
            existingFileUrls.map((fileUrl, index) => ({
              fileUrl,
              fileName: getOriginalFileName(fileUrl, index),
              sizeBytes: null
            }))
          );
        } catch (submissionError) {
          if (submissionError.code === 'ASSESSMENT_ALREADY_SUBMITTED') {
            navigate(
              `/learner/courses/${courseId}/assessments/${assessmentId}/review`,
              { replace: true }
            );
            return;
          }
          throw submissionError;
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(error.message || 'Unable to load assignment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initializeAssignment();
    return () => {
      cancelled = true;
    };
  }, [courseId, assessmentId, navigate]);

  const handleDownloadInstruction = async (e, _rawUrl, fileName) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !assessmentId ||
      instructionFileActionInFlightRef.current
    ) {
      return;
    }

    instructionFileActionInFlightRef.current = true;

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

      document.body.appendChild(link);
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
      instructionFileActionInFlightRef.current = false;
      setDownloadingInstruction(false);
    }
  };

  const handleOpenInstruction = async (e, _rawUrl) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !assessmentId ||
      instructionFileActionInFlightRef.current
    ) {
      return;
    }

    instructionFileActionInFlightRef.current = true;

    const previewWindow =
      window.open('', '_blank');

    if (!previewWindow) {
      instructionFileActionInFlightRef.current = false;
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
      instructionFileActionInFlightRef.current = false;
      setOpeningInstruction(false);
    }
  };

  async function handleSaveAnswer(questionId, response) {
    if (!submission) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: response }));

    try {
      setSavingQuestionId(questionId);
      await saveAnswer(submission.submissionId, questionId, response);
    } catch (error) {
      showToast(error.message || 'Unable to save answer.', 'error');
    } finally {
      setSavingQuestionId(null);
    }
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files.slice(0, 10));
  }

  async function handleUploadFiles() {
    if (!submission) return;
    if (selectedFiles.length === 0) {
      showToast('Please select at least one file.', 'warning');
      return;
    }

    try {
      setUploading(true);
      const result = await uploadSubmissionFiles(submission.submissionId, selectedFiles);
      const newlyUploaded = Array.isArray(result?.files) ? result.files : [];

      setUploadedFiles((prev) => [...prev, ...newlyUploaded]);
      setSelectedFiles([]);
      showToast('Files uploaded successfully!', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to upload files.', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteUploadedFile(file) {
    if (!submission || !file?.fileUrl) return;
    const fileName = file.fileName || 'this file';

    const confirmed = await confirm({
      title: 'Delete Attachment',
      message: `Are you sure you want to delete file "${fileName}" from the submission?`,
      confirmLabel: 'Delete File',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });

    if (!confirmed) return;

    try {
      setDeletingFileUrl(file.fileUrl);
      await deleteSubmissionFile(submission.submissionId, file.fileUrl);
      setUploadedFiles((prev) => prev.filter((item) => item.fileUrl !== file.fileUrl));
      showToast(`File "${fileName}" deleted successfully!`, 'success');
    } catch (error) {
      showToast(error.message || 'Unable to delete file.', 'error');
    } finally {
      setDeletingFileUrl(null);
    }
  }

  async function handleSubmitAssignment() {
    if (!submission) return;

    const hasUploadedFiles = uploadedFiles.length > 0;
    const hasSelectedFiles = selectedFiles.length > 0;
    const hasAnswers = Object.values(userAnswers).some((ans) => String(ans ?? '').trim() !== '');

    if (!hasUploadedFiles && !hasSelectedFiles && !hasAnswers) {
      showToast('Please answer questions or attach files before submitting.', 'warning');
      return;
    }

    const confirmed = await confirm({
      title: isResubmission ? 'Resubmit Assignment?' : 'Confirm Assignment Submission?',
      message: isResubmission
        ? 'Are you sure you want to resubmit? Your latest answers and files will be recorded.'
        : 'Are you sure you want to submit? You can still edit while the deadline is open.',
      confirmLabel: isResubmission ? 'Resubmit' : 'Submit Now',
      cancelLabel: 'Cancel',
      tone: 'success'
    });

    if (!confirmed) return;

    try {
      setSubmitting(true);

      for (const question of questions) {
        const response = userAnswers[question.questionId];
        if (response !== undefined && String(response).trim() !== '') {
          await saveAnswer(submission.submissionId, question.questionId, response);
        }
      }

      if (selectedFiles.length > 0) {
        await uploadSubmissionFiles(submission.submissionId, selectedFiles);
      }

      await submitSubmissionAPI(submission.submissionId);
      showToast(
        isResubmission ? 'Assignment resubmitted successfully!' : 'Assignment submitted successfully!',
        'success'
      );
      setCompleted(true);
    } catch (error) {
      showToast(error.message || 'Unable to submit assignment.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Preparing assignment...</p>
        </div>
      </main>
    );
  }

  if (loadError || !assessment) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-8 text-center max-w-md w-full space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-2xl mx-auto font-bold">
            ⚠️
          </div>
          <h2 className="text-lg font-black text-gray-800">Assignment Unavailable</h2>
          <p className="text-xs text-gray-500">{loadError || 'Unable to load assignment.'}</p>
          <Link
            to={`/learner/courses/${courseId}/assessments`}
            className="inline-block px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md transition"
          >
            ← Back to List
          </Link>
        </div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden text-center animate-fadeIn">
          <div className="bg-emerald-600 text-white p-8 space-y-2">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto text-3xl font-black mb-2">
              🎉
            </div>
            <h2 className="text-2xl font-black">
              {isResubmission ? 'Assignment Resubmitted' : 'Assignment Submitted Successfully'}
            </h2>
            <p className="text-xs text-emerald-100">
              Your submission has been recorded and is pending educator review.
            </p>
          </div>
          <div className="p-8 flex items-center justify-center gap-3">
            <Link
              to={`/learner/courses/${courseId}/assessments/${assessmentId}/review`}
              className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md transition"
            >
              Review Submission →
            </Link>
            <Link
              to={`/learner/courses/${courseId}/assessments`}
              className="px-6 py-3 rounded-2xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition"
            >
              Back to List
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-6 bg-gray-50/50">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* BREADCRUMB */}
        <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold flex-wrap">
          <Link to="/learner/my-courses" className="hover:text-blue-600 transition-colors">My Courses</Link>
          <span>/</span>
          <Link to={`/learner/courses/${courseId}`} className="hover:text-blue-600 transition-colors">Course</Link>
          <span>/</span>
          <Link to={`/learner/courses/${courseId}/assessments`} className="hover:text-blue-600 transition-colors">Assessments</Link>
          <span>/</span>
          <span className="text-gray-700 font-bold">{assessment.title}</span>
        </div>

        {/* ASSIGNMENT INFO CARD */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-gray-900">{assessment.title}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                  ASSIGNMENT
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase">
                  {assessment.status}
                </span>
              </div>
              {assessment.description && (
                <p className="text-xs text-gray-600 mt-2 leading-relaxed whitespace-pre-wrap">
                  {assessment.description}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50/60 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Max Points</span>
              <span className="text-lg font-black text-gray-900 mt-0.5 block">{assessment.totalPoints ?? 100}</span>
            </div>
            <div className="bg-gray-50/60 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Start Time</span>
              <span className="text-xs font-bold text-gray-800 mt-1 block">{formatDateTime(assessment.startTime)}</span>
            </div>
            <div className="bg-gray-50/60 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Deadline</span>
              <span className="text-xs font-bold text-gray-800 mt-1 block">{formatDateTime(assessment.deadline)}</span>
            </div>
          </div>

          {assessment.instructionFileUrl && (
            <div className="pt-4 border-t border-gray-100 flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => handleDownloadInstruction(e, assessment.instructionFileUrl, `Instruction-${assessment.title}`)}
                disabled={downloadingInstruction || openingInstruction}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition shadow-xs disabled:opacity-50"
              >
                <span>{downloadingInstruction ? '⏳' : '📥'}</span>
                {downloadingInstruction ? 'Downloading file...' : 'Download instruction file'}
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
        </section>

        {/* QUESTIONS */}
        {questions.length > 0 && (
          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-base font-black text-gray-900">Assignment Questions</h2>
              <p className="text-xs text-gray-400 mt-0.5">Enter answers directly below (Auto-saves draft).</p>
            </div>

            <div className="divide-y divide-gray-100 space-y-6">
              {questions.map((question, index) => {
                const currentAnswer = userAnswers[question.questionId] ?? '';
                const isSaving = savingQuestionId === question.questionId;
                const isMultipleChoice = question.type === 'MULTIPLE_CHOICE';

                return (
                  <div key={question.questionId || index} className="pt-6 first:pt-0 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black">
                          {index + 1}
                        </span>
                        <h3 className="text-sm font-bold text-gray-800">{question.content}</h3>
                      </div>
                      {isSaving && <span className="text-[10px] font-bold text-blue-500">Saving...</span>}
                    </div>

                    {!isMultipleChoice ? (
                      <textarea
                        value={currentAnswer}
                        onChange={(e) =>
                          setUserAnswers((prev) => ({ ...prev, [question.questionId]: e.target.value }))
                        }
                        onBlur={(e) => handleSaveAnswer(question.questionId, e.target.value)}
                        rows={4}
                        placeholder="Enter your answer..."
                        className="w-full bg-gray-50/60 text-xs text-gray-800 rounded-2xl p-4 border border-gray-200 outline-none focus:border-blue-600 focus:bg-white transition"
                      />
                    ) : (
                      <div className="space-y-2">
                        {(question.options || []).map((option, oIdx) => {
                          const optionContent =
                            option && typeof option === 'object'
                              ? String(option.content ?? '')
                              : String(option ?? '');
                          const selected = currentAnswer === optionContent;

                          return (
                            <label
                              key={oIdx}
                              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition ${
                                selected
                                  ? 'border-blue-600 bg-blue-50/50'
                                  : 'border-gray-100 hover:border-gray-200 bg-white'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`assignment-${question.questionId}`}
                                checked={selected}
                                onChange={() => handleSaveAnswer(question.questionId, optionContent)}
                                className="accent-blue-600"
                              />
                              <span className="text-xs font-bold text-gray-700">{optionContent}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* FILE UPLOADS SECTION */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-base font-black text-gray-900">Submission Attachments</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload your work files (Maximum 10 files).</p>
          </div>

          <label className="block border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/20 rounded-3xl p-8 text-center cursor-pointer transition">
            <input type="file" multiple onChange={handleFileChange} className="hidden" />
            <div className="text-3xl mb-2">📎</div>
            <p className="text-xs font-bold text-gray-700">Choose files from computer</p>
            <p className="text-[11px] text-gray-400 mt-1">Supports common document formats (PDF, DOCX, ZIP...)</p>
          </label>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-600 block">Files waiting to upload:</span>
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-xs font-bold text-gray-700 truncate max-w-xs">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-xs font-bold text-red-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleUploadFiles}
                disabled={uploading}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Confirm Upload Files'}
              </button>
            </div>
          )}

          {uploadedFiles.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-600 block">Successfully uploaded files:</span>
              <div className="space-y-2">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-base">📄</span>
                      <span className="text-xs font-bold text-emerald-800 truncate">{file.fileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteUploadedFile(file)}
                      disabled={deletingFileUrl === file.fileUrl}
                      className="text-xs font-bold text-red-500 hover:underline flex-shrink-0 ml-2"
                    >
                      {deletingFileUrl === file.fileUrl ? 'Deleting...' : 'Delete File'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={handleSubmitAssignment}
              disabled={submitting || uploading}
              className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/20 hover:shadow-xl transition disabled:opacity-50"
            >
              {submitting
                ? 'Submitting...'
                : isResubmission
                ? 'Resubmit Assignment'
                : 'Complete & Submit'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}