import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getSavedQuizzes } from '../../services/aiService';

export default function PracticeQuizViewer() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const quizId = searchParams.get('quizId');
  
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const loadQuiz = async () => {
      if (!projectId || !quizId) return navigate('/learner/ai-quizzes');
      try {
        const res = await getSavedQuizzes(projectId);
        const currentQuiz = res.data?.find(q => String(q.quizId || q.id) === String(quizId));
        if (currentQuiz) {
          setQuestions(currentQuiz.Practice_Question || currentQuiz.questions || []);
        }
      } catch (err) {
        console.error("Lỗi lấy Quiz:", err);
      } finally {
        setLoading(false);
      }
    };
    loadQuiz();
  }, [projectId, quizId, navigate]);

  const handleSelect = (option) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
  };

  const handleCheckAnswer = () => {
    if (!selectedAnswer) return;
    setIsAnswered(true);
    const currentQ = questions[currentIndex];
    if (selectedAnswer === currentQ.correctAnswer) {
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

  if (loading) return <div className="flex-1 p-8 text-center text-gray-500">Đang tải câu hỏi...</div>;
  if (questions.length === 0) return <div className="flex-1 p-8 text-center text-red-500">Không tìm thấy câu hỏi nào.</div>;

  if (isFinished) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Hoàn thành!</h2>
          <p className="text-gray-500 mb-6">Kết quả tự luyện tập của bạn</p>
          <div className="text-5xl font-black text-blue-600 mb-8">{score} / {questions.length}</div>
          <button onClick={() => navigate('/learner/ai-quizzes')} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl">Quay lại danh sách</button>
        </div>
      </main>
    );
  }

  const currentQ = questions[currentIndex];
  const options = currentQ.options || []; // Dữ liệu đã được backend parse sẵn từ optionsJson

  return (
    <main className="flex-1 flex flex-col items-center p-8 bg-gray-50 overflow-y-auto">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => navigate('/learner/ai-quizzes')} className="text-xs font-bold text-gray-400 hover:text-blue-600">
            &larr; Thoát
          </button>
          <span className="text-sm font-bold text-gray-500">Câu {currentIndex + 1} / {questions.length}</span>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-6">{currentQ.content || currentQ.question}</h2>
          
          <div className="space-y-3">
            {options.map((opt, idx) => {
              const isSelected = selectedAnswer === opt;
              const isCorrect = isAnswered && opt === currentQ.correctAnswer;
              const isWrong = isAnswered && isSelected && opt !== currentQ.correctAnswer;
              
              let style = "border-gray-200 hover:bg-gray-50 cursor-pointer";
              if (isSelected) style = "border-blue-500 bg-blue-50";
              if (isCorrect) style = "border-green-500 bg-green-50 font-bold text-green-700";
              if (isWrong) style = "border-red-500 bg-red-50 text-red-700 line-through";

              return (
                <div key={idx} onClick={() => handleSelect(opt)} className={`p-4 rounded-xl border-2 transition-all ${style}`}>
                  {opt}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end">
            {!isAnswered ? (
              <button 
                onClick={handleCheckAnswer}
                disabled={!selectedAnswer}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-50"
              >
                Kiểm tra
              </button>
            ) : (
              <button 
                onClick={handleNext}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold rounded-xl"
              >
                {currentIndex + 1 === questions.length ? 'Xem kết quả' : 'Câu tiếp theo'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}