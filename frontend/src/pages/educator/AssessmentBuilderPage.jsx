// frontend/src/pages/educator/AssessmentBuilderPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';
import {
  addAssessmentQuestion,
  createAssessment,
  deleteAssessmentQuestion,
  getAssessmentById,
  getAssessmentQuestions,
  publishAssessment,
  scheduleAssessment,
  updateAssessment,
  updateAssessmentQuestion,
  uploadInstructionFile
} from '../../features/assessment/assessmentApi';
import { useToast } from '../../contexts/ToastContext';

function resolveFileUrl(rawUrl, defaultBucket = 'assessment-files') {
  if (!rawUrl) return '';
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const cleanPath = trimmed.replace(/^\/+/, '');
  const candidateBuckets = ['assessment-files', 'assessments', 'materials', 'announcements'];
  for (const b of candidateBuckets) {
    if (cleanPath.startsWith(`${b}/`)) {
      return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
    }
  }
  return `${supabaseUrl}/storage/v1/object/public/${defaultBucket}/${cleanPath}`;
}

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

function createEmptyQuestionForm() {
  return {
    type: 'MULTIPLE_CHOICE',
    content: '',
    points: 10,
    options: [
      { optionId: 1, content: '', isCorrect: true },
      { optionId: 2, content: '', isCorrect: false }
    ]
  };
}

function isAssessmentEditable(assessment) {
  return assessment.status === 'DRAFT' || assessment.status === 'SCHEDULED';
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function buildQuestionPayload(question, index) {
  return {
    content: question.content.trim(),
    type: question.type,
    points: Number(question.points),
    displayOrder: index + 1,
    options:
      question.type === 'MULTIPLE_CHOICE'
        ? question.options.map((option) => ({
            content: option.content.trim(),
            isCorrect: Boolean(option.isCorrect)
          }))
        : []
  };
}

function normalizeQuestion(question) {
  const rawOptions = Array.isArray(question?.options) ? question.options : [];
  const options = rawOptions.map((option, index) => {
    if (option && typeof option === 'object') {
      return {
        optionId: option.optionId || `${question.questionId}-option-${index + 1}`,
        content: option.content || '',
        isCorrect:
          option.isCorrect === true ||
          (question.correctAnswer != null &&
            String(option.content) === String(question.correctAnswer))
      };
    }
    const content = String(option ?? '');
    return {
      optionId: `${question.questionId}-option-${index + 1}`,
      content,
      isCorrect: question.correctAnswer != null && content === String(question.correctAnswer)
    };
  });
  return {
    ...question,
    options: question.type === 'MULTIPLE_CHOICE' ? options : []
  };
}

function autoDistributePoints(totalPoints, questions) {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const count = questions.length;
  const numericTotal = Number(totalPoints) || 0;
  const rawPointsPerQuestion = numericTotal / count;
  const basePoints = Math.floor(rawPointsPerQuestion * 10) / 10;
  let accumulatedPoints = 0;
  return questions.map((q, index) => {
    if (index === count - 1) {
      const finalPoints = Number((numericTotal - accumulatedPoints).toFixed(1));
      return { ...q, points: Math.max(0, finalPoints) };
    }
    accumulatedPoints += basePoints;
    return { ...q, points: basePoints };
  });
}

export default function AssessmentBuilderPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { courseId: routeCourseId, assessmentId: routeAssessmentId } = useParams();
  const courseId = routeCourseId || null;
  const assessmentId = routeAssessmentId || null;
  const isEditMode = Boolean(assessmentId);

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('QUIZ');
  const [totalPoints, setTotalPoints] = useState(100);
  const [startTime, setStartTime] = useState('');
  const [deadline, setDeadline] = useState('');
  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [instructionFile, setInstructionFile] = useState(null);
  const [existingInstructionFileUrl, setExistingInstructionFileUrl] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [questions, setQuestions] = useState([]);
  const [errors, setErrors] = useState({});
  const [downloadingExisting, setDownloadingExisting] = useState(false);

  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [questionForm, setQuestionForm] = useState(createEmptyQuestionForm);
  const [questionErrors, setQuestionErrors] = useState({});
  const [blockedMessage, setBlockedMessage] = useState('');

  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setLoadError('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function loadBuilderData() {
      try {
        setLoading(true);
        setLoadError('');
        const [courseResult, assessmentResult, questionResult] = await Promise.all([
          getCourses(),
          isEditMode ? getAssessmentById(assessmentId) : Promise.resolve(null),
          isEditMode ? getAssessmentQuestions(assessmentId) : Promise.resolve({ questions: [] })
        ]);
        const courses = Array.isArray(courseResult?.courses) ? courseResult.courses : [];
        const foundCourse =
          courses.find((item) => String(item.courseId) === String(courseId)) || null;
        if (cancelled) return;
        setCourse(foundCourse);

        if (!isEditMode) {
          setQuestions([]);
          setExistingInstructionFileUrl('');
          return;
        }

        const assessment = assessmentResult?.assessment || assessmentResult;
        if (!assessment) {
          showToast('Assessment not found.', 'error');
          navigate(`/educator/courses/${courseId}/assessments`, { replace: true });
          return;
        }

        if (!isAssessmentEditable(assessment)) {
          setBlockedMessage(
            'This assessment is in progress or closed and can no longer be edited.'
          );
          return;
        }

        setTitle(assessment.title || '');
        setDescription(assessment.description || '');
        setType(assessment.type || 'QUIZ');
        setTotalPoints(Number(assessment.totalPoints) || 0);
        setStartTime(toDateTimeLocalValue(assessment.startTime));
        setDeadline(toDateTimeLocalValue(assessment.deadline));
        setAllowLateSubmission(Boolean(assessment.allowLateSubmission));
        setInstructions(assessment.instructions || '');
        setInstructionFile(null);
        setExistingInstructionFileUrl(assessment.instructionFileUrl || '');
        setStatus(assessment.status || 'DRAFT');

        const loadedQuestions = Array.isArray(questionResult?.questions)
          ? questionResult.questions.map(normalizeQuestion)
          : [];
        setQuestions(loadedQuestions);
      } catch (error) {
        if (!cancelled) {
          console.error('[Builder Error]:', error);
          setCourse(null);
          setLoadError(error.message || 'Unable to load the assessment.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadBuilderData();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, courseId, isEditMode, navigate]);

  const handleDownloadExistingFile = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!existingInstructionFileUrl) return;

    try {
      setDownloadingExisting(true);
      showToast('Downloading instruction file...', 'info');
      const result = await fetchStorageBlob(existingInstructionFileUrl, 'assessment-files');
      if (!result) {
        showToast('The instruction file could not be found in storage (NoSuchKey).', 'error');
        return;
      }
      const blobUrl = window.URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Assessment-${title || 'instruction-file'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      showToast('Instruction file downloaded successfully.', 'success');
    } catch (err) {
      showToast('Unable to download the file.', 'error');
    } finally {
      setDownloadingExisting(false);
    }
  };

  const handleOpenExistingFile = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!existingInstructionFileUrl) return;

    try {
      showToast('Opening instruction file...', 'info');
      const result = await fetchStorageBlob(existingInstructionFileUrl, 'assessment-files');
      if (!result) {
        showToast('The instruction file could not be found in storage (NoSuchKey).', 'error');
        return;
      }
      const blobUrl = window.URL.createObjectURL(result.blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast('Unable to open the file.', 'error');
    }
  };

  const questionPointsTotal = useMemo(() => {
    return questions.reduce((total, question) => total + Number(question.points || 0), 0);
  }, [questions]);

  async function handleAutoDistribute() {
    const updated = autoDistributePoints(totalPoints, questions);
    setQuestions(updated);
    updateError('questionPoints');

    if (!isEditMode || updated.length === 0) return;

    try {
      await Promise.all(
        updated.map((question) =>
          updateAssessmentQuestion(assessmentId, question.questionId, {
            points: Number(question.points)
          })
        )
      );
      showToast('Question points distributed successfully.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to distribute question points.', 'error');
      const questionResult = await getAssessmentQuestions(assessmentId).catch(() => ({ questions: [] }));
      setQuestions(
        Array.isArray(questionResult?.questions)
          ? questionResult.questions.map(normalizeQuestion)
          : []
      );
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center bg-gray-50 flex-1 flex items-center justify-center">
        <p className="text-sm font-bold text-gray-500">Preparing assessment builder...</p>
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="p-8 text-center bg-gray-50 flex-1 flex flex-col items-center justify-center">
        <p className="text-sm font-bold text-red-500">{loadError || 'Course not found.'}</p>
        <Link to="/educator/courses" className="inline-block mt-3 text-xs font-bold text-blue-600 hover:underline">
          ← Back to Courses
        </Link>
      </div>
    );
  }

  if (blockedMessage) {
    return (
      <div className="p-8 text-center bg-gray-50 flex-1 flex flex-col items-center justify-center space-y-3">
        <p className="text-sm font-bold text-amber-700">{blockedMessage}</p>
        <Link to={`/educator/courses/${courseId}/assessments`} className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm">
          ← Back to Assessments
        </Link>
      </div>
    );
  }

  function updateError(field) {
    setErrors((previous) => ({ ...previous, [field]: null }));
  }

  function validateAssessment({ publishing = false } = {}) {
    const nextErrors = {};
    if (!title.trim()) nextErrors.title = 'Assessment title cannot be empty.';
    const numericPoints = Number(totalPoints);
    if (!Number.isFinite(numericPoints) || numericPoints <= 0) {
      nextErrors.totalPoints = 'Total points must be greater than 0.';
    }
    if (publishing &&
      questions.length > 0 &&
      Number.isFinite(numericPoints) &&
      Math.abs(questionPointsTotal - numericPoints) > 0.001
    ) {
      nextErrors.questionPoints = `The sum of question points (${questionPointsTotal}) must equal the assessment total points (${numericPoints}) before publishing.`;
    }
    if (publishing) {
      if (!startTime) nextErrors.startTime = 'Start time is required when publishing.';
      if (!deadline) nextErrors.deadline = 'Deadline is required when publishing.';
      if (startTime && deadline && new Date(deadline) <= new Date(startTime)) {
        nextErrors.deadline = 'Deadline must be after the start time.';
      }
      if (questions.length === 0 && !instructionFile && !existingInstructionFileUrl) {
        nextErrors.content = 'Add at least one question or attach an instruction file before publishing.';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveAssessment(targetStatus) {
    const publishing = targetStatus === 'SCHEDULED';
    if (!validateAssessment({ publishing })) return;

    const startTimeIso = startTime ? new Date(startTime).toISOString() : null;
    const deadlineIso = deadline ? new Date(deadline).toISOString() : null;

    try {
      if (!isEditMode) {
        // Step 1: Create the Assessment as a DRAFT first so an immediate start time does not lock file upload.
        const result = await createAssessment(courseId, {
          title: title.trim(),
          description: description.trim() || null,
          instructions: instructions.trim() || null,
          type,
          totalPoints: Number(totalPoints),
          allowLateSubmission,
          startTime: null,
          deadline: null,
          questions: questions.map(buildQuestionPayload)
        });
        const newAssessmentId = result.assessment?.assessmentId || result.assessment?.id;

        // Step 2: Upload the instruction file.
        if (instructionFile && newAssessmentId) {
          await uploadInstructionFile(newAssessmentId, instructionFile);
        }

        // Step 3: Configure the schedule and publish if requested.
        if (publishing && startTimeIso && deadlineIso && newAssessmentId) {
          await scheduleAssessment(newAssessmentId, startTimeIso, deadlineIso);
          await publishAssessment(newAssessmentId);
        } else if (startTimeIso && deadlineIso && newAssessmentId) {
          await scheduleAssessment(newAssessmentId, startTimeIso, deadlineIso);
        }

        showToast(publishing ? 'Assessment published successfully.' : 'Draft saved successfully.', 'success');
        navigate(`/educator/courses/${courseId}/assessments`);
        return;
      }

      // Edit mode
      if (instructionFile) {
        await uploadInstructionFile(assessmentId, instructionFile);
      }

      await updateAssessment(assessmentId, {
        title: title.trim(),
        description: description.trim() || null,
        type,
        totalPoints: Number(totalPoints),
        allowLateSubmission
      });

      if (startTimeIso && deadlineIso) {
        await scheduleAssessment(assessmentId, startTimeIso, deadlineIso);
      }
      if (publishing) {
        await publishAssessment(assessmentId);
      }

      showToast('Assessment updated successfully.', 'success');
      navigate(`/educator/courses/${courseId}/assessments`);
    } catch (error) {
      console.error('[Save Assessment Error]:', error);
      showToast(error.message || 'Unable to save the assessment.', 'error');
    }
  }

  function openAddQuestion() {
    setEditingQuestionId(null);
    setQuestionForm(createEmptyQuestionForm());
    setQuestionErrors({});
    setQuestionModalOpen(true);
  }

  function openEditQuestion(question) {
    setEditingQuestionId(question.questionId);
    setQuestionForm({
      type: question.type,
      content: question.content,
      points: question.points,
      options: Array.isArray(question.options) ? question.options.map((opt) => ({ ...opt })) : []
    });
    setQuestionErrors({});
    setQuestionModalOpen(true);
  }

  function closeQuestionModal() {
    setQuestionModalOpen(false);
    setEditingQuestionId(null);
    setQuestionForm(createEmptyQuestionForm());
    setQuestionErrors({});
  }

  function updateQuestionField(field, value) {
    setQuestionForm((previous) => ({ ...previous, [field]: value }));
    setQuestionErrors((previous) => ({ ...previous, [field]: null }));
  }

  function changeQuestionType(nextType) {
    if (nextType === 'MULTIPLE_CHOICE') {
      setQuestionForm((previous) => ({
        ...previous,
        type: 'MULTIPLE_CHOICE',
        options:
          previous.options.length >= 2 ? previous.options : createEmptyQuestionForm().options
      }));
    } else {
      setQuestionForm((previous) => ({ ...previous, type: 'ESSAY', options: [] }));
    }
    setQuestionErrors({});
  }

  function addOption() {
    setQuestionForm((previous) => ({
      ...previous,
      options: [
        ...previous.options,
        {
          optionId: `temp-option-${Date.now()}-${previous.options.length + 1}`,
          content: '',
          isCorrect: false
        }
      ]
    }));
  }

  function updateOption(optionId, field, value) {
    setQuestionForm((previous) => ({
      ...previous,
      options: previous.options.map((option) => {
        const isTarget = String(option.optionId) === String(optionId);
        if (field === 'isCorrect') {
          return { ...option, isCorrect: isTarget };
        }
        if (isTarget) {
          return { ...option, [field]: value };
        }
        return option;
      })
    }));
    setQuestionErrors((previous) => ({ ...previous, options: null }));
  }

  function removeOption(optionId) {
    setQuestionForm((previous) => ({
      ...previous,
      options: previous.options.filter((option) => String(option.optionId) !== String(optionId))
    }));
  }

  function validateQuestion() {
    const nextErrors = {};
    if (!questionForm.content.trim()) nextErrors.content = 'Question content cannot be empty.';
    const points = Number(questionForm.points);
    if (!Number.isFinite(points) || points <= 0) {
      nextErrors.points = 'Question points must be greater than 0.';
    }
    if (questionForm.type === 'MULTIPLE_CHOICE') {
      if (questionForm.options.length < 2) {
        nextErrors.options = 'A multiple-choice question requires at least two options.';
      }
      if (questionForm.options.some((opt) => !opt.content.trim())) {
        nextErrors.options = 'All answer options must contain text.';
      }
      const correctCount = questionForm.options.filter((opt) => opt.isCorrect).length;
      if (correctCount !== 1) {
        nextErrors.options = 'Select exactly one correct answer.';
      }
    }
    setQuestionErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleDeleteQuestion(question) {
    if (!question) return;

    if (!isEditMode || String(question.questionId || '').startsWith('temp-question-')) {
      setQuestions((previous) => previous.filter((item) => item !== question));
      updateError('questionPoints');
      return;
    }

    try {
      await deleteAssessmentQuestion(assessmentId, question.questionId);
      setQuestions((previous) =>
        previous.filter((item) => String(item.questionId) !== String(question.questionId))
      );
      updateError('questionPoints');
      showToast('Question deleted successfully.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to delete the question.', 'error');
    }
  }

  async function saveQuestion() {
    if (!validateQuestion()) return;
    const editingIndex =
      editingQuestionId !== null
        ? questions.findIndex((q) => String(q.questionId) === String(editingQuestionId))
        : -1;
    const payload = buildQuestionPayload(
      questionForm,
      editingIndex >= 0 ? editingIndex : questions.length
    );

    try {
      if (!isEditMode) {
        if (editingQuestionId !== null) {
          setQuestions((prev) =>
            prev.map((q) =>
              String(q.questionId) === String(editingQuestionId)
                ? {
                    ...q,
                    ...payload,
                    options:
                      questionForm.type === 'MULTIPLE_CHOICE'
                        ? questionForm.options.map((opt) => ({ ...opt, content: opt.content.trim() }))
                        : []
                  }
                : q
            )
          );
          updateError('questionPoints');
          closeQuestionModal();
          return;
        }
        const newQuestion = {
          ...payload,
          questionId: `temp-question-${Date.now()}-${questions.length + 1}`,
          options:
            questionForm.type === 'MULTIPLE_CHOICE'
              ? questionForm.options.map((opt) => ({ ...opt, content: opt.content.trim() }))
              : []
        };
        setQuestions((prev) => [...prev, newQuestion]);
        updateError('questionPoints');
        closeQuestionModal();
        return;
      }

      if (editingQuestionId !== null) {
        const result = await updateAssessmentQuestion(assessmentId, editingQuestionId, payload);
        const updated = normalizeQuestion(result.question);
        setQuestions((prev) =>
          prev.map((q) => (String(q.questionId) === String(editingQuestionId) ? updated : q))
        );
        updateError('questionPoints');
        closeQuestionModal();
        return;
      }

      const result = await addAssessmentQuestion(assessmentId, payload);
      const newQ = normalizeQuestion(result.question);
      setQuestions((prev) => [...prev, newQ]);
      updateError('questionPoints');
      closeQuestionModal();
    } catch (error) {
      showToast(error.message || 'Unable to save the question.', 'error');
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-50/50 space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold mb-1">
            <Link to="/educator/courses" className="hover:text-blue-600">My Courses</Link>
            <span>/</span>
            <Link to={`/educator/courses/${course.courseId}`} className="hover:text-blue-600">{course.subjectName}</Link>
            <span>/</span>
            <Link to={`/educator/courses/${course.courseId}/assessments`} className="hover:text-blue-600">Assessments</Link>
            <span>/</span>
            <span className="text-gray-700 font-bold">{isEditMode ? 'Edit' : 'Create'}</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {isEditMode ? 'Edit Assessment' : 'Create New Assessment'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/educator/courses/${courseId}/assessments`)}
            className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveAssessment('DRAFT')}
            className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => saveAssessment('SCHEDULED')}
            className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl shadow-md transition"
          >
            Publish Assessment
          </button>
        </div>
      </div>

      {/* FORM CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-6xl">
        <div className="xl:col-span-2 space-y-6">
          {/* BASIC INFORMATION */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Basic Information</h2>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Assessment Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); updateError('title'); }}
                placeholder="Example: Quiz 01 - Introduction to Database Systems"
                className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-2xl p-3.5 outline-none focus:border-blue-600 focus:bg-white transition"
              />
              {errors.title && <p className="text-[11px] font-bold text-red-500 mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Assessment Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the assessment or assignment content..."
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-2xl p-3.5 outline-none focus:border-blue-600 focus:bg-white transition resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">Assessment Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('QUIZ')}
                  className={`p-4 rounded-2xl border text-left transition-all ${type === 'QUIZ' ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 bg-gray-50'}`}
                >
                  <p className="text-xs font-black text-gray-900">⚡ Quiz</p>
                  <p className="text-[11px] text-gray-500 mt-1">Automatically graded from the configured questions.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setType('ASSIGNMENT')}
                  className={`p-4 rounded-2xl border text-left transition-all ${type === 'ASSIGNMENT' ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 bg-gray-50'}`}
                >
                  <p className="text-xs font-black text-gray-900">📋 Assignment</p>
                  <p className="text-[11px] text-gray-500 mt-1">Learners submit written responses or attached files.</p>
                </button>
              </div>
            </div>

            {/* INSTRUCTION FILE */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Instruction File (PDF, DOCX)</label>
              <input
                type="file"
                onChange={(e) => {
                  setInstructionFile(e.target.files?.[0] || null);
                  setErrors((prev) => ({ ...prev, content: null }));
                }}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />

              {!instructionFile && existingInstructionFileUrl && (
                <div className="mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 truncate">📎 An instruction file is already stored</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadExistingFile}
                      disabled={downloadingExisting}
                      className="text-xs font-bold text-emerald-600 hover:underline disabled:opacity-50"
                    >
                      {downloadingExisting ? 'Downloading...' : '📥 Download'}
                    </button>
                    <span className="text-gray-300">•</span>
                    <button
                      type="button"
                      onClick={handleOpenExistingFile}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      👁️ View
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QUESTIONS LIST */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Question List</h2>
                <p className="text-xs text-gray-400 mt-0.5">Total: {questions.length} questions</p>
              </div>
              <button
                type="button"
                onClick={openAddQuestion}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl transition"
              >
                + Add Question
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                <p className="text-xs font-bold text-gray-400">No questions have been added yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 space-y-3">
                {questions.map((q, idx) => (
                  <div key={q.questionId || idx} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-gray-800 line-clamp-2">{q.content}</p>
                        <span className="text-[10px] font-semibold text-gray-400 mt-1 block">
                          {q.type} • {q.points} points
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditQuestion(q)}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q)}
                        className="text-xs font-bold text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SETTINGS SIDEBAR */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider">Points & Distribution</h2>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={handleAutoDistribute}
                  className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition"
                >
                  Distribute Evenly
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Assessment Total Points</label>
              <input
                type="number"
                min="1"
                value={totalPoints}
                onChange={(e) => { setTotalPoints(e.target.value); updateError('totalPoints'); updateError('questionPoints'); }}
                className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-2xl p-3 outline-none"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
              <span>Question points:</span>
              <span className={`font-bold ${questions.length > 0 && Math.abs(questionPointsTotal - Number(totalPoints || 0)) > 0.001 ? 'text-red-600' : 'text-emerald-600'}`}>
                {questionPointsTotal} / {totalPoints}
              </span>
            </div>
            {questions.length > 0 && Math.abs(questionPointsTotal - Number(totalPoints || 0)) > 0.001 && (
              <p className="text-[10px] font-bold text-red-500">
                The sum of question points must equal the assessment total points before the assessment can be published.
              </p>
            )}
            {errors.questionPoints && (
              <p className="text-[10px] font-bold text-red-500">{errors.questionPoints}</p>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider">Schedule</h2>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); updateError('startTime'); }}
                className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-2xl p-3 outline-none"
              />
              {errors.startTime && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.startTime}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Deadline</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => { setDeadline(e.target.value); updateError('deadline'); }}
                className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-2xl p-3 outline-none"
              />
              {errors.deadline && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.deadline}</p>}
            </div>

            <label className="flex items-center gap-3 pt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowLateSubmission}
                onChange={(e) => setAllowLateSubmission(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded"
              />
              <span className="text-xs font-bold text-gray-700">Allow Late Submission</span>
            </label>
          </div>
        </div>
      </div>

      {/* QUESTION MODAL */}
      {questionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-gray-900">
              {editingQuestionId !== null ? 'Edit Question' : 'Add New Question'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Question Content</label>
              <textarea
                rows={3}
                value={questionForm.content}
                onChange={(e) => updateQuestionField('content', e.target.value)}
                placeholder="Enter the question content..."
                className="w-full text-xs border border-gray-200 rounded-2xl p-3 outline-none focus:border-blue-600"
              />
              {questionErrors.content && <p className="text-[10px] font-bold text-red-500 mt-1">{questionErrors.content}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Question Type</label>
                <select
                  value={questionForm.type}
                  onChange={(e) => changeQuestionType(e.target.value)}
                  className="w-full text-xs font-bold border border-gray-200 rounded-2xl p-3 outline-none"
                >
                  <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                  <option value="ESSAY">Essay</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Question Points</label>
                <input
                  type="number"
                  min="1"
                  value={questionForm.points}
                  onChange={(e) => updateQuestionField('points', e.target.value)}
                  className="w-full text-xs font-bold border border-gray-200 rounded-2xl p-3 outline-none"
                />
              </div>
            </div>

            {questionForm.type === 'MULTIPLE_CHOICE' && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">Answer Options:</span>
                  <button type="button" onClick={addOption} className="text-xs font-bold text-blue-600 hover:underline">+ Add Option</button>
                </div>
                {questionForm.options.map((opt, oIdx) => (
                  <div key={opt.optionId || oIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-opt"
                      checked={opt.isCorrect}
                      onChange={() => updateOption(opt.optionId, 'isCorrect', true)}
                      className="accent-blue-600"
                    />
                    <input
                      type="text"
                      value={opt.content}
                      onChange={(e) => updateOption(opt.optionId, 'content', e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                      className="flex-1 text-xs border border-gray-200 rounded-xl p-2.5 outline-none"
                    />
                    {questionForm.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(opt.optionId)} className="text-xs font-bold text-red-500">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button type="button" onClick={closeQuestionModal} className="px-4 py-2 text-xs font-bold bg-gray-100 rounded-xl">Cancel</button>
              <button type="button" onClick={saveQuestion} className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md">Save Question</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}