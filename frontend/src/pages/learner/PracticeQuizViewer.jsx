// frontend/src/pages/learner/PracticeQuizViewer.jsx
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getSavedQuizzes, recordPracticeQuizAttempt } from '../../services/aiService';

export default function PracticeQuizViewer() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const quizId = searchParams.get('quizId');
  const quizName = searchParams.get('name') || 'AI Practice Quiz';
  
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const attemptRecordedRef = useRef(false);

  useEffect(() => {
    const loadQuiz = async () => {
      if (!projectId || !quizId) {
        navigate('/learner/ai-quizzes');
        return;
      }
      try {
        setLoading(true);
        const res = await getSavedQuizzes(projectId);
        const currentQuiz = res?.data?.find(q => String(q.quizId || q.id) === String(quizId));
        if (currentQuiz) {
          const rawQuestions = currentQuiz.Practice_Question || currentQuiz.questions || [];
          setQuestions(rawQuestions);
        }
      } catch (err) {
        console.error('[PracticeQuizViewer Error]:', err);
      } finally {
        setLoading(false);
      }
    };
    loadQuiz();
  }, [projectId, quizId, navigate]);

  // UC04: Practice Quiz results must survive refresh and feed Personal Statistics.
  useEffect(() => {
    if (!isFinished || !projectId || !quizId || questions.length === 0 || attemptRecordedRef.current) {
      return;
    }

    attemptRecordedRef.current = true;
    recordPracticeQuizAttempt(projectId, quizId, {
      score,
      totalQuestions: questions.length,
      quizName,
      completedAt: new Date().toISOString()
    }).catch((error) => {
      console.error('[PracticeQuizViewer] Unable to record analytics result:', error);
      attemptRecordedRef.current = false;
    });
  }, [isFinished, projectId, quizId, questions.length, score, quizName]);

  const handleSelect = (option) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
  };

  const handleCheckAnswer = () => {
    if (!selectedAnswer) return;
    setIsAnswered(true);
    const currentQ = questions[currentIndex];
    const correctVal = currentQ.correctAnswer || currentQ.correctOption || currentQ.answer;
    if (selectedAnswer === correctVal) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
    attemptRecordedRef.current = false;
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading quiz questions...</p>
        </div>
      </main>
    );
  }

  if (questions.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50">
        <p className="text-sm font-bold text-gray-700">No questions found in this quiz.</p>
        <Link to="/learner/ai-quizzes" className="mt-4 text-xs font-bold text-blue-600 hover:underline">
          ← Back to quiz list
        </Link>
      </main>
    );
  }

  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-gray-50/50">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center w-full max-w-md space-y-6 animate-fadeIn">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-3xl font-black shadow-xs">
            🏆
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900">Practice Session Completed!</h2>
            <p className="text-xs text-gray-500 mt-1">Your self-assessment results for "{quizName}".</p>
          </div>

          <div className="p-6 bg-blue-50/60 border border-blue-100 rounded-2xl space-y-1">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">Score Achieved</span>
            <div className="text-4xl font-black text-blue-700">{score} / {questions.length}</div>
            <p className="text-xs font-bold text-blue-600">Accuracy: {percentage}%</p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleRestart}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-2xl transition"
            >
              🔄 Retake This Quiz
            </button>
            <Link
              to="/learner/ai-quizzes"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md transition"
            >
              Back to List →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const currentQ = questions[currentIndex];
  const options = Array.isArray(currentQ.options) ? currentQ.options : [];
  const correctVal = currentQ.correctAnswer || currentQ.correctOption || currentQ.answer;

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-6 bg-gray-50/50 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        
        {/* HEADER BAR */}
        <div className="flex items-center justify-between">
          <Link
            to="/learner/ai-quizzes"
            className="px-4 py-2 bg-white rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-xs"
          >
            ← Exit Quiz
          </Link>
          <div className="text-center">
            <h2 className="text-sm font-black text-gray-900 truncate max-w-xs">{quizName}</h2>
            <p className="text-[11px] text-gray-400 font-bold">Question {currentIndex + 1} / {questions.length}</p>
          </div>
          <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            Correct: {score}
          </span>
        </div>

        {/* QUESTION CARD */}
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Question {currentIndex + 1}
            </span>
            {isAnswered && (
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${selectedAnswer === correctVal ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {selectedAnswer === correctVal ? '✓ Correct' : '✕ Incorrect'}
              </span>
            )}
          </div>

          <h3 className="text-base font-black text-gray-900 leading-relaxed">
            {currentQ.content || currentQ.question || 'Question content...'}
          </h3>

          {/* OPTIONS LIST */}
          <div className="space-y-3">
            {options.map((opt, idx) => {
              const isSelected = selectedAnswer === opt;
              const isCorrect = isAnswered && opt === correctVal;
              const isWrong = isAnswered && isSelected && opt !== correctVal;

              let style = 'bg-gray-50/70 border-gray-200 text-gray-800 hover:bg-gray-100 hover:border-gray-300';
              if (isSelected && !isAnswered) {
                style = 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-xs';
              }
              if (isCorrect) {
                style = 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold';
              }
              if (isWrong) {
                style = 'bg-red-50 border-red-400 text-red-700 font-bold';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full text-left p-4 rounded-2xl border text-xs transition-all flex items-center justify-between ${style}`}
                >
                  <span>{opt}</span>
                  {isCorrect && <span className="text-emerald-600 font-bold">✓ Correct Answer</span>}
                </button>
              );
            })}
          </div>

          {/* ACTION BUTTON */}
          <div className="pt-4 border-t border-gray-50 flex justify-end">
            {!isAnswered ? (
              <button 
                type="button"
                onClick={handleCheckAnswer}
                disabled={!selectedAnswer}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
              >
                Check Answer
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                {currentIndex + 1 === questions.length ? 'View Summary Results →' : 'Next Question →'}
              </button>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}