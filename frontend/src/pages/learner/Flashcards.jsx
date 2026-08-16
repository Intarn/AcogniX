// frontend/src/pages/learner/Flashcards.jsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
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

  useEffect(() => {
    if (!projectId || !setId) {
      navigate('/learner/flashcards');
      return;
    }

    const loadCards = async () => {
      try {
        setLoading(true);
        const res = await getSavedFlashcards(projectId);
        const currentSet = res?.data?.find(
          (set) => String(set.flashcardSetId || set.id) === String(setId)
        );

        if (currentSet) {
          const rawCards = currentSet.Flashcard || currentSet.cards || [];
          setCards(rawCards);
          setCurrentIndex(0);
          setShowAnswer(false);
        } else {
          setCards([]);
        }
      } catch (err) {
        console.error('[Flashcard Study Load Error]:', err);
        setCards([]);
      } finally {
        setLoading(false);
      }
    };

    loadCards();
  }, [projectId, setId, navigate]);

  const handlePrevious = () => {
    if (currentIndex <= 0) return;
    setCurrentIndex((prev) => prev - 1);
    setShowAnswer(false);
  };

  const handleNext = () => {
    if (currentIndex >= cards.length - 1) return;
    setCurrentIndex((prev) => prev + 1);
    setShowAnswer(false);
  };

  const activeCard = cards[currentIndex] || {};
  const displayFront =
    activeCard.frontContent ||
    activeCard.front ||
    activeCard.Front ||
    activeCard.term ||
    activeCard.question ||
    'Empty question card';

  const displayBack =
    activeCard.backContent ||
    activeCard.back ||
    activeCard.Back ||
    activeCard.definition ||
    activeCard.answer ||
    'Back side content not found';

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Preparing review deck...</p>
        </div>
      </main>
    );
  }

  const progressPercent = cards.length > 0
    ? Math.round(((currentIndex + 1) / cards.length) * 100)
    : 0;

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-6 bg-gray-50/50 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/learner/flashcards"
            className="px-4 py-2 bg-white rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-xs"
          >
            ← Exit Study Room
          </Link>

          <div className="text-center">
            <h2 className="text-sm font-black text-gray-900 truncate max-w-xs">{deckName}</h2>
            <p className="text-[11px] text-gray-400 font-bold">
              {cards.length > 0 ? `Card ${currentIndex + 1} / ${cards.length}` : 'No cards'}
            </p>
          </div>

          <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            {progressPercent}%
          </span>
        </div>

        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        {cards.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-16 text-center shadow-xs">
            <p className="text-xs font-bold text-gray-400">This deck is currently empty.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div
              onClick={() => setShowAnswer((prev) => !prev)}
              className="w-full min-h-[340px] bg-white rounded-3xl border border-gray-100 shadow-md hover:shadow-lg transition-all p-8 flex flex-col justify-between cursor-pointer relative overflow-hidden group select-none"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider ${
                    showAnswer
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {showAnswer ? '💡 Back Side / Definition' : '❓ Front Side / Term'}
                </span>
                <span className="text-[11px] font-bold text-gray-400 group-hover:text-gray-600 transition-colors">
                  Click to flip card ↻
                </span>
              </div>

              <div className="my-auto py-6 text-center">
                <h3
                  className={`leading-relaxed whitespace-pre-wrap ${
                    showAnswer
                      ? 'text-gray-800 text-sm md:text-base font-semibold'
                      : 'text-gray-900 text-xl md:text-2xl font-black'
                  }`}
                >
                  {showAnswer ? displayBack : displayFront}
                </h3>
              </div>

              <div className="text-center pt-4 border-t border-gray-50">
                {!showAnswer ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowAnswer(true);
                    }}
                    className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-6 py-2.5 rounded-full transition-colors inline-block"
                  >
                    Show Answer
                  </button>
                ) : (
                  <p className="text-[11px] text-gray-400 font-semibold italic">
                    Use Previous or Next to continue through the deck.
                  </p>
                )}
              </div>
            </div>

            {showAnswer && (
              <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-black text-xs rounded-2xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentIndex === cards.length - 1}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 font-black text-xs rounded-2xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}

            {showAnswer && currentIndex === cards.length - 1 && (
              <div className="text-center bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                <p className="text-xs font-bold text-emerald-700">
                  You are viewing the last card in this deck.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
