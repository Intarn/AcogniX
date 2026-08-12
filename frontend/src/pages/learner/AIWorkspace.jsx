// frontend/src/pages/learner/AIWorkspace.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createNote } from '../../features/notes/noteApi';
import ReactMarkdown from 'react-markdown';
import { sendAIChatMessage, getAIConversationHistory, generateAIQuiz, getSavedQuizzes, generateAIFlashcards, getSavedFlashcards } from '../../services/aiService';
import { Link } from 'react-router-dom';
import { getWorkspaceData, uploadProjectMaterial, createWorkspaceProject } from '../../services/workspaceService';

export default function AIWorkspace() {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hasNoWorkspace, setHasNoWorkspace] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // STATE CHO TẠO PROJECT
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  // Notes state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStatus, setNoteStatus] = useState('');

  // AI Chat state
  const [chatInput, setChatInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [chatHistory, setChatHistory] = useState([
    { from: 'ai', text: "Xin chào! Tôi là trợ lý AI Study Assistant. Hãy đặt câu hỏi về tài liệu trong Project của bạn." }
  ]);
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- STATE FLASHCARD ---
  const [flashcardSets, setFlashcardSets] = useState([]);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [showFCModal, setShowFCModal] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');

  // Load Flashcards mỗi khi đổi Project
  useEffect(() => {
    const fetchFlashcards = async () => {
      const projId = currentProject?.projectId || currentProject?.id;
      if (!projId) return;
      try {
        const res = await getSavedFlashcards(projId);
        setFlashcardSets(res.data || []);
      } catch (err) {
        console.error("Lỗi lấy Flashcards:", err);
      }
    };
    fetchFlashcards();
  }, [currentProject]);

  const handleGenerateFlashcards = async (e) => {
    e.preventDefault();
    if (!currentProject || !selectedMaterialId) {
      alert("Vui lòng chọn tài liệu để tạo Flashcard!");
      return;
    }
    const projectId = currentProject.projectId || currentProject.id;
    try {
      setGeneratingFlashcards(true);
      await generateAIFlashcards(projectId, 10, 'short');
      alert("AI đã tạo Flashcards thành công!");
      setShowFCModal(false);
      setSelectedMaterialId('');
      // Reload danh sách thẻ
      const res = await getSavedFlashcards(projectId);
      setFlashcardSets(res.data || []);
    } catch (err) {
      alert("Lỗi tạo Flashcards: " + err.message);
    } finally {
      setGeneratingFlashcards(false);
    }
  };

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

  // 2. TẢI LỊCH SỬ CHAT KHI ĐỔI PROJECT
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
            { from: 'ai', text: `Đã kết nối với "${currentProject.name}". Hãy đặt câu hỏi cho AI!` }
          ]);
        } else {
          setConversationId(null);
          setChatHistory([
            { from: 'ai', text: `Đã kết nối với "${currentProject.name}". Hãy đặt câu hỏi cho AI!` }
          ]);
        }
      } catch (err) {
        console.warn("Chưa có lịch sử hội thoại cũ hoặc lỗi:", err.message);
        setConversationId(null);
        setChatHistory([
          { from: 'ai', text: `Đã kết nối với "${currentProject.name}". Hãy đặt câu hỏi cho AI!` }
        ]);
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

  // 3. XỬ LÝ GỬI TIN NHẮN TỚI AI BACKEND
  const handleSendChat = async () => {
    if (!chatInput.trim() || sendingChat) return;

    const projId = currentProject?.projectId || currentProject?.id;
    if (!projId) {
      alert("Vui lòng chọn hoặc tạo Project trước khi chat!");
      return;
    }

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { from: 'user', text: userMsg }]);

    try {
      setSendingChat(true);
      const response = await sendAIChatMessage(projId, conversationId, userMsg);
      const replyText = response?.data?.reply;
      const newConvId = response?.data?.conversationId;

      if (newConvId) {
        setConversationId(newConvId);
      }

      setChatHistory(prev => [
        ...prev, 
        { from: 'ai', text: replyText || "Không nhận được phản hồi từ AI." }
      ]);
    } catch (err) {
      console.error("Lỗi kết nối AI:", err);
      setChatHistory(prev => [
        ...prev, 
        { from: 'ai', text: `Lỗi kết nối AI: ${err.message || 'Không thể xử lý yêu cầu.'}` }
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  // 4. CÁC HÀM XỬ LÝ TẠO PROJECT, UPLOAD FILE & LƯU NOTE
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName || !newProjectName.trim()) return;
    const currentWorkspaceId = workspace?.workspaceId || workspace?.id;
    if (!currentWorkspaceId) {
      alert("Lỗi: Không tìm thấy ID của Workspace!");
      return;
    }
    try {
      setCreating(true);
      await createWorkspaceProject(newProjectName, currentWorkspaceId);
      alert("Tạo Project thành công!");
      setNewProjectName('');
      setIsCreatingProject(false);
      await fetchWorkspace();
    } catch (err) {
      alert("Lỗi khi tạo Project: " + (err.message || "Xảy ra lỗi"));
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
      alert("Tải tài liệu thành công!");
      await fetchWorkspace();
    } catch (err) {
      alert("Lỗi khi tải file: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() && !noteContent.trim()) {
      alert('Nội dung ghi chú không được để trống!');
      return;
    }
    const projectId = currentProject?.projectId || currentProject?.id;
    if (!projectId) {
      alert('ID Project không hợp lệ. Vui lòng tải lại trang.');
      return;
    }
    try {
      setNoteStatus('Đang lưu...');
      await createNote(projectId, {
        title: noteTitle.trim() || 'Untitled Note',
        content: noteContent
      });
      setNoteStatus('Đã lưu thành công');
      alert('Đã lưu ghi chú!');
      setNoteTitle('');
      setNoteContent('');
    } catch (error) {
      setNoteStatus('Lưu thất bại');
      alert(error.message || 'Không thể lưu ghi chú.');
    }
  };

  if (loading && !workspace) return <div className="flex-1 flex items-center justify-center p-6 bg-gray-50"><p className="text-sm text-gray-500">Đang đồng bộ Workspace...</p></div>;
  if (hasNoWorkspace) return (
    <main className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm text-center">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Chưa có Workspace</h2>
        <p className="text-sm text-gray-500 mb-4">Hệ thống chưa tìm thấy không gian học tập của bạn.</p>
        <button onClick={() => fetchWorkspace()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Tải lại trang</button>
      </div>
    </main>
  );

  return (
    <main className="flex-1 grid grid-cols-12 overflow-hidden bg-white relative">
      {/* LEFT: MATERIALS & PROJECTS VIEWER */}
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
                  {projects.map(p => (
                    <option key={p.projectId || p.id} value={p.projectId || p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <h2 className="text-sm font-bold text-gray-400">Chưa có Project nào</h2>
              )}
            </div>
            <button 
              onClick={() => setIsCreatingProject(true)}
              className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1.5 rounded font-bold transition-colors flex-shrink-0 whitespace-nowrap"
            >
              + New Project
            </button>
          </div>
          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".pdf,.docx" 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !currentProject}
              className={`w-full text-xs py-2 rounded font-bold transition-colors shadow-sm ${
                currentProject 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
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
              <p className="text-gray-400 mb-2">Tạo Project để thêm tài liệu học tập.</p>
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

        {/* KHU VỰC AI FLASHCARDS */}
        <div className="p-5 border-t border-gray-100 bg-emerald-50/30 flex-shrink-0">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-gray-800 text-sm">AI Flashcards</span>
            <button 
              onClick={() => setShowFCModal(true)}
              disabled={generatingFlashcards || !currentProject || materials.length === 0}
              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingFlashcards ? 'Đang tạo...' : '+ Tự động tạo thẻ'}
            </button>
          </div>
          
          <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
            {flashcardSets.length > 0 ? (
              flashcardSets.map((fc, idx) => (
                <div key={fc.flashcardSetId || idx} className="p-3 bg-white shadow-sm rounded-xl border border-gray-100 flex flex-col gap-2">
                  <p className="font-bold text-gray-800 text-xs">Flashcard Set {idx + 1}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400">{fc.Flashcard?.length || 0} thẻ</span>
                    <Link 
                      to={`/learner/flashcards/study?projectId=${currentProject.projectId || currentProject.id}&setId=${fc.flashcardSetId || fc.id}&name=Flashcard+Set+${idx + 1}`} 
                      className="text-emerald-600 text-[10px] font-semibold hover:underline"
                    >
                      Học ngay
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 text-[10px] mt-2">Chưa có thẻ lật nào.</p>
            )}
          </div>
        </div>
      </div>

      {/* MIDDLE: AI CHAT */}
      <div className="col-span-5 h-full flex flex-col bg-gray-50/50 min-h-0">
        <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-800">🤖 AI Study Assistant</h2>
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
                  {msg.from === 'user' ? (
                    msg.text
                  ) : (
                    <ReactMarkdown className="prose prose-sm max-w-none">
                      {msg.text}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))
          )}
          {sendingChat && (
            <div className="flex gap-2">
              <div className="bg-white text-gray-400 border border-gray-100 p-3 rounded-2xl text-xs italic shadow-sm">
                AI đang suy nghĩ và phản hồi...
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
          <div className="relative">
            <textarea 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())}
              placeholder={currentProject ? `Hỏi AI về kiến thức trong "${currentProject.name}"...` : "Hãy chọn Project để bắt đầu chat..."}
              disabled={!currentProject || sendingChat}
              rows="2"
              className="w-full bg-gray-50 text-xs rounded-xl p-3 pr-10 border border-gray-200 outline-none resize-none focus:border-blue-400 focus:bg-white transition-all disabled:bg-gray-100"
            />
            <button 
              disabled={!currentProject || !chatInput.trim() || sendingChat} 
              onClick={handleSendChat} 
              className="absolute right-3 top-3 w-7 h-7 bg-blue-600 disabled:bg-gray-300 text-white rounded-lg flex items-center justify-center text-xs transition-colors shadow-sm"
            >
              ➔
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: PERSONAL NOTES */}
      <div className="col-span-3 h-full bg-white border-l border-gray-100 flex flex-col p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-gray-800">📝 Personal Notes</span>
          {noteStatus && <span className="text-[10px] text-gray-400 italic">{noteStatus}</span>}
        </div>
        <input 
          type="text" 
          value={noteTitle} 
          onChange={e => setNoteTitle(e.target.value)} 
          placeholder="Tiêu đề ghi chú..." 
          className="w-full text-xs font-bold border border-gray-200 p-2.5 rounded-lg outline-none focus:border-blue-400 bg-gray-50/50" 
        />
        <textarea 
          value={noteContent} 
          onChange={e => setNoteContent(e.target.value)} 
          rows="12" 
          placeholder="Nội dung ghi chú..." 
          className="w-full text-xs border border-gray-200 p-2.5 rounded-lg outline-none resize-none flex-1 focus:border-blue-400 bg-gray-50/50 leading-relaxed" 
        />
        <button 
          onClick={handleSaveNote} 
          className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm transition-colors"
        >
          Lưu Ghi Chú
        </button>
      </div>

      {/* MODAL TẠO PROJECT MỚI */}
      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Tạo Project Học Tập</h3>
            <p className="text-xs text-gray-500 mb-4">Gom nhóm tài liệu liên quan vào cùng một Project để AI hỗ trợ chính xác hơn.</p>
            <form onSubmit={handleCreateProject}>
              <input 
                type="text" 
                required
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="VD: Nhập môn Machine Learning..." 
                className="w-full text-sm text-gray-800 border border-gray-300 p-3 rounded-lg mb-5 outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsCreatingProject(false);
                    setNewProjectName('');
                  }} 
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={creating || !newProjectName.trim()}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Đang tạo...' : 'Tạo Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHỌN TÀI LIỆU TẠO FLASHCARD */}
      {showFCModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Tạo Flashcard bằng AI</h3>
            <p className="text-xs text-gray-500 mb-5">Chọn tài liệu bạn muốn AI đọc và trích xuất thành thẻ lật.</p>
            
            <form onSubmit={handleGenerateFlashcards}>
              <label className="block text-xs font-bold text-gray-700 mb-2">Tài liệu ngữ cảnh</label>
              <select 
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full text-sm text-gray-800 border border-gray-300 bg-gray-50 p-3 rounded-lg mb-6 outline-none focus:border-emerald-500"
                required
              >
                <option value="" disabled>-- Chọn tài liệu --</option>
                {materials.map(mat => (
                  <option key={mat.materialId || mat.id} value={mat.materialId || mat.id}>{mat.title}</option>
                ))}
              </select>

              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => { setShowFCModal(false); setSelectedMaterialId(''); }}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={generatingFlashcards}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={generatingFlashcards || !selectedMaterialId}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {generatingFlashcards ? 'Đang tạo thẻ...' : 'Bắt đầu tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}