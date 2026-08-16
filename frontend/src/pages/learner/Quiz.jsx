// frontend/src/pages/learner/Quiz.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getOpenAssessment,
  startSubmission,
  saveAnswer,
  submitSubmissionAPI
} from '../../services/quizService';

export default function Quiz() {
  const [searchParams] = useSearchParams();
  const assessmentId = searchParams.get('id');
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [submission, setSubmission] = useState(null);

  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [isCompleted, setIsCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const initializeQuiz = async () => {
      if (!assessmentId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg(null);

        const { assessment: asmt, questions: qs } = await getOpenAssessment(assessmentId);
        setAssessment(asmt);
        setQuestions(qs || []);

        try {
          const subRes = await startSubmission(assessmentId);
          setSubmission(subRes.submission);
        } catch (submissionError) {
          if (submissionError.code === 'ASSESSMENT_ALREADY_SUBMITTED') {
            navigate(
              `/learner/courses/${asmt.courseId}/assessments/${assessmentId}/review`,
              { replace: true }
            );
            return;
          }
          throw submissionError;
        }
      } catch (err) {
        console.error('[Quiz Init Error]:', err);
        setErrorMsg(
          err.message || 'Unable to load assessment. It may not be open or you do not have access.'
        );
      } finally {
        setLoading(false);
      }
    };

    initializeQuiz();
  }, [assessmentId, navigate]);

  const handleSelectOption = async (questionId, optionContent) => {
    if (!submission || isCompleted || savingAnswer) return;

    setUserAnswers((prev) => ({ ...prev, [questionId]: optionContent }));

    try {
      setSavingAnswer(true);
      await saveAnswer(submission.submissionId, questionId, optionContent);
    } catch (err) {
      showToast('Error saving answer. Please select again!', 'error');
      setUserAnswers((prev) => {
        const newState = { ...prev };
        delete newState[questionId];
        return newState;
      });
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleFinishQuiz = async () => {
    if (!submission) return;
    try {
      setSubmitting(true);
      const res = await submitSubmissionAPI(submission.submissionId);
      setFinalScore(res.submission.score);
      setIsCompleted(true);
      showToast('Exam submitted successfully!', 'success');
    } catch (err) {
      showToast('Error submitting: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Preparing exam...</p>
        </div>
      </main>
    );
  }

  if (errorMsg || !assessment || questions.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-gray-50/50">
        <div className="text-center p-8 bg-white rounded-3xl shadow-sm border border-gray-100 max-w-md w-full space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-2xl mx-auto font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-black text-gray-800">Assessment Unavailable</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            {errorMsg || 'Assessment does not exist or has no questions yet.'}
          </p>
          <Link
            to="/learner/assessments"
            className="px-6 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 inline-block shadow-md transition"
          >
            Back to List
          </Link>
        </div>
      </main>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(userAnswers).length;
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-6 bg-gray-50/50 flex flex-col items-center justify-center">
      {!isCompleted ? (
        <div className="w-full max-w-4xl space-y-6">
          {/* HEADER BAR */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                  Official Quiz
                </span>
                <h2 className="text-lg font-black text-gray-900 mt-1">{assessment.title}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400">Question</p>
                <p className="text-sm font-black text-blue-600">
                  {currentIndex + 1} / {totalQuestions}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6 items-start">
            {/* MAIN QUESTION AREA */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
              <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-6 relative">
                {savingAnswer && (
                  <span className="absolute top-4 right-6 text-[10px] font-bold text-blue-500 animate-pulse">
                    Saving answer...
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black">
                    {currentIndex + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-400">
                    {currentQuestion.points ?? 1} points
                  </span>
                </div>

                <h3 className="text-base font-black text-gray-900 leading-relaxed">
                  {currentQuestion.content || currentQuestion.questionText}
                </h3>

                <div className="space-y-3">
                  {currentQuestion.options?.map((option, idx) => {
                    const optionContent =
                      option && typeof option === 'object'
                        ? String(option.content ?? '')
                        : String(option ?? '');

                    const optionId =
                      option && typeof option === 'object'
                        ? option.optionId || `${currentQuestion.questionId}-opt-${idx}`
                        : `${currentQuestion.questionId}-opt-${idx}`;

                    const isSelected =
                      userAnswers[currentQuestion.questionId] === optionContent;

                    return (
                      <label
                        key={optionId}
                        onClick={() => handleSelectOption(currentQuestion.questionId, optionContent)}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                            : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`quiz_${currentQuestion.questionId}`}
                          checked={isSelected}
                          onChange={() => {}}
                          className="hidden"
                        />
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 bg-white rounded-full"></span>}
                        </span>
                        <span className="text-xs font-bold text-gray-800 leading-relaxed">
                          {optionContent}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* NAVIGATION FOOTER */}
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => prev - 1)}
                  className="px-5 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-40"
                >
                  ← Previous Question
                </button>

                <button
                  type="button"
                  disabled={savingAnswer || submitting}
                  onClick={async () => {
                    if (currentIndex < totalQuestions - 1) {
                      setCurrentIndex((prev) => prev + 1);
                    } else {
                      const unanswered = totalQuestions - answeredCount;
                      const msg =
                        unanswered > 0
                          ? `You still have ${unanswered} unanswered questions. Are you sure you want to submit?`
                          : 'Are you sure you want to submit the exam?';

                      const confirmed = await confirm({
                        title: 'Submit Assessment',
                        message: msg,
                        confirmLabel: 'Submit Now',
                        cancelLabel: 'Continue Working',
                        tone: 'success'
                      });

                      if (confirmed) await handleFinishQuiz();
                    }
                  }}
                  className={`px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition disabled:opacity-50 ${
                    currentIndex === totalQuestions - 1
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {submitting
                    ? 'Submitting...'
                    : currentIndex === totalQuestions - 1
                    ? 'Submit Exam'
                    : 'Next Question →'}
                </button>
              </div>
            </div>

            {/* SIDEBAR QUESTION STEPPER */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-5">
              <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                Question Palette ({answeredCount}/{totalQuestions})
              </h4>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = userAnswers[q.questionId] !== undefined;
                  const isCurrent = currentIndex === idx;

                  return (
                    <button
                      key={q.questionId || idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-10 rounded-xl text-xs font-black transition-all ${
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-md'
                          : isAnswered
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-blue-600"></span>
                  <span className="text-gray-500">Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-blue-50 border border-blue-200"></span>
                  <span className="text-gray-500">Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-gray-100"></span>
                  <span className="text-gray-500">Unanswered</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden text-center animate-fadeIn">
          <div className="bg-blue-600 p-8 text-white">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto text-3xl font-black mb-3">
              🎉
            </div>
            <h2 className="text-2xl font-black">Exam Completed!</h2>
            <p className="text-xs text-blue-100 mt-1">Submission results have been securely saved.</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="w-32 h-32 rounded-full border-8 border-blue-50 bg-blue-50/50 flex flex-col items-center justify-center mx-auto shadow-inner">
              <span className="text-3xl font-black text-blue-600">
                {finalScore !== null ? finalScore : '?'}
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Score</span>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to={`/learner/courses/${assessment.courseId}/assessments/${assessment.assessmentId}/review`}
                className="px-6 py-3 text-xs font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 shadow-md transition"
              >
                Review Submission →
              </Link>
              <Link
                to="/learner/assessments"
                className="px-6 py-3 text-xs font-bold text-gray-700 bg-gray-100 rounded-2xl hover:bg-gray-200 transition"
              >
                Back to List
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}