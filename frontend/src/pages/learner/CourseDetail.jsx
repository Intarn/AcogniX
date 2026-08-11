// frontend/src/pages/learner/CourseDetail.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../services/apiClient';

export default function CourseDetail() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('id');

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Tabs state trong trang chi tiết
  const [activeTab, setActiveTab] = useState('Transcript');
  // Trạng thái mở/đóng floating notes panel
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [quickNote, setQuickNote] = useState('');

  useEffect(() => {
    if (!courseId) return;

    const fetchCourseDetails = async () => {
      try {
        setLoading(true);
        // 1. Lấy thông tin chi tiết khóa học từ Backend (/api/courses/:id)
        const courseData = await apiRequest(`/courses/${courseId}`, { method: 'GET' });
        setCourse(courseData);

        // 2. Lấy danh sách bài học của khóa học từ Backend (hoặc fallback dữ liệu chuẩn)
        let lessonsData = [];
        try {
          lessonsData = await apiRequest(`/courses/${courseId}/lessons`, { method: 'GET' });
        } catch (e) {
          console.warn("API lessons chưa có trên backend, sử dụng dữ liệu mặc định");
        }

        if (!Array.isArray(lessonsData) || lessonsData.length === 0) {
          lessonsData = [
            {
              id: 1,
              courseId: courseId,
              title: `Introduction to ${courseData.name || courseData.title || 'Course'}`,
              duration: '10:15',
              thumbnail: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&auto=format&fit=crop',
              content: `<p>Welcome to this foundational lesson. In this module, we will cover core objectives and setting up your environment.</p>`
            },
            {
              id: 2,
              courseId: courseId,
              title: 'Core Principles & Fundamentals',
              duration: '15:30',
              thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop',
              content: `<p>In this second lesson, we dive deep into core theories and mechanics essential for solving complex problems.</p>`
            }
          ];
        }

        setLessons(lessonsData);
      } catch (err) {
        console.error("Lỗi khi tải chi tiết khóa học từ backend:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseDetails();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <p className="text-sm text-gray-500">Đang tải chi tiết khóa học từ Backend...</p>
      </div>
    );
  }

  if (!courseId || !course) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <h1 className="text-xl font-bold text-red-500">Error: Course not found or ID is missing.</h1>
      </div>
    );
  }

  const currentLesson = lessons[activeIndex] || null;

  return (
    <main className="flex-1 flex overflow-hidden bg-white relative">

      {/* LEFT: LESSONS LIST */}
      <div className="w-80 h-full bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{course.name || course.title}</h2>
          <p className="text-xs text-gray-500 mt-1">By {course.teacher || course.instructor || 'Instructor'}</p>
          <div className="flex justify-between items-center mt-3">
            <span className="text-[10px] text-gray-500">Progress</span>
            <span className="text-[10px] font-semibold text-emerald-600">75%</span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-emerald-500 h-full w-[75%]"></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {lessons.length === 0 ? (
            <p className="text-center text-gray-500 py-4 text-xs">No lessons available for this course.</p>
          ) : (
            lessons.map((lesson, index) => {
              const isActive = index === activeIndex;
              const isCompleted = index < activeIndex;

              return (
                <div 
                  key={lesson.id || index}
                  onClick={() => setActiveIndex(index)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    isActive ? 'bg-blue-50 border border-blue-200 text-blue-700' :
                    isCompleted ? 'bg-gray-50/80 text-gray-400' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold">{index + 1}.</span>
                    <span className="text-xs font-bold truncate max-w-[150px]">{lesson.title}</span>
                  </div>
                  <span className="text-[10px]">{lesson.duration || '10:00'}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: LESSON VIEWER */}
      <div className="flex-1 h-full p-6 overflow-y-auto">
        
        {/* Video Player */}
        <div className="aspect-video bg-gray-900 rounded-xl mb-4 relative flex items-center justify-center overflow-hidden">
          <img 
            src={currentLesson?.thumbnail || "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&auto=format&fit=crop"} 
            alt="Thumbnail" 
            className="absolute inset-0 w-full h-full object-cover opacity-30 rounded-xl" 
          />
          <button className="relative w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors">
            <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* Lesson Title & Navigation */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-gray-800">
            {currentLesson ? `Lesson ${activeIndex + 1}: ${currentLesson.title}` : 'Select a lesson'}
          </h1>
          <div className="flex items-center gap-2">
            <button 
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex(prev => prev - 1)}
              className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button 
              disabled={activeIndex === lessons.length - 1}
              onClick={() => setActiveIndex(prev => prev + 1)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Lesson
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            {['Transcript', 'My Notes', 'Resources'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
                  activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="py-5 text-sm text-gray-600 leading-relaxed space-y-4">
          {activeTab === 'Transcript' && (
            <div dangerouslySetInnerHTML={{ __html: currentLesson?.content || '<p>No transcript available.</p>' }} />
          )}
          {activeTab === 'My Notes' && (
            <p className="text-gray-500 italic">Your personal notes for this lesson will appear here. You can also use the quick notes bubble on the bottom right.</p>
          )}
          {activeTab === 'Resources' && (
            <ul className="list-disc pl-5 space-y-2 text-blue-600 text-xs font-semibold">
              <li><a href="#" className="hover:underline">Download Lecture Slides (PDF)</a></li>
              <li><a href="#" className="hover:underline">Supplementary Code Repository (GitHub)</a></li>
            </ul>
          )}
        </div>

      </div>

      {/* Floating Notes Bubble */}
      <button 
        onClick={() => setIsNotesOpen(!isNotesOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-transform hover:scale-110 z-50"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      </button>

      {/* Floating Notes Panel */}
      {isNotesOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-2xl flex-shrink-0">
            <h3 className="text-sm font-bold text-gray-800">Quick Notes</h3>
            <button onClick={() => setIsNotesOpen(false)} className="text-gray-400 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <textarea 
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            className="w-full h-full p-3 text-sm outline-none resize-none rounded-b-2xl" 
            placeholder="Take notes for this lesson..." 
          />
        </div>
      )}

    </main>
  );
}