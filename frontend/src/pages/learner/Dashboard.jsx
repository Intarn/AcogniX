// frontend/src/pages/learner/Dashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';

import { getProgressOverview } from '../../services/progressService';
import { getWorkspaceData, uploadProjectMaterial } from '../../services/workspaceService';
import { getProjectNotes } from '../../features/notes/noteApi';
import { getAllNotes } from '../../features/notes/noteApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

// ==========================================
// 1. COMPONENT CON: UPLOAD ZONE
// ==========================================
const UploadZone = ({ recentFiles, firstProjectId, onUploadSuccess }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileDropChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!firstProjectId) {
      alert("Chưa tìm thấy AI Project. Vui lòng vào trang 'AI Workspace' trước để hệ thống tạo không gian học tập!");
      return;
    }

    try {
      setUploading(true);
      // Gọi API upload với ID truyền từ Component Mẹ xuống
      await uploadProjectMaterial(firstProjectId, file);
      alert("Tải file lên thành công!");
      
      // Kích hoạt hàm reload của Component Mẹ để cập nhật giao diện
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      alert("Lỗi upload: " + (error.message || "Không thể upload file"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  return (
    <div className="col-span-6 bg-white rounded-2xl border border-gray-100 p-5 flex flex-col justify-between shadow-sm">
      <div>
        <h2 className="text-base font-bold text-gray-800">AI Study Zone: Upload to Start</h2>
        <p className="text-xs text-gray-400 mt-1">Upload your PDF files or lecture slides to get started.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="border-2 border-dashed border-blue-300 bg-blue-50/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white mb-2 shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          </div>
          <p className="text-xs font-bold text-gray-700">Drag & drop your files here</p>
          <p className="text-[10px] text-gray-400 my-1">or</p>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".pdf,.doc,.docx,.ppt,.pptx" 
            onChange={handleFileDropChange} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-sm disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Choose Files'}
          </button>
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">Recent Files</p>
            <div className="space-y-2">
              {recentFiles.length === 0 ? (
                <p className="text-xs text-gray-400">Chưa có tài liệu nào.</p>
              ) : (
                recentFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-blue-500 text-[10px] font-bold bg-blue-100 px-1 rounded flex-shrink-0">FILE</span>
                      <p className="text-[11px] font-bold text-gray-700 truncate w-32">{file.title || file.name || 'Untitled'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <Link to="/learner/ai-workspace" className="text-[11px] font-bold text-blue-600 flex items-center gap-1 mt-2 hover:underline">
            View workspace ➔
          </Link>
        </div>
      </div>
    </div>
  );
};

const AIAssistantWidget = () => {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([{ id: 1, from: 'ai', text: "Hello! I'm your AI Study Assistant. Ask me anything about your uploaded documents." }]);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat]);

  const handleSend = () => {
    if (!input.trim()) return;
    setChat(prev => [...prev, { id: Date.now(), from: 'user', text: input }, { id: Date.now() + 1, from: 'ai', text: `AI: Tôi đã ghi nhận câu hỏi "${input}".` }]);
    setInput('');
  };

  return (
    <div className="col-span-6 bg-white rounded-2xl border border-gray-100 p-5 flex flex-col justify-between shadow-sm">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-gray-800">AI Study Assistant</h2>
          <button onClick={() => setChat([])} className="text-[10px] text-gray-400 hover:text-gray-600">Clear Chat</button>
        </div>
        <div ref={chatRef} className="space-y-3 text-xs h-40 overflow-y-auto pr-2 flex-1">
          {chat.map(msg => (
            <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'gap-2'}`}>
              <div className={`p-2.5 rounded-2xl border ${msg.from === 'user' ? 'bg-blue-50 text-blue-950 rounded-tr-none border-blue-100 max-w-[80%]' : 'bg-gray-50 text-gray-700 rounded-tl-none border-gray-100 max-w-[90%] leading-relaxed'}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 relative">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Ask anything..." className="w-full bg-gray-50 text-xs rounded-xl pl-4 pr-10 py-2.5 border border-gray-100 outline-none focus:bg-white focus:border-blue-300" />
        <button onClick={handleSend} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs shadow-sm">➔</button>
      </div>
    </div>
  );
};

// ==========================================
// 2. COMPONENT MẸ: DASHBOARD CHÍNH
// ==========================================
export default function Dashboard() {
  const { user } = useAuth();
  const userEmail = user?.email || 'student@acognix.com';

  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  
  // State lưu ID Project đầu tiên thu thập được từ Workspace API
  const [firstProjectId, setFirstProjectId] = useState(null);

  // Hàm tải dữ liệu tổng cho toàn bộ Dashboard
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      /*
      * Bước 1:
      * Load Progress + Workspace trước.
      */
      const [
        progressRes,
        workspaceRes
      ] = await Promise.all([
        getProgressOverview(
          userEmail,
          'Last 7 days'
        ).catch(() => null),

        getWorkspaceData()
          .catch(() => null)
      ]);


      setOverviewData(
        progressRes
      );


      /*
      * Bước 2:
      * Lấy danh sách Project từ Workspace.
      */
      const projects =
        Array.isArray(
          workspaceRes?.AI_Project
        )
          ? workspaceRes.AI_Project
          : Array.isArray(
              workspaceRes?.AI_Projects
            )
            ? workspaceRes.AI_Projects
            : [];


      /*
      * Project đầu tiên dùng cho
      * Upload Zone.
      */
      const firstProjectId =
        projects[0]?.projectId ||
        null;

      setFirstProjectId(
        firstProjectId
      );


      /*
      * Bước 3:
      * Tổng hợp Learning Materials.
      */
      let files = [];

      projects.forEach(
        (project) => {
          const materials =
            project.Learning_Material ||
            project.materials ||
            [];

          files = [
            ...files,
            ...materials
          ];
        }
      );

      setRecentFiles(
        files.slice(0, 3)
      );


      const noteResult =
      await getAllNotes();


      const allNotes =
        Array.isArray(
          noteResult?.notes
        )
          ? noteResult.notes
          : [];


      setRecentNotes(
        allNotes
          .slice(0, 3)
          .map(
            (note) => ({
              id:
                note.noteId,

              title:
                note.title ||
                `Untitled Note`,

              date:
                note.updatedAt || 
                note.createdAt,

              projectName:
                note.project?.name ||
                null
            })
          )
      );

    } catch (error) {
      console.error(
        'Lỗi khi tải dữ liệu Dashboard:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [userEmail]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-gray-50 text-sm text-gray-500">Đang đồng bộ dữ liệu Dashboard...</div>;
  }

  const chartLabels = overviewData?.chartData?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartValues = overviewData?.chartData?.data || [0, 0, 0, 0, 0, 0, 0];
  const quizzes = (overviewData?.activities || []).filter(a => a.type === 'quiz').slice(0, 3);

  const chartData = {
    labels: chartLabels,
    datasets: [{ label: 'Study Hours', data: chartValues, borderColor: '#2563EB', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 8 } } }, y: { min: 0, ticks: { font: { size: 8 } } } }
  };

  return (
    <main className="flex-1 p-6 overflow-y-auto space-y-6 bg-gray-50">
      {/* ROW 1: AI STUDY ZONE & AI STUDY ASSISTANT */}
      <div className="grid grid-cols-12 gap-6">
        {/* TRUYỀN PROPS VÀO ĐÂY:
            1. recentFiles: Hiển thị danh sách file
            2. firstProjectId: Đưa ID project xuống để con dùng upload
            3. onUploadSuccess: Đưa hàm reload xuống để con gọi sau khi upload thành công
        */}
        <UploadZone 
          recentFiles={recentFiles} 
          firstProjectId={firstProjectId} 
          onUploadSuccess={fetchDashboardData} 
        />
        <AIAssistantWidget />
      </div>

      {/* ROW 2: 4 WIDGETS */}
      <div className="grid grid-cols-12 gap-6">
        {/* Card 1: Quiz Summary */}
        <div className="col-span-3 bg-white rounded-2xl border border-gray-100 p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-gray-800">Quiz Summary</h3>
              <Link to="/learner/quizzes" className="text-[10px] text-blue-600 font-semibold hover:underline">View all</Link>
            </div>
            <div className="space-y-3">
              {quizzes.length === 0 ? (
                <p className="text-xs text-gray-400">Chưa làm bài Quiz nào.</p>
              ) : (
                quizzes.map((quiz, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-blue-500 text-[10px] font-bold bg-blue-100 px-1 rounded flex-shrink-0">QUIZ</span>
                      <p className="text-[11px] font-bold text-gray-700 truncate w-32">{quiz.title}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Flashcards Ready */}
        <div className="col-span-3 bg-white rounded-2xl border border-gray-100 p-4 flex flex-col justify-between shadow-sm text-center">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-gray-800">Flashcards Ready</h3>
            </div>
            <div className="relative w-24 h-24 mx-auto my-4 flex items-center justify-center rounded-full border-4 border-emerald-500">
              <span className="text-lg font-bold text-gray-800">100%</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">{overviewData?.flashcardsReviewed || 0} cards reviewed</p>
          </div>
          <Link to="/learner/flashcards" className="w-full block bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2 rounded-xl transition-colors shadow-sm">
            Review Flashcards
          </Link>
        </div>

        {/* Card 3: My Chapter Notes */}
        <div className="col-span-3 bg-white rounded-2xl border border-gray-100 p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-gray-800">My Chapter Notes</h3>
              <Link to="/learner/notes" className="text-[10px] text-blue-600 font-semibold hover:underline">View all</Link>
            </div>
            <div className="space-y-2">
              {recentNotes.length === 0 ? (
                <p className="text-xs text-gray-400">Chưa có ghi chú nào.</p>
              ) : (
                recentNotes.map((note) => (
                  <div key={note.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-amber-500 text-[10px] font-bold bg-amber-100 px-1 rounded flex-shrink-0">NOTE</span>
                      <div className="text-left truncate">
                        <p className="text-[11px] font-bold text-gray-700 truncate w-24">{note.title}</p>
                        <p className="text-[9px] text-gray-400">{note.date}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <Link to="/learner/notes" className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-2 hover:underline">+ New Note</Link>
        </div>

        {/* Card 4: Study Progress Chart */}
        <div className="col-span-3 bg-white rounded-2xl border border-gray-100 p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-gray-800">Study Progress</h3>
            </div>
            <div className="h-32 w-full mt-2">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
          <div className="text-[10px] text-gray-500 mt-2 border-t pt-2 text-center font-semibold">
            Thời gian học: {overviewData?.timeStudied || '0h 0m'}
          </div>
        </div>
      </div>
    </main>
  );
}