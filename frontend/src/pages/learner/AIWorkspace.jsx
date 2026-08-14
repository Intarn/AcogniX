// frontend/src/pages/learner/AIWorkspace.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { createNote } from '../../features/notes/noteApi';
import ReactMarkdown from 'react-markdown';
import { 
  sendAIChatMessage, 
  getAIConversationHistory, 
  generateAIQuiz, 
  generateAIFlashcards, 
  getSavedFlashcards,
  extractDocumentText
} from '../../services/aiService';
import { Link, useNavigate } from 'react-router-dom';
import { 
  getWorkspaceData, 
  uploadProjectMaterial, 
  createWorkspaceProject,
  deleteProjectMaterial
} from '../../services/workspaceService';

export default function AIWorkspace() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();

  // ========================================================
  // STATE ĐIỀU KHIỂN ẨN / HIỆN VÀ KÉO THẢ 3 PANEL
  // ========================================================
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  
  // Tỷ lệ phần trăm chiều rộng (Mặc định: Trái 25%, Giữa 50%, Phải 25%)
  const [leftWidth, setLeftWidth] = useState(25);
  const [rightWidth, setRightWidth] = useState(25);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

  const [workspace, setWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hasNoWorkspace, setHasNoWorkspace] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStatus, setNoteStatus] = useState('');

  const [chatInput, setChatInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [chatHistory, setChatHistory] = useState([
    { from: 'ai', text: "Xin chào! Tôi là AI Tutor. Hãy chọn tài liệu làm ngữ cảnh (Context) để tôi hỗ trợ bạn tốt nhất." }
  ]);
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const [flashcardCount, setFlashcardCount] = useState(10);
  const [quizCount, setQuizCount] = useState(5);
  const [flashcardSets, setFlashcardSets] = useState([]);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [showFCModal, setShowFCModal] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);

  // PHÂN LOẠI PROJECTS THEO USE-CASE
  const classProjects = projects.filter(p => p.type === 'CLASS');
  const personalProjects = projects.filter(p => p.type !== 'CLASS');

  // ========================================================
  // SỰ KIỆN KÉO THẢ RESIZE
  // ========================================================
  useEffect(() => {
    const handleMouseMove = (e) => {
      const containerWidth = window.innerWidth;
      if (isDraggingLeft.current) {
        const newLeftWidth = (e.clientX / containerWidth) * 100;
        if (newLeftWidth >= 15 && newLeftWidth <= 45) {
          setLeftWidth(newLeftWidth);
        }
      }
      if (isDraggingRight.current) {
        const newRightWidth = ((containerWidth - e.clientX) / containerWidth) * 100;
        if (newRightWidth >= 15 && newRightWidth <= 45) {
          setRightWidth(newRightWidth);
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startDraggingLeft = () => {
    isDraggingLeft.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startDraggingRight = () => {
    isDraggingRight.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // TẢI WORKSPACE
  const fetchWorkspace = async (preservedProjectId = null) => {
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
        const targetId = preservedProjectId || currentProject?.projectId || currentProject?.id;
        const activeProj = targetId
          ? projectList.find(p => (p.projectId === targetId || p.id === targetId)) || projectList[0]
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

  useEffect(() => { fetchWorkspace(); }, []);

  useEffect(() => {
    if (materials && materials.length > 0) {
      const allIds = materials.map(m => m.materialId || m.id);
      setSelectedMaterialIds(allIds);
    } else {
      setSelectedMaterialIds([]);
    }
  }, [materials]);

  const toggleMaterialSelection = (materialId) => {
    setSelectedMaterialIds(prev => 
      prev.includes(materialId) ? prev.filter(id => id !== materialId) : [...prev, materialId] 
    );
  };

  useEffect(() => {
    const fetchFlashcards = async () => {
      const projId = currentProject?.projectId || currentProject?.id;
      if (!projId) return;
      try {
        const res = await getSavedFlashcards(projId);
        setFlashcardSets(res.data || []);
      } catch (err) { console.error("Lỗi tải Flashcards:", err); }
    };
    fetchFlashcards();
  }, [currentProject]);

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
            { from: 'ai', text: `Bạn đang ở "${currentProject.name}". Hãy đặt câu hỏi cho AI Tutor!` }
          ]);
        } else {
          setConversationId(null);
          setChatHistory([{ from: 'ai', text: `Bạn đang ở "${currentProject.name}". Hãy đặt câu hỏi cho AI Tutor!` }]);
        }
      } catch (err) {
        setConversationId(null);
        setChatHistory([{ from: 'ai', text: `Bạn đang ở "${currentProject.name}". Hãy đặt câu hỏi cho AI Tutor!` }]);
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
      showToast("Tạo Personal Project thành công!", "success");
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
    const files = Array.from(event.target.files);
    if (!files.length || !currentProject) return;
    const projectId = currentProject.projectId || currentProject.id;
    try {
      setUploading(true);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
        const safeFile = new File([file], safeName, { type: file.type });
        
        showToast(`Đang tải lên: ${file.name}...`, "info");
        const uploadRes = await uploadProjectMaterial(projectId, safeFile);
        const materialId = uploadRes?.materialId || uploadRes?.data?.materialId || uploadRes?.id;

        if (materialId) {
          showToast(`AI đang phân tích: ${file.name}...`, "info");
          await extractDocumentText(materialId, safeFile);
        }
      }
      showToast(`Đã tải lên & phân tích xong!`, "success");
      await fetchWorkspace(projectId); 
    } catch (err) {
      showToast("Lỗi xử lý tài liệu: " + err.message, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleDeleteMaterial = async (materialId, materialName) => {
    const isConfirmed = await confirm({
      title: 'Xóa tài liệu',
      message: `Bạn có chắc muốn xóa "${materialName}" khỏi Project này?`,
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy',
      tone: 'danger'
    });

    if (!isConfirmed) return;
    const projectId = currentProject.projectId || currentProject.id;
    try {
      await deleteProjectMaterial(projectId, materialId);
      showToast("Đã xóa tài liệu thành công!", "success");
      await fetchWorkspace(projectId);
    } catch (error) {
      showToast("Lỗi khi xóa tài liệu: " + error.message, "error");
    }
  };

  const handleRenameProject = () => {
    showToast("Tính năng Đổi tên Project đang được hoàn thiện ở Backend.", "info");
  };

  const handleDeleteProject = () => {
    showToast("Tính năng Xóa Project đang được hoàn thiện ở Backend.", "info");
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
    if (selectedMaterialIds.length === 0) return showToast("Vui lòng tick chọn ít nhất 1 tài liệu để AI có nguồn đọc!", "warning");

    const projectId = currentProject.projectId || currentProject.id;
    try {
      setGeneratingFlashcards(true);
      const res = await generateAIFlashcards(projectId, selectedMaterialIds, flashcardCount, 'short');
      showToast("AI tạo Flashcards thành công!", "success");
      setShowFCModal(false);
      
      if (res?.flashcardSetId || res?.data?.flashcardSetId) {
          const setId = res.flashcardSetId || res.data.flashcardSetId;
          navigate(`/learner/flashcards/study?projectId=${projectId}&setId=${setId}&name=Generated+Flashcards`);
      }
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
    if (selectedMaterialIds.length === 0) return showToast("Vui lòng tick chọn ít nhất 1 tài liệu để AI có nguồn đọc!", "warning");

    const projectId = currentProject.projectId || currentProject.id;
    try {
      setGeneratingQuiz(true);
      const res = await generateAIQuiz(projectId, selectedMaterialIds, quizCount, 'medium');
      showToast("AI đã tạo Practice Quiz thành công!", "success");
      setShowQuizModal(false);

      if (res?.quizId || res?.data?.quizId) {
          const quizId = res.quizId || res.data.quizId;
          navigate(`/learner/ai-quizzes/study?projectId=${projectId}&quizId=${quizId}&name=Generated+Quiz`);
      }
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

  if (loading && !workspace) return <div className="flex-1 flex items-center justify-center p-6 bg-gray-50"><p className="text-sm text-gray-500">Đang tải cấu trúc AI Workspace...</p></div>;
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
    <main className="flex-1 flex overflow-hidden bg-white relative w-full h-full">
      
      {/* ========================================================
          PANEL 1: DOCUMENT VIEWER & CONTEXT SELECTION (UC-01)
      ======================================================== */}
      {showLeftPanel && (
        <div 
          style={{ width: `${leftWidth}%` }} 
          className="h-full bg-white border-r border-gray-100 flex flex-col flex-shrink-0 min-w-[240px] max-w-[500px]"
        >
          <div className="p-4 border-b border-gray-100 flex flex-col gap-3 flex-shrink-0 bg-gray-50/50">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-800">📄 Documents</h2>
                {/* NÚT THU GỌN CỘT TRÁI */}
                <button 
                  onClick={() => setShowLeftPanel(false)}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-200 transition-colors text-xs"
                  title="Ẩn danh sách tài liệu"
                >
                  ◀
                </button>
              </div>
              <button 
                onClick={() => setIsCreatingProject(true)}
                className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1.5 rounded font-bold transition-colors"
              >+ New Project</button>
            </div>

            <div className="flex items-center gap-2">
              <select 
                value={currentProject?.projectId || currentProject?.id || ''}
                onChange={(e) => {
                  const proj = projects.find(p => (p.projectId === e.target.value || p.id === e.target.value));
                  setCurrentProject(proj);
                  setMaterials(proj?.Learning_Material || proj?.materials || []);
                }}
                className="flex-1 text-xs font-bold text-gray-800 bg-white border border-gray-200 p-2 rounded-lg outline-none cursor-pointer focus:border-blue-500 shadow-sm truncate"
              >
                {classProjects.length > 0 && (
                  <optgroup label="📚 Class Projects">
                    {classProjects.map(p => <option key={p.projectId || p.id} value={p.projectId || p.id}>{p.name}</option>)}
                  </optgroup>
                )}
                {personalProjects.length > 0 && (
                  <optgroup label="👤 Personal Projects">
                    {personalProjects.map(p => <option key={p.projectId || p.id} value={p.projectId || p.id}>{p.name}</option>)}
                  </optgroup>
                )}
              </select>

              {currentProject && currentProject.type !== 'CLASS' && (
                <div className="flex items-center gap-1">
                  <button onClick={handleRenameProject} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Rename">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={handleDeleteProject} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )}
            </div>

            <div>
              <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} accept=".pdf,.docx" onChange={handleFileUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !currentProject}
                className={`w-full text-xs py-2 rounded-lg font-bold transition-colors shadow-sm border ${currentProject ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed'}`}
              >
                {uploading ? 'Đang tải...' : '☁️ Upload Materials'}
              </button>
            </div>
          </div>

          {/* ACTIVE CONTEXT SELECTION */}
          <div className="flex-1 overflow-y-auto p-4 text-xs text-gray-600 leading-relaxed space-y-2.5 bg-white">
            {errorMsg ? (
              <p className="text-center text-red-500 mt-10">{errorMsg}</p>
            ) : !currentProject ? (
              <div className="text-center mt-10">
                <p className="text-gray-400 mb-2">Tạo Personal Project hoặc chọn Class Project để bắt đầu.</p>
              </div>
            ) : materials.length > 0 ? (
              <>
                <p className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wide">Active Context ({selectedMaterialIds.length}/{materials.length})</p>
                {materials.map((mat, idx) => {
                  const matId = mat.materialId || mat.id;
                  return (
                    <div key={idx} className={`p-2.5 rounded-xl border flex items-start gap-2.5 relative group transition-colors ${selectedMaterialIds.includes(matId) ? 'bg-blue-50/30 border-blue-200' : 'bg-white border-gray-100 opacity-60'}`}>
                      <input 
                        type="checkbox" 
                        className="mt-1 cursor-pointer w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                        checked={selectedMaterialIds.includes(matId)}
                        onChange={() => toggleMaterialSelection(matId)}
                      />
                      <div className="flex-1 flex flex-col gap-1 min-w-0 pr-5">
                        <p className={`font-bold line-clamp-2 leading-tight break-words text-xs ${selectedMaterialIds.includes(matId) ? 'text-gray-800' : 'text-gray-500'}`}>{mat.title}</p>
                        <div className="flex items-center mt-1">
                          <span className="text-[8px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded uppercase font-semibold">{mat.fileType || 'Doc'}</span>
                          <a href={mat.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[9px] font-semibold ml-auto">View &rarr;</a>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteMaterial(matId, mat.title)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Remove">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="text-center mt-10">
                <p className="text-gray-400 mb-2">Chưa có tài liệu ngữ cảnh nào.</p>
              </div>
            )}
          </div>

          {/* AI GENERATORS */}
          <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex-shrink-0 grid grid-cols-2 gap-2">
            <button 
              onClick={() => setShowFCModal(true)}
              disabled={generatingFlashcards || !currentProject || materials.length === 0}
              className="flex items-center justify-center gap-1.5 p-2 bg-white border border-gray-200 rounded-lg hover:border-emerald-400 hover:shadow-sm transition-all disabled:opacity-50"
            >
              <span className="text-xs">🗂️</span>
              <span className="text-[10px] font-bold text-gray-700">Flashcards</span>
            </button>
            
            <button 
              onClick={() => setShowQuizModal(true)}
              disabled={generatingQuiz || !currentProject || materials.length === 0}
              className="flex items-center justify-center gap-1.5 p-2 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all disabled:opacity-50"
            >
              <span className="text-xs">🎯</span>
              <span className="text-[10px] font-bold text-gray-700">Quiz</span>
            </button>
          </div>
        </div>
      )}

      {/* THANH KÉO (RESIZER 1: GIỮA TRÁI & GIỮA) */}
      {showLeftPanel && (
        <div 
          onMouseDown={startDraggingLeft}
          className="w-1.5 h-full hover:bg-blue-500 cursor-col-resize flex-shrink-0 bg-transparent transition-colors z-20 flex items-center justify-center group"
        >
          <div className="w-0.5 h-6 bg-gray-300 group-hover:bg-blue-600 rounded-full" />
        </div>
      )}

      {/* ========================================================
          PANEL 2: AI TUTOR CHAT (UC-01 & UC-02)
      ======================================================== */}
      <div className="flex-1 h-full flex flex-col bg-gray-50/30 min-w-[320px] overflow-hidden">
        <div className="p-3.5 border-b border-gray-100 bg-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Nút mở lại cột Trái nếu đang bị ẩn */}
            {!showLeftPanel && (
              <button 
                onClick={() => setShowLeftPanel(true)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-semibold flex items-center gap-1 shadow-sm transition-colors"
                title="Mở tài liệu"
              >
                📄 Tài liệu ▶
              </button>
            )}
            <h2 className="text-sm font-bold text-gray-800">✨ AI Tutor Chat</h2>
          </div>

          <div className="flex items-center gap-2">
            {currentProject && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-semibold truncate max-w-[180px]">
                Active: {currentProject.name}
              </span>
            )}
            {/* Nút mở lại cột Phải nếu đang bị ẩn */}
            {!showRightPanel && (
              <button 
                onClick={() => setShowRightPanel(true)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-semibold flex items-center gap-1 shadow-sm transition-colors"
                title="Mở ghi chú"
              >
                ◀ 📝 Ghi chú
              </button>
            )}
          </div>
        </div>

        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs min-h-0">
          {loadingHistory ? (
            <div className="text-center text-gray-400 italic py-4">Đang đồng bộ hội thoại...</div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl max-w-[85%] leading-relaxed ${msg.from === 'user' ? 'bg-blue-600 text-white rounded-tr-none shadow-sm' : 'bg-white text-gray-800 border border-gray-200 shadow-sm whitespace-pre-wrap'}`}>
                  {msg.from === 'user' ? msg.text : <ReactMarkdown className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:text-gray-800">{msg.text}</ReactMarkdown>}
                </div>
              </div>
            ))
          )}
          {sendingChat && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-400 border border-gray-200 p-4 rounded-2xl rounded-tl-none text-xs italic shadow-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
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
              placeholder={currentProject ? `Hỏi AI Tutor về các tài liệu đang chọn...` : "Hãy chọn Project để chat..."}
              disabled={!currentProject || sendingChat}
              rows="2"
              className="w-full bg-gray-50 text-xs rounded-xl p-4 pr-12 border border-gray-200 outline-none resize-none focus:border-blue-400 focus:bg-white transition-all disabled:bg-gray-100"
            />
            <button 
              disabled={!currentProject || !chatInput.trim() || sendingChat} 
              onClick={handleSendChat} 
              className="absolute right-3 top-3 w-8 h-8 bg-blue-600 disabled:bg-gray-300 text-white rounded-lg flex items-center justify-center text-sm transition-colors shadow-sm hover:bg-blue-700"
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* THANH KÉO (RESIZER 2: GIỮA & PHẢI) */}
      {showRightPanel && (
        <div 
          onMouseDown={startDraggingRight}
          className="w-1.5 h-full hover:bg-blue-500 cursor-col-resize flex-shrink-0 bg-transparent transition-colors z-20 flex items-center justify-center group"
        >
          <div className="w-0.5 h-6 bg-gray-300 group-hover:bg-blue-600 rounded-full" />
        </div>
      )}

      {/* ========================================================
          PANEL 3: PERSONAL NOTES EDITOR (UC-01 & UC-25)
      ======================================================== */}
      {showRightPanel && (
        <div 
          style={{ width: `${rightWidth}%` }}
          className="h-full bg-white border-l border-gray-100 flex flex-col p-4 space-y-3 flex-shrink-0 min-w-[240px] max-w-[500px]"
        >
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              {/* NÚT THU GỌN CỘT PHẢI */}
              <button 
                onClick={() => setShowRightPanel(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-200 transition-colors text-xs"
                title="Ẩn ghi chú"
              >
                ▶
              </button>
              <h2 className="text-sm font-bold text-gray-800">📝 Personal Notes</h2>
            </div>
            <Link to="/learner/notes" className="text-[10px] font-bold text-blue-600 hover:underline">Quản lý &rarr;</Link>
          </div>
          
          <input 
            type="text" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} 
            placeholder="Tiêu đề ghi chú..." className="w-full text-xs font-bold border border-gray-200 p-3 rounded-xl outline-none focus:border-amber-400 bg-gray-50 focus:bg-white transition-colors" 
          />
          <textarea 
            value={noteContent} onChange={e => setNoteContent(e.target.value)} rows="15" 
            placeholder="Ghi chú nhanh các kiến thức quan trọng..." className="w-full text-xs border border-gray-200 p-3 rounded-xl outline-none resize-none flex-1 focus:border-amber-400 bg-gray-50 focus:bg-white transition-colors leading-relaxed" 
          />
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-gray-400 italic">{noteStatus}</span>
            <button 
              onClick={handleSaveNote} 
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              Lưu Ghi Chú
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          MODALS
      ======================================================== */}
      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Tạo Personal Project</h3>
            <p className="text-xs text-gray-500 mb-5">Gom nhóm tài liệu liên quan vào một không gian độc lập.</p>
            <form onSubmit={handleCreateProject}>
              <input 
                type="text" required value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} 
                placeholder="VD: Luyện thi IELTS..." className="w-full text-sm text-gray-800 border border-gray-200 p-3 rounded-xl mb-6 outline-none focus:border-blue-500" 
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setIsCreatingProject(false); setNewProjectName(''); }} className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Hủy</button>
                <button type="submit" disabled={creating || !newProjectName.trim()} className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">Tạo Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFCModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Tạo Flashcard bằng AI</h3>
            <p className="text-xs text-gray-600 mb-5 leading-relaxed">
              Hệ thống sẽ tổng hợp kiến thức từ <span className="font-bold text-emerald-600">{selectedMaterialIds.length} tài liệu đang Active</span> để trích xuất thẻ học thuật.
            </p>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 mb-2">Số lượng thẻ mục tiêu:</label>
              <input 
                type="number" min="1" max="50" value={flashcardCount} onChange={(e) => setFlashcardCount(Number(e.target.value))}
                className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowFCModal(false)} className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Hủy</button>
              <button type="button" onClick={handleGenerateFlashcards} disabled={generatingFlashcards} className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-sm">
                {generatingFlashcards ? 'Đang phân tích...' : 'Tạo Thẻ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuizModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Tạo Practice Quiz</h3>
            <p className="text-xs text-gray-600 mb-5 leading-relaxed">
              AI Tutor sẽ đọc <span className="font-bold text-blue-600">{selectedMaterialIds.length} tài liệu đang Active</span> để sinh ra bộ câu hỏi trắc nghiệm tự luyện.
            </p>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 mb-2">Số lượng câu hỏi:</label>
              <input 
                type="number" min="1" max="50" value={quizCount} onChange={(e) => setQuizCount(Number(e.target.value))}
                className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowQuizModal(false)} className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Hủy</button>
              <button type="button" onClick={handleGenerateQuiz} disabled={generatingQuiz} className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                {generatingQuiz ? 'Đang tạo đề...' : 'Tạo Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}