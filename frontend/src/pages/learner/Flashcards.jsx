import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getSavedFlashcards } from '../../services/aiService';

export default function Flashcards() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const setId = searchParams.get('setId');
  const deckName = searchParams.get('name') || 'Flashcard Set';
  
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  // Nếu truy cập sai URL (thiếu ID), đá về trang tổng
  useEffect(() => {
    if (!projectId || !setId) navigate('/learner/flashcards');
  }, [projectId, setId, navigate]);

  const loadCards = async () => {
    if (!projectId || !setId) return;
    try {
      setLoading(true);
      const res = await getSavedFlashcards(projectId);
      // Tìm đúng bộ Flashcard Set mà người dùng vừa click vào
      const currentSet = res.data?.find(s => String(s.flashcardSetId || s.id) === String(setId));
      
      if (currentSet) {
        setCards(currentSet.Flashcard || currentSet.cards || []);
        setCurrentIndex(0);
        setShowAnswer(false);
      }
    } catch (err) {
      console.error("Lỗi tải Flashcards:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, [projectId, setId]);

  // Xử lý khi người dùng chọn mức độ
  const handleReview = () => {
    setShowAnswer(false);
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      alert("Tuyệt vời! Bạn đã học xong bộ thẻ này.");
      navigate('/learner/flashcards');
    }
  };

  // Tránh lỗi khi thẻ chưa load kịp
  const activeCard = cards[currentIndex] || {};

  // Tự động rà quét mọi tên cột, BỔ SUNG frontContent và backContent
  const frontContent = activeCard.frontContent || activeCard.front || activeCard.Front || activeCard.term || activeCard.question;
  const backContent = activeCard.backContent || activeCard.back || activeCard.Back || activeCard.definition || activeCard.answer;

  // Nếu vẫn không trúng tên cột nào, in thẳng chuỗi JSON ra màn hình để biết Backend trả về gì
  const displayFront = frontContent || (Object.keys(activeCard).length > 0 ? JSON.stringify(activeCard) : "Thẻ rỗng");
  const displayBack = backContent || "Không tìm thấy dữ liệu mặt sau";

  return (
    <main className="flex-1 p-8 bg-gray-50 flex flex-col items-center overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <div>
          <button 
            onClick={() => navigate('/learner/flashcards')} 
            className="text-xs font-bold text-gray-400 hover:text-emerald-600 mb-1 inline-block transition-colors"
          >
            ← Quay lại Repository
          </button>
          <h1 className="text-xl font-bold text-gray-800">{deckName}</h1>
        </div>
      </div>

      {/* Vùng Lật Thẻ (Study Area) */}
      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center w-full max-w-2xl shadow-sm">
          <p className="text-sm text-gray-500">Đang tải dữ liệu thẻ...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center w-full max-w-2xl shadow-sm">
          <p className="text-sm text-gray-500">Bộ thẻ này hiện đang trống hoặc không tồn tại.</p>
        </div>
      ) : (
        <div className="w-full max-w-2xl mt-4">
          <div className="flex justify-between text-xs font-bold text-gray-400 mb-3">
            <span>Tiến trình học</span>
            <span>{currentIndex + 1} / {cards.length}</span>
          </div>
          
          <div className="w-full bg-gray-200 h-1.5 rounded-full mb-8 overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${((currentIndex) / cards.length) * 100}%` }}></div>
          </div>

          <div className="relative aspect-[16/9] w-full perspective-1000">
            {/* Mặt trước */}
            <div className={`absolute inset-0 bg-white rounded-3xl shadow-sm border border-gray-100 p-10 flex flex-col justify-center items-center text-center transition-all duration-300 ${showAnswer ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
              <h3 className="text-2xl font-bold text-gray-800 leading-relaxed overflow-y-auto">
                {displayFront}
              </h3>
              <button 
                onClick={() => setShowAnswer(true)} 
                className="mt-10 text-sm font-bold text-emerald-600 bg-emerald-50 px-8 py-3 rounded-full hover:bg-emerald-100 transition-colors"
              >
                Hiện đáp án
              </button>
            </div>

            {/* Mặt sau */}
            <div className={`absolute inset-0 bg-white rounded-3xl shadow-md border-2 border-emerald-100 p-10 flex flex-col justify-between items-center text-center transition-all duration-300 ${showAnswer ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                <p className="text-xl font-medium text-gray-700 leading-relaxed overflow-y-auto max-h-full w-full">
                  {displayBack}
                </p>
              </div>
              
              <div className="w-full grid grid-cols-4 gap-3 mt-6 shrink-0">
                <button onClick={handleReview} className="bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 text-sm transition-colors">Học lại</button>
                <button onClick={handleReview} className="bg-orange-50 text-orange-600 font-bold py-3 rounded-xl hover:bg-orange-100 text-sm transition-colors">Khó</button>
                <button onClick={handleReview} className="bg-green-50 text-green-600 font-bold py-3 rounded-xl hover:bg-green-100 text-sm transition-colors">Tốt</button>
                <button onClick={handleReview} className="bg-blue-50 text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-100 text-sm transition-colors">Rất Dễ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}