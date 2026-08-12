import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkspaceData } from '../../services/workspaceService';
import { getSavedQuizzes } from '../../services/aiService';

export default function AIPracticeQuizzes() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        const ws = await getWorkspaceData();
        const projs = ws?.AI_Project || ws?.AI_Projects || [];
        
        let allQuizzes = [];
        // Lặp qua các project để gom toàn bộ Quiz (O(P * Q))
        for (const p of projs) {
          const res = await getSavedQuizzes(p.projectId || p.id).catch(() => ({ data: [] }));
          if (res.data) {
            res.data.forEach((quiz, idx) => {
              allQuizzes.push({
                id: quiz.quizId || quiz.id,
                projectId: p.projectId || p.id,
                name: `Quiz: ${p.name} (Phần ${idx + 1})`,
                difficulty: quiz.difficultyLevel || 'Medium',
                questionCount: quiz.questionCount || quiz.Practice_Question?.length || 0
              });
            });
          }
        }
        setQuizzes(allQuizzes);
      } catch (error) {
        console.error("Lỗi tải danh sách AI Quizzes:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  return (
    <main className="flex-1 p-8 bg-gray-50 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Practice Quizzes Repository</h1>
        <p className="text-xs text-gray-500 mt-1">Kho câu hỏi trắc nghiệm tự luyện tạo bởi AI</p>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 text-sm mt-10">Đang tải danh sách Quiz...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quizzes.length === 0 ? (
            <p className="col-span-full text-center text-gray-500 py-10">Chưa có Quiz nào. Hãy tạo từ AI Workspace.</p>
          ) : (
            quizzes.map(quiz => (
              <div key={quiz.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col hover:border-blue-300 transition-colors">
                <h3 className="font-bold text-gray-800 text-base mb-2">{quiz.name}</h3>
                <div className="flex gap-2 mb-4">
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold">{quiz.questionCount} Câu</span>
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold uppercase">{quiz.difficulty}</span>
                </div>
                <button 
                  onClick={() => navigate(`/learner/ai-quizzes/study?projectId=${quiz.projectId}&quizId=${quiz.id}&name=${encodeURIComponent(quiz.name)}`)}
                  className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg"
                >
                  Bắt đầu làm bài
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}