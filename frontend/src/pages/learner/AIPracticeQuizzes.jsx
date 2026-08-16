// frontend/src/pages/learner/AIPracticeQuizzes.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getWorkspaceData } from '../../services/workspaceService';
import { getSavedQuizzes, deleteSavedQuiz } from '../../services/aiService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

export default function AIPracticeQuizzes() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [quizzes, setQuizzes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const ws = await getWorkspaceData();
      const projs = ws?.AI_Project || ws?.AI_Projects || [];

      let allQuizzes = [];
      for (const p of projs) {
        const projId = p.projectId || p.id;
        const res = await getSavedQuizzes(projId).catch(() => ({ data: [] }));
        if (res?.data && Array.isArray(res.data)) {
          res.data.forEach((quiz, idx) => {
            allQuizzes.push({
              id: quiz.quizId || quiz.id,
              projectId: projId,
              projectName: p.name || 'Personal Project',
              name: quiz.title || quiz.name || `Quiz: ${p.name} (Review Quiz ${idx + 1})`,
              difficulty: quiz.difficultyLevel || quiz.difficulty || 'Medium',
              questionCount: quiz.questionCount || quiz.Practice_Question?.length || quiz.questions?.length || 0,
              archived: p.type === 'CLASS' && (p.status === 'ARCHIVED' || p.courseStatus === 'ARCHIVED')
            });
          });
        }
      }
      setQuizzes(allQuizzes);
    } catch (error) {
      console.error('[AIPracticeQuizzes Error]:', error);
      showToast('Unable to load AI Quiz list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleDeleteQuiz = async (e, projectId, quizId, quizName) => {
    e.stopPropagation();

    const isConfirmed = await confirm({
      title: 'Delete Quiz',
      message: `Are you sure you want to permanently delete the quiz "${quizName}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await deleteSavedQuiz(projectId, quizId);
      showToast('Quiz deleted successfully!', 'success');
      setQuizzes(prev => prev.filter(q => q.id !== quizId));
    } catch (error) {
      showToast('Error deleting Quiz: ' + error.message, 'error');
    }
  };

  const filteredQuizzes = quizzes.filter(q => 
    q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.difficulty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading AI Quiz list...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8 bg-gray-50/50">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">AI Practice Quizzes</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Library of AI-generated practice quizzes based on your study materials context
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search quizzes, projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-gray-200 rounded-2xl pl-9 pr-4 py-2.5 text-xs font-semibold outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 transition-all shadow-xs w-64"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
          </div>

          <Link
            to="/learner/ai-workspace"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-md shadow-blue-600/15 hover:shadow-lg transition-all flex items-center gap-2"
          >
            <span>📝</span> Create more in Workspace
          </Link>
        </div>
      </div>

      {/* QUIZZES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredQuizzes.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-100 p-8 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-3 font-bold">
              📝
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1">No quizzes available</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mb-6 leading-relaxed">
              {searchTerm
                ? `No quizzes found matching "${searchTerm}".`
                : 'Open AI Workspace, select materials as context, and click "Create AI Quiz" to let the system generate questions.'}
            </p>
            <Link
              to="/learner/ai-workspace"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md transition-all inline-flex items-center gap-2"
            >
              <span>✨</span> Go to AI Workspace
            </Link>
          </div>
        ) : (
          filteredQuizzes.map(quiz => {
            const diffLower = quiz.difficulty.toLowerCase();
            return (
              <div 
                key={quiz.id} 
                className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group relative"
              >
                {/* Banner */}
                <div className="p-6 bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 text-white flex flex-col justify-between h-36 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full uppercase tracking-wider truncate max-w-[150px]">
                      {quiz.projectName}
                    </span>
                    {quiz.archived ? (
                      <span className="rounded-full bg-amber-300/90 px-2 py-1 text-[9px] font-black uppercase text-amber-950">Archived</span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteQuiz(e, quiz.projectId, quiz.id, quiz.name)}
                        className="text-white/60 hover:text-white hover:bg-white/20 p-1.5 rounded-xl text-xs transition-colors"
                        title="Delete Quiz"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${diffLower === 'hard' ? 'bg-red-500/80 text-white' : diffLower === 'easy' ? 'bg-emerald-400/80 text-white' : 'bg-amber-400/80 text-white'}`}>
                        {quiz.difficulty}
                      </span>
                      <span className="text-[11px] text-blue-100 font-bold">{quiz.questionCount} questions</span>
                    </div>
                    <h3 className="text-base font-black text-white line-clamp-1 group-hover:text-blue-100 transition-colors" title={quiz.name}>
                      {quiz.name}
                    </h3>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col justify-between flex-1 gap-4">
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                    Reinforce your knowledge with automatically graded practice quizzes.
                  </p>
                  
                  <button 
                    type="button"
                    onClick={() => navigate(`/learner/ai-quizzes/study?projectId=${quiz.projectId}&quizId=${quiz.id}&name=${encodeURIComponent(quiz.name)}`)}
                    className="w-full py-3 rounded-2xl text-xs font-bold text-center bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white transition-all shadow-xs block"
                  >
                    Start Quiz →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}