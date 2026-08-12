import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkspaceData } from '../../services/workspaceService';
import { getSavedFlashcards } from '../../services/aiService';

export default function FlashcardDashboard() {
  const navigate = useNavigate();
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
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group"
              >
                <h3 className="font-bold text-gray-800 text-lg group-hover:text-emerald-600 mb-2">{deck.name}</h3>
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