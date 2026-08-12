// frontend/src/pages/learner/AIWorkspace.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext'; // Import Toast Hook
import { createNote } from '../../features/notes/noteApi';
import ReactMarkdown from 'react-markdown';
import { 
  sendAIChatMessage, 
  getAIConversationHistory, 
  generateAIQuiz, 
  generateAIFlashcards, 
  getSavedFlashcards 
} from '../../services/aiService';
import { Link } from 'react-router-dom';
import { getWorkspaceData, uploadProjectMaterial, createWorkspaceProject } from '../../services/workspaceService';

export default function AIWorkspace() {
  const { user } = useAuth();
  const { showToast } = useToast(); // Sử dụng hàm showToast

  const [workspace, setWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hasNoWorkspace, setHasNoWorkspace] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // STATE TẠO PROJECT
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  // STATE NOTE
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStatus, setNoteStatus] = useState('');

  // STATE CHAT
  const [chatInput, setChatInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [chatHistory, setChatHistory] = useState([
    { from: 'ai', text: "Xin chào! Tôi là AI Study Assistant. Hãy chọn tài liệu trong Project của bạn để tôi hướng dẫn." }
  ]);
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // STATE FLASHCARD
  const [flashcardSets, setFlashcardSets] = useState([]);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [showFCModal, setShowFCModal] = useState(false);

  // STATE QUIZ
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);

  // 1. TẢI WORKSPACE
  const fetchWorkspace = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setHasNoWorkspace(false);
      
      const data = await getWorkspaceData();
      if (data?.notFound) {
        setHasNoWorkspace(true);
        return;
      }
      setWorkspace(data);
      const projectList = data?.AI_Project || data?.AI_Projects || [];
      setProjects(projectList);
      
      if (projectList.length > 0) {
        const activeProj = currentProject
          ? projectList.find(p => (p.projectId === currentProject.projectId || p.id === currentProject.id)) || projectList[0]
          : projectList[0];
        setCurrentProject(activeProj);
        setMaterials(activeProj.Learning_Material || activeProj.materials || []);
      } else {
        setCurrentProject(null);
        setMaterials([]);
      }
    } catch (err) {
      setErrorMsg(err.message || "Không thể tải Workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  // LOAD FLASHCARDS
  useEffect(() => {
    const fetchFlashcards = async () => {
      const projId = currentProject?.projectId || currentProject?.id;
      if (!projId) return;
      try {
        const res = await getSavedFlashcards(projId);
        setFlashcardSets(res.data || []);
      } catch (err) {
        console.error("Lỗi tải Flashcards:", err);
      }
    };
    fetchFlashcards();
  }, [currentProject]);

  // LOAD CHAT HISTORY
  useEffect(() => {
    const fetchChatHistory = async () => {
      const projId = currentProject?.projectId || currentProject?.id;
      if (!projId) return;
      try {
        setLoadingHistory(true);
        const res = await getAIConversationHistory(projId);
        
        if (res?.data?.messages && Array.isArray(res.data.messages)) {
          setConversationId(res.data.conversationId);
          const formattedMsgs = res.data.messages.map(msg => ({
            from: msg.senderRole === 'USER' ? 'user' : 'ai',
            text: msg.content
          }));
          setChatHistory(formattedMsgs.length > 0 ? formattedMsgs : [
            { from: 'ai', text: `Bạn đang ở "${currentProject.name}". Hãy đặt câu hỏi cho AI!` }
          ]);
        } else {
          setConversationId(null);
          setChatHistory([{ from: 'ai', text: `Bạn đang ở "${currentProject.name}". Hãy đặt câu hỏi cho AI!` }]);
        }
      } catch (err) {
        setConversationId(null);
        setChatHistory([{ from: 'ai', text: `Bạn đang ở "${currentProject.name}". Hãy đặt câu hỏi cho AI!` }]);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchChatHistory();
  }, [currentProject]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, sendingChat]);

  // HANDLERS
  const handleSendChat = async () => {
    if (!chatInput.trim() || sendingChat) return;
    const projId = currentProject?.projectId || currentProject?.id;
    if (!projId) return showToast("Vui lòng chọn hoặc tạo Project trước khi chat!", "warning");
    
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { from: 'user', text: userMsg }]);
    try {
      setSendingChat(true);
      const response = await sendAIChatMessage(projId, conversationId, userMsg);
      if (response?.data?.conversationId) setConversationId(response.data.conversationId);
      setChatHistory(prev => [...prev, { from: 'ai', text: response?.data?.reply || "Không nhận được phản hồi." }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { from: 'ai', text: `Lỗi AI: ${err.message || 'Không thể kết nối.'}` }]);
    } finally {
      setSendingChat(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const wsId = workspace?.workspaceId || workspace?.id;
    if (!wsId) return showToast("Lỗi: Không tìm thấy ID Workspace!", "error");
    try {
      setCreating(true);
      await createWorkspaceProject(newProjectName, wsId);
      showToast("Tạo Project thành công!", "success");
      setNewProjectName('');
      setIsCreatingProject(false);
      await fetchWorkspace();
    } catch (err) {
      showToast("Lỗi khi tạo Project: " + err.message, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !currentProject) return;
    const projectId = currentProject.projectId || currentProject.id;
    const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    const safeFile = new File([file], safeName, { type: file.type });
    try {
      setUploading(true);
      await uploadProjectMaterial(projectId, safeFile);
      showToast("Tải tài liệu lên thành công!", "success");
      await fetchWorkspace();
    } catch (err) {
      showToast("Lỗi khi tải file: " + err.message, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() && !noteContent.trim()) return showToast('Nội dung ghi chú đang trống!', 'warning');
    const projectId = currentProject?.projectId || currentProject?.id;
    if (!projectId) return showToast('Không tìm thấy Project.', 'error');
    try {
      setNoteStatus('Đang lưu...');
      await createNote(projectId, { title: noteTitle.trim() || 'Untitled Note', content: noteContent });
      setNoteStatus('Lưu thành công');
      showToast('Đã lưu ghi chú!', 'success');
      setNoteTitle('');
      setNoteContent('');
    } catch (error) {
      setNoteStatus('Lưu thất bại');
      showToast(error.message || 'Không thể lưu ghi chú.', 'error');
    }
  };

  const handleGenerateFlashcards = async (e) => {
    e?.preventDefault();
    if (!currentProject) return showToast("Vui lòng chọn Project!", "warning");
    if (!materials || materials.length === 0) {
      return showToast("Project này chưa có tài liệu! Vui lòng tải lên ít nhất 1 file PDF/DOCX.", "warning");
    }
    const projectId = currentProject.projectId || currentProject.id;
    try {
      setGeneratingFlashcards(true);
      await generateAIFlashcards(projectId, 10, 'short');
      showToast("AI đã tạo Flashcards thành công!", "success");
      setShowFCModal(false);
      const res = await getSavedFlashcards(projectId);
      setFlashcardSets(res.data || []);
    } catch (err) {
      if (err.message?.includes("active context") || err.message?.includes("Learning Material")) {
        showToast("Không tìm thấy dữ liệu chữ! Hãy đảm bảo file bạn tải lên đọc được văn bản.", "error");
      } else {
        showToast("Lỗi tạo Flashcards: " + err.message, "error");
      }
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  const handleGenerateQuiz = async (e) => {
    e?.preventDefault();
    if (!currentProject) return showToast("Vui lòng chọn Project!", "warning");
    if (!materials || materials.length === 0) {
      return showToast("Project này chưa có tài liệu! Vui lòng tải lên ít nhất 1 file PDF/DOCX.", "warning");
    }
    const projectId = currentProject.projectId || currentProject.id;
    try {
      setGeneratingQuiz(true);
      await generateAIQuiz(projectId, 5, 'medium');
      showToast("AI đã tạo Practice Quiz thành công!", "success");
      setShowQuizModal(false);
    } catch (err) {
      if (err.message?.includes("active context") || err.message?.includes("Learning Material")) {
        showToast("Không tìm thấy dữ liệu chữ! Hãy đảm bảo file bạn tải lên đọc được văn bản.", "error");
      } else {
        showToast("Lỗi tạo Quiz: " + err.message, "error");
      }
    } finally {
      setGeneratingQuiz(false);
    }
  };

  // RENDERS
  if (loading && !workspace) return <div className="flex-1 flex items-center justify-center p-6 bg-gray-50"><p className="text-sm text-gray-500">Đang đồng bộ Workspace...</p></div>;
  
  if (hasNoWorkspace) return (
    <main className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm text-center">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Chưa có Workspace</h2>
        <p className="text-sm text-gray-500 mb-4">Hệ thống không tìm thấy không gian học tập của bạn.</p>
        <button onClick={() => fetchWorkspace()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Tải lại trang</button>
      </div>
    </main>
  );

  return (
    <main className="flex-1 grid grid-cols-12 overflow-hidden bg-white relative">
      
      {/* CỘT TRÁI */}
      <div className="col-span-4 h-full bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="min-w-0 flex-1 pr-2">
              {projects.length > 0 ? (
                <select 
                  value={currentProject?.projectId || currentProject?.id || ''}
                  onChange={(e) => {
                    const proj = projects.find(p => (p.projectId === e.target.value || p.id === e.target.value));
                    setCurrentProject(proj);
                    setMaterials(proj?.Learning_Material || proj?.materials || []);
                  }}
                  className="text-sm font-bold text-gray-800 bg-transparent outline-none truncate w-full cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                  {projects.map(p => <option key={p.projectId || p.id} value={p.projectId || p.id}>{p.name}</option>)}
                </select>
              ) : (
                <h2 className="text-sm font-bold text-gray-400">Chưa có Project nào</h2>
              )}
            </div>
            <button 
              onClick={() => setIsCreatingProject(true)}
              className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1.5 rounded font-bold transition-colors flex-shrink-0 whitespace-nowrap"
            >+ New Project</button>
          </div>
          <div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf,.docx" onChange={handleFileUpload} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !currentProject}
              className={`w-full text-xs py-2 rounded font-bold transition-colors shadow-sm ${currentProject ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              {uploading ? 'Đang tải lên...' : (currentProject ? '+ Tải tài liệu vào Project này' : 'Tạo Project trước')}
            </button>
          </div>
        </div>

        {/* DANH SÁCH TÀI LIỆU */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-gray-600 leading-relaxed space-y-3 bg-gray-50/30">
          {errorMsg ? (
            <p className="text-center text-red-500 mt-10">{errorMsg}</p>
          ) : !currentProject ? (
            <div className="text-center mt-10">
              <p className="text-gray-400 mb-2">Tạo Project để tải tài liệu học tập.</p>
              <button onClick={() => setIsCreatingProject(true)} className="text-blue-600 font-semibold hover:underline">Tạo Project ngay</button>
            </div>
          ) : materials.length > 0 ? (
            materials.map((mat, idx) => (
              <div key={idx} className="p-3 bg-white shadow-sm rounded-xl border border-gray-100 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <p className="font-bold text-gray-800 line-clamp-2">{mat.title}</p>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{mat.fileType || 'Document'}</span>
                  <a href={mat.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-semibold">Xem file</a>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 mt-10">Chưa có tài liệu nào trong Project này.</p>
          )}
        </div>

        {/* AI FLASHCARDS & QUIZZES */}
        <div className="p-5 border-t border-gray-100 bg-emerald-50/30 flex-shrink-0 flex flex-col gap-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-gray-800 text-sm">AI Flashcards</span>
              <button 
                onClick={() => setShowFCModal(true)}
                disabled={generatingFlashcards || !currentProject || materials.length === 0}
                className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded font-bold shadow-sm disabled:opacity-50"
              >
                {generatingFlashcards ? 'Đang tạo...' : '+ Tạo thẻ'}
              </button>
            </div>
            <Link to="/learner/flashcards" className="text-[10px] font-semibold text-emerald-600 hover:underline">Quản lý Flashcards &rarr;</Link>
          </div>

          <div className="pt-4 border-t border-emerald-100/50">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-gray-800 text-sm">AI Practice Quizzes</span>
              <button 
                onClick={() => setShowQuizModal(true)}
                disabled={generatingQuiz || !currentProject || materials.length === 0}
                className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 rounded font-bold shadow-sm disabled:opacity-50"
              >
                {generatingQuiz ? 'Đang tạo...' : '+ Tạo đề'}
              </button>
            </div>
            <Link to="/learner/ai-quizzes" className="text-[10px] font-semibold text-blue-600 hover:underline">Kho đề trắc nghiệm AI &rarr;</Link>
          </div>
        </div>
      </div>

      {/* CỘT GIỮA: AI CHAT */}
      <div className="col-span-5 h-full flex flex-col bg-gray-50/50 min-h-0">
        <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-800">✨ AI Study Assistant</h2>
          {currentProject && (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-semibold truncate max-w-[150px]">
              {currentProject.name}
            </span>
          )}
        </div>
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs min-h-0">
          {loadingHistory ? (
            <div className="text-center text-gray-400 italic py-4">Đang tải lịch sử trò chuyện...</div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.from === 'user' ? 'justify-end' : 'gap-2'}`}>
                <div className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${msg.from === 'user' ? 'bg-blue-600 text-white rounded-tr-none shadow-sm' : 'bg-white text-gray-700 border border-gray-100 shadow-sm whitespace-pre-wrap'}`}>
                  {msg.from === 'user' ? msg.text : <ReactMarkdown className="prose prose-sm max-w-none">{msg.text}</ReactMarkdown>}
                </div>
              </div>
            ))
          )}
          {sendingChat && (
            <div className="flex gap-2">
              <div className="bg-white text-gray-400 border border-gray-100 p-3 rounded-2xl text-xs italic shadow-sm">AI đang suy nghĩ...</div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
          <div className="relative">
            <textarea 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())}
              placeholder={currentProject ? `Hỏi AI về kiến thức trong "${currentProject.name}"...` : "Hãy chọn Project để chat..."}
              disabled={!currentProject || sendingChat}
              rows="2"
              className="w-full bg-gray-50 text-xs rounded-xl p-3 pr-10 border border-gray-200 outline-none resize-none focus:border-blue-400 focus:bg-white transition-all disabled:bg-gray-100"
            />
            <button 
              disabled={!currentProject || !chatInput.trim() || sendingChat} 
              onClick={handleSendChat} 
              className="absolute right-3 top-3 w-7 h-7 bg-blue-600 disabled:bg-gray-300 text-white rounded-lg flex items-center justify-center text-xs transition-colors shadow-sm"
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: GHI CHÚ */}
      <div className="col-span-3 h-full bg-white border-l border-gray-100 flex flex-col p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-gray-800">📝 Personal Notes</span>
          {noteStatus && <span className="text-[10px] text-gray-400 italic">{noteStatus}</span>}
        </div>
        <input 
          type="text" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} 
          placeholder="Tiêu đề ghi chú..." className="w-full text-xs font-bold border border-gray-200 p-2.5 rounded-lg outline-none focus:border-blue-400 bg-gray-50/50" 
        />
        <textarea 
          value={noteContent} onChange={e => setNoteContent(e.target.value)} rows="12" 
          placeholder="Nội dung ghi chú..." className="w-full text-xs border border-gray-200 p-2.5 rounded-lg outline-none resize-none flex-1 focus:border-blue-400 bg-gray-50/50 leading-relaxed" 
        />
        <button 
          onClick={handleSaveNote} 
          className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm transition-colors"
        >
          Lưu Ghi Chú
        </button>
      </div>

      {/* MODALS */}
      
      {/* Modal: Create Project */}
      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Tạo Project Học Tập</h3>
            <p className="text-xs text-gray-500 mb-4">Gom nhóm tài liệu liên quan vào cùng một Project.</p>
            <form onSubmit={handleCreateProject}>
              <input 
                type="text" required value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} 
                placeholder="VD: Nhập môn Machine Learning..." className="w-full text-sm text-gray-800 border border-gray-300 p-3 rounded-lg mb-5 outline-none" 
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreatingProject(false); setNewProjectName(''); }} className="px-4 py-2.5 text-xs font-semibold bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" disabled={creating || !newProjectName.trim()} className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-lg">Tạo Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generate Flashcards */}
      {showFCModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Tạo Flashcard bằng AI</h3>
            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Hệ thống sẽ tổng hợp kiến thức từ <span className="font-bold text-emerald-600">tất cả tài liệu</span> có trong Project hiện tại để trích xuất thẻ học thuật.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowFCModal(false)} className="px-4 py-2.5 text-xs font-semibold bg-gray-100 rounded-lg hover:bg-gray-200">Hủy</button>
              <button type="button" onClick={handleGenerateFlashcards} disabled={generatingFlashcards} className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {generatingFlashcards ? 'Đang tạo thẻ...' : 'Bắt đầu tạo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Generate Quiz */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Tạo Practice Quiz</h3>
            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Hệ thống sẽ đọc hiểu <span className="font-bold text-blue-600">toàn bộ tài liệu</span> nằm trong Project này để sinh ra bộ câu hỏi trắc nghiệm tự luyện.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowQuizModal(false)} className="px-4 py-2.5 text-xs font-semibold bg-gray-100 rounded-lg hover:bg-gray-200">Hủy</button>
              <button type="button" onClick={handleGenerateQuiz} disabled={generatingQuiz} className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {generatingQuiz ? 'Đang tạo đề...' : 'Bắt đầu tạo'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}