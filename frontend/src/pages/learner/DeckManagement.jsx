// frontend/src/pages/learner/DeckManagement.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkspaceData } from '../../services/workspaceService';
import { getSavedFlashcards, deleteSavedFlashcardSet } from '../../services/aiService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

export default function FlashcardDashboard() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [decks, setDecks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDecks = async () => {
    try {
      setLoading(true);
      const ws = await getWorkspaceData();
      const projs = ws?.AI_Project || ws?.AI_Projects || [];
      
      let allDecks = [];
      // Lặp qua tất cả project để gom Flashcard
      for (const p of projs) {
        const res = await getSavedFlashcards(p.projectId || p.id).catch(() => ({ data: [] }));
        if (res.data) {
          res.data.forEach((set, idx) => {
            allDecks.push({
              id: set.flashcardSetId || set.id,
              projectId: p.projectId || p.id,
              name: `Chủ đề: ${p.name} (Set ${idx + 1})`,
              cardCount: set.Flashcard?.length || 0
            });
          });
        }
      }
      setDecks(allDecks);
    } catch (error) {
      console.error("Lỗi danh sách Deck:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDecks(); }, []);

  // Xử lý xóa deck
  const handleDeleteDeck = async (e, projectId, setId) => {
    // CHẶN BONG BÓNG SỰ KIỆN: không cho thẻ cha bị click (nhảy trang)
    e.stopPropagation(); 
    
    const isConfirmed = await confirm({
      title: 'Xóa Flashcard',
      message: 'Bạn có chắc chắn muốn xóa vĩnh viễn bộ thẻ này không?',
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy',
      tone: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await deleteSavedFlashcardSet(projectId, setId);
      showToast("Đã xóa bộ thẻ thành công", "success");
      // Loại bỏ bộ thẻ vừa bị xóa ra khỏi mảng hiện tại
      setDecks(prev => prev.filter(deck => deck.id !== setId));
    } catch (error) {
      showToast("Lỗi khi xóa bộ thẻ: " + error.message, "error");
    }
  };

  const filteredDecks = decks.filter(deck => deck.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <main className="flex-1 p-8 bg-gray-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Study Repository</h1>
          <p className="text-xs text-gray-500 mt-1">Tổng hợp Flashcards từ các AI Project</p>
        </div>
        <div className="relative w-64">
          <input 
            type="text" 
            placeholder="Tìm kiếm bộ thẻ..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 text-sm mt-10">Đang đồng bộ Repository...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredDecks.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500 text-sm">Chưa có Flashcard nào. Hãy vào AI Workspace để tạo nhé!</p>
            </div>
          ) : (
            filteredDecks.map(deck => (
              <div 
                key={deck.id} 
                onClick={() => navigate(`/learner/flashcards/study?projectId=${deck.projectId}&setId=${deck.id}&name=${encodeURIComponent(deck.name)}`)}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group relative"
              >
                {/* NÚT XÓA BỘ THẺ */}
                <button
                  onClick={(e) => handleDeleteDeck(e, deck.projectId, deck.id)}
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                  title="Xóa bộ thẻ"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                <h3 className="font-bold text-gray-800 text-lg group-hover:text-emerald-600 mb-2 pr-6 line-clamp-2">
                  {deck.name}
                </h3>
                <p className="text-xs text-gray-500 mb-4">{deck.cardCount} Thẻ</p>
                <div className="mt-auto pt-3 border-t border-gray-50 text-right">
                  <span className="text-emerald-600 text-xs font-bold group-hover:underline">Học ngay</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}