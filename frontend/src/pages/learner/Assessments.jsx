// frontend/src/pages/learner/Assessments.jsx
import { useState, useEffect } from 'react';
import { getAssessments, submitAssessment } from '../../services/assessmentService';

export default function Assessments() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Trạng thái khi đang làm bài kiểm tra
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // Chỉ gọi API thật từ Backend, không dùng fallback dữ liệu giả
  useEffect(() => {
    const fetchList = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await getAssessments();
        setAssessments(Array.isArray(data) ? data : data.assessments || []);
      } catch (err) {
        console.error("Lỗi kết nối API assessments từ backend:", err);
        setErrorMsg("Không thể tải dữ liệu từ Backend (/api/assessments). Server phản hồi 404 hoặc chưa hỗ trợ route này.");
        setAssessments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, []);

  const handleSelectOption = (questionId, optionIndex) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    
    try {
      setSubmitting(true);
      const result = await submitAssessment(activeQuiz.id, userAnswers);
      setQuizResult(result);
    } catch (err) {
      console.error("Lỗi nộp bài lên backend:", err);
      alert("Lỗi khi nộp bài thi lên Backend.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <p className="text-sm text-gray-500">Đang đồng bộ dữ liệu thật từ Backend...</p>
      </div>
    );
  }

  if (quizResult) {
    return (
      <main className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-lg border border-gray-100 text-center space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Quiz Result (Backend)</h2>
          <div className="bg-gray-50 rounded-xl p-4 text-xs text-left font-mono overflow-x-auto">
            <pre>{JSON.stringify(quizResult, null, 2)}</pre>
          </div>
          <button 
            onClick={() => { setActiveQuiz(null); setQuizResult(null); setUserAnswers({}); }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl transition shadow-sm"
          >
            Back to List
          </button>
        </div>
      </main>
    );
  }

  if (activeQuiz) {
    const questions = activeQuiz.questions || activeQuiz.items || [];
    const currentQ = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    if (!currentQ) {
      return (
        <main className="flex-1 p-8 bg-gray-50 flex flex-col items-center justify-center">
          <p className="text-sm text-red-500 mb-4">Bài kiểm tra này không chứa câu hỏi nào từ Backend.</p>
          <button onClick={() => setActiveQuiz(null)} className="px-4 py-2 bg-blue-600 text-white text-xs rounded-xl font-semibold">Quay lại</button>
        </main>
      );
    }

    return (
      <main className="flex-1 p-8 bg-gray-50 flex flex-col items-center overflow-y-auto">
        <div className="max-w-2xl w-full bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-6">
            <h2 className="text-base font-bold text-gray-800">{activeQuiz.title || activeQuiz.name}</h2>
            <span className="text-xs text-gray-500">Question {currentQuestionIndex + 1} of {questions.length}</span>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">{currentQ.question || currentQ.text}</h3>
            <div className="space-y-3">
              {(currentQ.options || currentQ.choices || []).map((opt, idx) => {
                const isSelected = userAnswers[currentQ.id || currentQuestionIndex] === idx;
                return (
                  <div 
                    key={idx}
                    onClick={() => handleSelectOption(currentQ.id || currentQuestionIndex, idx)}
                    className={`p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {typeof opt === 'string' ? opt : opt.text}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-auto">
            <button 
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl disabled:opacity-40"
            >
              Previous
            </button>
            <div className="flex gap-2">
              <button 
                onClick={() => { setActiveQuiz(null); setUserAnswers({}); }}
                className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-xl"
              >
                Quit
              </button>
              {isLastQuestion ? (
                <button 
                  disabled={submitting}
                  onClick={handleSubmitQuiz}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              ) : (
                <button 
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto bg-gray-50">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Assessments & Quizzes</h1>
        <p className="text-xs text-gray-400 mt-1">Directly connected to Backend API.</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assessments.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 py-10">No assessments found from backend server.</p>
        ) : (
          assessments.map((quiz, index) => (
            <div key={quiz.id || index} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">{quiz.title || quiz.name}</h3>
                <p className="text-xs text-gray-500">Duration: {quiz.durationMinutes || quiz.duration || 'N/A'} mins</p>
              </div>
              <button 
                onClick={() => { setActiveQuiz(quiz); setCurrentQuestionIndex(0); setUserAnswers({}); }}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm"
              >
                Start Quiz
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}