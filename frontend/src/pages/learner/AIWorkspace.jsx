// frontend/src/pages/learner/AIWorkspace.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../hooks/useAuth';
import { useStudyTracker } from '../../hooks/useStudyTracker';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import {
  getProjectNotes,
  createNote,
  updateNote,
  deleteNote as deleteNoteApi
} from '../../features/notes/noteApi';
import {
  sendAIChatMessage,
  getAIConversationHistory,
  generateAIQuiz,
  generateAIFlashcards,
  getSavedFlashcards,
  extractDocumentText
} from '../../services/aiService';
import {
  getWorkspaceData,
  uploadProjectMaterial,
  createWorkspaceProject,
  deleteProjectMaterial,
  updateProjectActiveContext
} from '../../services/workspaceService';
import { apiRequest } from '../../services/apiClient';

const LATEX_SYMBOL_REPLACEMENTS = [
  [/\\cup/g, '∪'],
  [/\\cap/g, '∩'],
  [/\\in/g, '∈'],
  [/\\notin/g, '∉'],
  [/\\subseteq/g, '⊆'],
  [/\\subset/g, '⊂'],
  [/\\supseteq/g, '⊇'],
  [/\\supset/g, '⊃'],
  [/\\emptyset/g, '∅'],
  [/\\forall/g, '∀'],
  [/\\exists/g, '∃'],
  [/\\land/g, '∧'],
  [/\\lor/g, '∨'],
  [/\\neg/g, '¬'],
  [/\\leq/g, '≤'],
  [/\\le/g, '≤'],
  [/\\geq/g, '≥'],
  [/\\ge/g, '≥'],
  [/\\neq/g, '≠'],
  [/\\times/g, '×'],
  [/\\cdot/g, '·'],
  [/\\leftrightarrow/g, '↔'],
  [/\\rightarrow/g, '→'],
  [/\\to/g, '→'],
  [/\\leftarrow/g, '←'],
  [/\\infty/g, '∞']
];

function convertLatexExpressionToSymbols(expression) {
  let result = String(expression || '');

  LATEX_SYMBOL_REPLACEMENTS.forEach(([pattern, symbol]) => {
    result = result.replace(pattern, symbol);
  });

  return result
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .trim();
}

function renderInlineLatexSymbols(text) {
  if (!text) return text;

  return String(text)
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, expression) =>
      convertLatexExpressionToSymbols(expression)
    )
    .replace(/\$([^$\n]+)\$/g, (_, expression) =>
      convertLatexExpressionToSymbols(expression)
    );
}

export default function AIWorkspace() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetCourseId = searchParams.get('courseId');
  const targetSourceUrl = searchParams.get('sourceUrl');
  const targetTitle = searchParams.get('title');

  // ========================================================
  // 3-PANEL STATE & SIZE CONTROLS (UC-01)
  // ========================================================
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [leftWidth, setLeftWidth] = useState(25);
  const [rightWidth, setRightWidth] = useState(25);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);
  const workspaceContainerRef = useRef(null);

  const [workspace, setWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hasNoWorkspace, setHasNoWorkspace] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Project modals (Create, Rename)
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Notes state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStatus, setNoteStatus] = useState('');
  const [projectNotes, setProjectNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // AI Chat state
  const [chatInput, setChatInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [chatHistory, setChatHistory] = useState([
    { from: 'ai', text: 'Hello! I am your AI Tutor. Select materials as context to start learning.' }
  ]);
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const [flashcardCount, setFlashcardCount] = useState(10);
  const [flashcardMaterialIds, setFlashcardMaterialIds] = useState([]);
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [flashcardSets, setFlashcardSets] = useState([]);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [showFCModal, setShowFCModal] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);

  const classProjects = projects.filter((p) => p.type === 'CLASS');
  const personalProjects = projects.filter((p) => p.type !== 'CLASS');
  const currentProjectId = currentProject?.projectId || currentProject?.id;
  const isArchivedClassProject = Boolean(
    currentProject?.type === 'CLASS' &&
    (currentProject?.status === 'ARCHIVED' || currentProject?.courseStatus === 'ARCHIVED')
  );

  const getInitialMaterialSelection = (project) => {
    const projectMaterials = project?.Learning_Material || project?.materials || [];

    return projectMaterials
      .filter((material) => material.selectedAsContext === true)
      .map((material) => material.materialId || material.id)
      .filter(Boolean);
  };

  const blockArchivedProjectAction = () => {
    if (!isArchivedClassProject) return false;
    showToast('This Class Project is archived. You can view its learning history, but AI features are disabled.', 'warning');
    return true;
  };

  // UC03: tracking is active only while a concrete AI Project is selected.
  useStudyTracker(currentProjectId, Boolean(currentProjectId));

  const isUserMessage = (msg) => {
    const role = String(
      msg.senderRole || 
      msg.sender_role || 
      msg.role || 
      msg.sender || 
      msg.from || 
      ''
    ).trim().toUpperCase();

    return (
      role === 'USER' || 
      role === 'LEARNER' || 
      role === 'STUDENT' || 
      role === 'HUMAN' ||
      msg.isUser === true ||
      msg.from === 'user'
    );
  };

  // ========================================================
  // CHAT HISTORY (Preserve order & align messages correctly)
  // ========================================================
  useEffect(() => {
    if (!currentProjectId) return;
    
    let isMounted = true;
    const defaultWelcome = {
      from: 'ai',
      text: `Hello! You are in the "${currentProject?.name || 'Project'}" learning space. Ask the AI Tutor questions based on the selected materials!`
    };

    const fetchChatHistory = async () => {
      try {
        setLoadingHistory(true);
        const listRes = await getAIConversationHistory(currentProjectId);
        const conversations = Array.isArray(listRes?.data) ? listRes.data : [];
        
        if (conversations.length === 0) {
          if (isMounted) {
            setConversationId(null);
            setChatHistory([defaultWelcome]);
          }
          return;
        }

        const latestConversationId = conversations[0]?.conversationId;
        if (!latestConversationId) {
          if (isMounted) {
            setConversationId(null);
            setChatHistory([defaultWelcome]);
          }
          return;
        }

        const detailRes = await getAIConversationHistory(currentProjectId, latestConversationId);
        const conversation = detailRes?.data;
        const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];

        if (isMounted) {
          setConversationId(conversation?.conversationId || latestConversationId);
          
          if (messages.length > 0) {
            const mappedHistory = messages.map((msg) => ({
              from: isUserMessage(msg) ? 'user' : 'ai',
              text: msg.content || msg.message || msg.text || ''
            }));
            setChatHistory([defaultWelcome, ...mappedHistory]);
          } else {
            setChatHistory([defaultWelcome]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setConversationId(null);
          setChatHistory([defaultWelcome]);
        }
      } finally {
        if (isMounted) {
          setLoadingHistory(false);
          setTimeout(() => {
            if (chatScrollRef.current) {
              chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
          }, 100);
        }
      }
    };

    fetchChatHistory();
    return () => { isMounted = false; };
  }, [currentProjectId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatHistory, sendingChat]);

  // ========================================================
  // UC-23: PERSONAL NOTES FOR THE ACTIVE PROJECT
  // ========================================================
  useEffect(() => {
    let cancelled = false;

    const loadProjectNotes = async () => {
      setActiveNoteId(null);
      setNoteTitle('');
      setNoteContent('');
      setNoteStatus('');

      if (!currentProjectId) {
        setProjectNotes([]);
        return;
      }

      try {
        setLoadingNotes(true);
        const result = await getProjectNotes(currentProjectId);
        if (cancelled) return;

        const notes = Array.isArray(result)
          ? result
          : Array.isArray(result?.notes)
          ? result.notes
          : [];

        const sorted = [...notes].sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });

        setProjectNotes(sorted);
      } catch (error) {
        if (!cancelled) {
          setProjectNotes([]);
          showToast(error.message || 'Unable to load Personal Notes.', 'error');
        }
      } finally {
        if (!cancelled) setLoadingNotes(false);
      }
    };

    loadProjectNotes();
    return () => {
      cancelled = true;
    };
  }, [currentProjectId]);

  // ========================================================
  // RESIZE PANEL CONTROLLERS
  // ========================================================
  useEffect(() => {
    // Keep every workspace feature usable while the user resizes the panels.
    // Percent-only minimums allowed Documents to become too narrow on smaller
    // workspaces, which caused its controls to wrap, clip, or appear missing.
    const MIN_LEFT_PX = 260;
    const MIN_RIGHT_PX = 230;
    const MIN_CENTER_PX = 360;
    const MAX_SIDE_WIDTH = 45;

    const getPanelLimits = (containerWidth) => {
      const minLeft = Math.min(
        30,
        Math.max(15, (MIN_LEFT_PX / containerWidth) * 100)
      );
      const minRight = Math.min(
        28,
        Math.max(15, (MIN_RIGHT_PX / containerWidth) * 100)
      );
      const minCenter = Math.min(
        40,
        Math.max(25, (MIN_CENTER_PX / containerWidth) * 100)
      );

      return { minLeft, minRight, minCenter };
    };

    const normalizePanelWidths = () => {
      const container = workspaceContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;

      const { minLeft, minRight, minCenter } = getPanelLimits(rect.width);

      setLeftWidth((currentLeft) => {
        if (!showLeftPanel) return currentLeft;
        const effectiveRight = showRightPanel
          ? Math.max(rightWidth, minRight)
          : 0;
        const maxLeft = Math.min(
          MAX_SIDE_WIDTH,
          100 - minCenter - effectiveRight
        );
        return Math.max(minLeft, Math.min(currentLeft, maxLeft));
      });

      setRightWidth((currentRight) => {
        if (!showRightPanel) return currentRight;
        const effectiveLeft = showLeftPanel
          ? Math.max(leftWidth, minLeft)
          : 0;
        const maxRight = Math.min(
          MAX_SIDE_WIDTH,
          100 - minCenter - effectiveLeft
        );
        return Math.max(minRight, Math.min(currentRight, maxRight));
      });
    };

    const handleMouseMove = (e) => {
      const container = workspaceContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;

      const { minLeft, minRight, minCenter } = getPanelLimits(rect.width);

      if (isDraggingLeft.current) {
        const requestedWidth = ((e.clientX - rect.left) / rect.width) * 100;
        const otherPanelWidth = showRightPanel
          ? Math.max(rightWidth, minRight)
          : 0;
        const maxAllowed = Math.min(
          MAX_SIDE_WIDTH,
          100 - minCenter - otherPanelWidth
        );
        setLeftWidth(Math.max(minLeft, Math.min(requestedWidth, maxAllowed)));
      }

      if (isDraggingRight.current) {
        const requestedWidth = ((rect.right - e.clientX) / rect.width) * 100;
        const otherPanelWidth = showLeftPanel
          ? Math.max(leftWidth, minLeft)
          : 0;
        const maxAllowed = Math.min(
          MAX_SIDE_WIDTH,
          100 - minCenter - otherPanelWidth
        );
        setRightWidth(Math.max(minRight, Math.min(requestedWidth, maxAllowed)));
      }
    };

    const handleMouseUp = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    normalizePanelWidths();
    window.addEventListener('resize', normalizePanelWidths);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('resize', normalizePanelWidths);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [leftWidth, rightWidth, showLeftPanel, showRightPanel]);

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

  // ========================================================
  // LOAD WORKSPACE & PERSIST CONTEXT (UC-01 & UC-16)
  // ========================================================
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
        let activeProj = projectList[0];
        const targetId = preservedProjectId || currentProject?.projectId || currentProject?.id;
        if (targetId) {
          activeProj = projectList.find(p => (p.projectId === targetId || p.id === targetId)) || projectList[0];
        } else if (targetCourseId) {
          const matched = projectList.find(p => String(p.courseId) === String(targetCourseId));
          if (matched) activeProj = matched;
        }

        setCurrentProject(activeProj);
        const projMaterials = activeProj.Learning_Material || activeProj.materials || [];
        setMaterials(projMaterials);

        // UC16-UI06: Match the material passed from CourseMaterials
        if (targetSourceUrl || targetTitle) {
          const targetMat = projMaterials.find(
            (m) =>
              (targetSourceUrl && m.sourceUrl === targetSourceUrl) ||
              (targetTitle && m.title === targetTitle)
          );
          if (targetMat) {
            const activeId = targetMat.materialId || targetMat.id;
            setSelectedMaterialIds([activeId]);
            if (!(activeProj.type === 'CLASS' && (activeProj.status === 'ARCHIVED' || activeProj.courseStatus === 'ARCHIVED'))) {
              await updateProjectActiveContext(activeProj.projectId || activeProj.id, [activeId]).catch(() => {});
            }
            return;
          }
        }

        // UC01-UI09: Read the saved Active Context state accurately.
        // Do not automatically select all materials when the saved list is empty.
        const savedActiveIds = projMaterials
          .filter((m) => m.selectedAsContext === true)
          .map((m) => m.materialId || m.id)
          .filter(Boolean);

        setSelectedMaterialIds(savedActiveIds);
      } else {
        setCurrentProject(null);
        setMaterials([]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load the Workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [targetCourseId, targetSourceUrl, targetTitle]);

  // UC01-UI09: Persist Active Context to the DB when checking/unchecking
  const toggleMaterialSelection = async (materialId) => {
    if (blockArchivedProjectAction()) return;

    const previousSelected = selectedMaterialIds;
    const nextSelected = selectedMaterialIds.includes(materialId)
      ? selectedMaterialIds.filter((id) => id !== materialId)
      : [...selectedMaterialIds, materialId];

    setSelectedMaterialIds(nextSelected);

    const projId = currentProject?.projectId || currentProject?.id;
    if (!projId) return;

    try {
      await updateProjectActiveContext(projId, nextSelected);

      // Keep the local project/material cache consistent with the persisted DB state.
      // Otherwise reopening the selector in the same page session reads stale values.
      const selectedSet = new Set(nextSelected.map((id) => String(id)));
      const applySelection = (items = []) =>
        items.map((material) => {
          const id = material.materialId || material.id;
          return {
            ...material,
            selectedAsContext: Boolean(id) && selectedSet.has(String(id))
          };
        });

      setMaterials((prev) => applySelection(prev));

      setCurrentProject((prev) => {
        if (!prev || String(prev.projectId || prev.id) !== String(projId)) return prev;

        const updated = { ...prev };
        if (Array.isArray(prev.Learning_Material)) {
          updated.Learning_Material = applySelection(prev.Learning_Material);
        }
        if (Array.isArray(prev.materials)) {
          updated.materials = applySelection(prev.materials);
        }
        return updated;
      });

      setProjects((prev) =>
        prev.map((project) => {
          if (String(project.projectId || project.id) !== String(projId)) {
            return project;
          }

          const updated = { ...project };
          if (Array.isArray(project.Learning_Material)) {
            updated.Learning_Material = applySelection(project.Learning_Material);
          }
          if (Array.isArray(project.materials)) {
            updated.materials = applySelection(project.materials);
          }
          return updated;
        })
      );
    } catch (e) {
      // Do not leave the UI showing a selection that failed to save.
      setSelectedMaterialIds(previousSelected);
      console.error('Failed to persist active context:', e);
    }
  };

  useEffect(() => {
    const fetchFlashcards = async () => {
      const projId = currentProject?.projectId || currentProject?.id;
      if (!projId) return;
      try {
        const res = await getSavedFlashcards(projId);
        setFlashcardSets(res.data || []);
      } catch (err) {
        console.error('Flashcards error:', err);
      }
    };
    fetchFlashcards();
  }, [currentProjectId]);

  // ========================================================
  // PROJECT CRUD HANDLERS (UC-01)
  // ========================================================

  // UC01-UI02 & UC01-UI03: Create Project
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const wsId = workspace?.workspaceId || workspace?.id;
    if (!wsId) return showToast('Unable to find the workspace ID.', 'error');

    try {
      setCreating(true);
      await createWorkspaceProject(newProjectName, wsId);
      showToast('Personal Project created successfully!', 'success');
      setNewProjectName('');
      setIsCreatingProject(false);
      await fetchWorkspace();
    } catch (err) {
      if (err.statusCode === 409 || err.code === 'PROJECT_NAME_EXISTS') {
        showToast('Project name already exists. Please choose another name.', 'error');
      } else {
        showToast(err.message || 'Unable to create the Personal Project.', 'error');
      }
    } finally {
      setCreating(false);
    }
  };

  // UC01-UI04 & UC01-UI05: Rename Project
  const handleOpenRename = () => {
    if (!currentProject || currentProject.type === 'CLASS') return;
    setRenameValue(currentProject.name || '');
    setIsRenamingProject(true);
  };

  const handleConfirmRename = async (e) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed || !currentProject) return;

    try {
      setRenaming(true);
      await apiRequest(`/workspace/projects/${currentProjectId}/rename`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed })
      });
      showToast('Project renamed successfully!', 'success');
      setIsRenamingProject(false);
      await fetchWorkspace(currentProjectId);
    } catch (err) {
      if (err.statusCode === 409 || err.code === 'PROJECT_NAME_EXISTS') {
        showToast('Project name already exists. Please choose another name.', 'error');
      } else {
        showToast(err.message || 'Unable to rename the Project.', 'error');
      }
    } finally {
      setRenaming(false);
    }
  };

  // UC01-UI06 & UC01-UI07: Delete Personal Project with Exact Warning
  const handleDeleteProject = async () => {
    if (!currentProject || currentProject.type === 'CLASS') return;

    const isConfirmed = await confirm({
      title: 'Delete Personal Project',
      message: 'All materials and chat history in this project will be permanently deleted.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await apiRequest(`/workspace/projects/${currentProjectId}`, { method: 'DELETE' });
      showToast('Project deleted successfully!', 'success');
      await fetchWorkspace();
    } catch (error) {
      showToast(error.message || 'Unable to delete the Project.', 'error');
    }
  };

  // UC01-UI10 -> UC01-UI14: Upload Material with Exact Validation
  const handleFileUpload = async (event) => {
    if (blockArchivedProjectAction()) {
      if (fileInputRef.current) fileInputRef.current.value = null;
      return;
    }

    const files = Array.from(event.target.files || []);
    if (!files.length || !currentProject) return;
    const projectId = currentProject.projectId || currentProject.id;

    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      // UC01-UI12: File format validation
      if (!['pdf', 'docx'].includes(ext)) {
        showToast('File format not supported.', 'error');
        if (fileInputRef.current) fileInputRef.current.value = null;
        return;
      }
      // UC01-UI13: File size limit 50MB
      if (file.size > 50 * 1024 * 1024) {
        showToast('File exceeds size limit.', 'error');
        if (fileInputRef.current) fileInputRef.current.value = null;
        return;
      }
    }

    try {
      setUploading(true);
      for (const file of files) {
        const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
        const safeFile = new File([file], safeName, { type: file.type });
        showToast(`Uploading: ${file.name}...`, 'info');
        const uploadRes = await uploadProjectMaterial(projectId, safeFile);
        const materialId = uploadRes?.materialId || uploadRes?.data?.materialId || uploadRes?.id;
        if (materialId) {
          showToast(`AI is extracting: ${file.name}...`, 'info');
          await extractDocumentText(materialId, safeFile);
        }
      }
      showToast('Upload and extraction completed successfully!', 'success');
      await fetchWorkspace(projectId);
    } catch (err) {
      if (err.statusCode === 403 || err.code === 'STORAGE_LIMIT_EXCEEDED') {
        showToast('Storage capacity is full. Please delete old materials to continue.', 'error');
      } else {
        showToast(err.message || 'Failed to upload the material.', 'error');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleDeleteMaterial = async (materialId, materialName) => {
    if (blockArchivedProjectAction()) return;

    const isConfirmed = await confirm({
      title: 'Delete Material',
      message: `Are you sure you want to remove "${materialName}" from this Project?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!isConfirmed) return;
    const projectId = currentProject.projectId || currentProject.id;
    try {
      await deleteProjectMaterial(projectId, materialId);
      showToast('Material deleted successfully!', 'success');
      await fetchWorkspace(projectId);
    } catch (error) {
      showToast(error.message || 'Failed to delete the material.', 'error');
    }
  };

  // UC-02: AI Tutor Chat
  const handleSendChat = async () => {
    if (blockArchivedProjectAction()) return;
    if (!chatInput.trim() || sendingChat) return;
    const projId = currentProject?.projectId || currentProject?.id;

    if (!projId) {
      return showToast('Please select or create a Project before chatting!', 'warning');
    }
    // UC01-UI15: Require at least one material
    if (selectedMaterialIds.length === 0) {
      return showToast('Please select at least one material to provide context for the AI!', 'warning');
    }

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory((prev) => [...prev, { from: 'user', text: userMsg }]);

    try {
      setSendingChat(true);
      const response = await sendAIChatMessage(
        projId,
        selectedMaterialIds,
        conversationId,
        userMsg
      );
      if (response?.data?.conversationId) {
        setConversationId(response.data.conversationId);
      }
      setChatHistory((prev) => [
        ...prev,
        {
          from: 'ai',
          text: response?.data?.reply || 'No response received.'
        }
      ]);
    } catch (err) {
      const errMsg = err.status === 408 || err.code === 'ECONNABORTED'
        ? 'Connection to AI Tutor interrupted. Please try again.'
        : `AI error: ${err.message || 'Unable to connect.'}`;
      setChatHistory((prev) => [...prev, { from: 'ai', text: errMsg }]);
    } finally {
      setSendingChat(false);
    }
  };

  // UC-23: Manage Personal Notes
  const handleCreateNewNote = () => {
    if (blockArchivedProjectAction()) return;
    setActiveNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteStatus('');
  };

  const handleOpenNote = (note) => {
    setActiveNoteId(note.noteId || note.id);
    setNoteTitle(note.title || '');
    setNoteContent(note.content || '');
    setNoteStatus('');
  };

  const handleSaveNote = async () => {
    if (blockArchivedProjectAction()) return;
    if (!noteContent.trim()) {
      showToast('Note content cannot be empty', 'warning');
      return;
    }

    const projectId = currentProject?.projectId || currentProject?.id;
    if (!projectId) {
      showToast('Please select an AI Project before saving.', 'warning');
      return;
    }

    try {
      setSavingNote(true);
      setNoteStatus('Saving...');

      const payload = {
        title: noteTitle.trim() || 'Untitled Note',
        content: noteContent
      };

      const result = activeNoteId
        ? await updateNote(activeNoteId, payload)
        : await createNote(projectId, payload);

      const savedNote = result?.note || result;
      const savedId = savedNote?.noteId || savedNote?.id;

      if (activeNoteId) {
        setProjectNotes((previous) =>
          previous.map((note) =>
            String(note.noteId || note.id) === String(activeNoteId)
              ? { ...note, ...savedNote }
              : note
          )
        );
      } else if (savedNote) {
        setProjectNotes((previous) => [savedNote, ...previous]);
      }

      if (savedId) setActiveNoteId(savedId);
      setNoteTitle(savedNote?.title || payload.title);
      setNoteContent(savedNote?.content ?? payload.content);
      setNoteStatus('Saved');
      showToast('Note saved successfully!', 'success');
    } catch (error) {
      setNoteStatus('Save failed');
      showToast(error.message || 'Unable to save note.', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async () => {
    if (blockArchivedProjectAction()) return;
    if (!activeNoteId) return;

    const confirmed = await confirm({
      title: 'Delete Personal Note',
      message: 'Delete this note permanently?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });

    if (!confirmed) return;

    try {
      setNoteStatus('Deleting...');
      await deleteNoteApi(activeNoteId);
      setProjectNotes((previous) =>
        previous.filter(
          (note) => String(note.noteId || note.id) !== String(activeNoteId)
        )
      );
      handleCreateNewNote();
      showToast('Note deleted successfully!', 'success');
    } catch (error) {
      setNoteStatus('Delete failed');
      showToast(error.message || 'Unable to delete note.', 'error');
    }
  };

  // AI Generators (UC-06 & UC-07)
  const handleOpenFlashcardModal = () => {
    if (blockArchivedProjectAction()) return;

    // Start from the current Active Context for convenience, but keep the
    // Flashcard source selection independent from Active Context.
    const availableIds = new Set(
      materials
        .map((material) => material.materialId || material.id)
        .filter(Boolean)
        .map((id) => String(id))
    );

    const initialIds = selectedMaterialIds.filter((id) =>
      availableIds.has(String(id))
    );

    setFlashcardMaterialIds(initialIds);
    setShowFCModal(true);
  };

  const toggleFlashcardMaterial = (materialId) => {
    setFlashcardMaterialIds((previous) =>
      previous.some((id) => String(id) === String(materialId))
        ? previous.filter((id) => String(id) !== String(materialId))
        : [...previous, materialId]
    );
  };

  const handleGenerateFlashcards = async (e) => {
    e?.preventDefault();
    if (blockArchivedProjectAction()) return;
    if (!currentProject) return showToast('Please select a Project!', 'warning');
    if (flashcardMaterialIds.length === 0) {
      return showToast('Please select at least one source material for Flashcards.', 'warning');
    }

    const projectId = currentProject.projectId || currentProject.id;
    try {
      setGeneratingFlashcards(true);
      const res = await generateAIFlashcards(projectId, flashcardMaterialIds, flashcardCount, 'short');
      showToast('Flashcards generated successfully!', 'success');
      setShowFCModal(false);
      if (res?.flashcardSetId || res?.data?.flashcardSetId) {
        const setId = res.flashcardSetId || res.data.flashcardSetId;
        navigate(`/learner/flashcards/study?projectId=${projectId}&setId=${setId}&name=Generated+Flashcards`);
      }
    } catch (err) {
      showToast(err.message || 'Failed to generate Flashcards.', 'error');
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  const handleGenerateQuiz = async (e) => {
    e?.preventDefault();
    if (blockArchivedProjectAction()) return;
    if (!currentProject) return showToast('Please select a Project!', 'warning');
    if (selectedMaterialIds.length === 0) return showToast('Please select at least one material!', 'warning');

    const projectId = currentProject.projectId || currentProject.id;
    try {
      setGeneratingQuiz(true);
      const res = await generateAIQuiz(projectId, selectedMaterialIds, quizCount, quizDifficulty);
      showToast('Practice Quiz generated successfully!', 'success');
      setShowQuizModal(false);
      if (res?.quizId || res?.data?.quizId) {
        const quizId = res.quizId || res.data.quizId;
        navigate(`/learner/ai-quizzes/study?projectId=${projectId}&quizId=${quizId}&name=Generated+Quiz`);
      }
    } catch (err) {
      showToast(err.message || 'Failed to generate the Quiz.', 'error');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  if (loading && !workspace) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <p className="text-sm font-bold text-gray-500">Loading AI Workspace...</p>
      </div>
    );
  }

  if (hasNoWorkspace) {
    return (
      <main className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm text-center">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Workspace Not Found</h2>
          <p className="text-sm text-gray-500 mb-4">The system could not find your learning workspace.</p>
          <button onClick={() => fetchWorkspace()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            Reload
          </button>
        </div>
      </main>
    );
  }

  return (
    <main ref={workspaceContainerRef} className="flex-1 flex overflow-hidden bg-white relative w-full h-full min-w-0">
      {/* PANEL 1: DOCUMENT VIEWER & CONTEXT SELECTION (UC-01) */}
      {showLeftPanel && (
        <div
          style={{ width: `${leftWidth}%` }}
          className="h-full bg-white border-r border-gray-100 flex flex-col flex-shrink-0 min-w-0 max-w-[500px] overflow-hidden"
        >
          <div className="p-4 border-b border-gray-100 flex flex-col gap-3 flex-shrink-0 bg-gray-50/50">
            <div className="flex justify-between items-center gap-2 mb-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <h2 className="text-sm font-bold text-gray-800 whitespace-nowrap">📄 Documents</h2>
                <button
                  onClick={() => setShowLeftPanel(false)}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-200 transition-colors text-xs"
                  title="Hide documents"
                >
                  ◀
                </button>
              </div>
              <button
                onClick={() => setIsCreatingProject(true)}
                className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1.5 rounded font-bold transition-colors whitespace-nowrap flex-shrink-0"
              >
                + New Project
              </button>
            </div>

            {/* UC01-UI01: Categorized Projects Select */}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <select
                value={currentProject?.projectId || currentProject?.id || ''}
                onChange={(e) => {
                  const proj = projects.find((p) => String(p.projectId || p.id) === String(e.target.value));
                  const projectMaterials = proj?.Learning_Material || proj?.materials || [];
                  setCurrentProject(proj || null);
                  setMaterials(projectMaterials);
                  // Important: never carry material IDs from the previously opened Project.
                  setSelectedMaterialIds(getInitialMaterialSelection(proj));
                  setShowQuizModal(false);
                  setShowFCModal(false);
                }}
                className="flex-1 min-w-0 text-xs font-bold text-gray-800 bg-white border border-gray-200 p-2 rounded-lg outline-none cursor-pointer focus:border-blue-500 shadow-sm truncate"
              >
                <option value="" disabled>Select a Project</option>
                {classProjects.length > 0 && (
                  <optgroup label="🏫 Class Projects">
                    {classProjects.map((p) => (
                      <option key={p.projectId || p.id} value={p.projectId || p.id}>
                        {p.name}{(p.status === 'ARCHIVED' || p.courseStatus === 'ARCHIVED') ? ' (Archived)' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {personalProjects.length > 0 && (
                  <optgroup label="📁 Personal Projects">
                    {personalProjects.map((p) => (
                      <option key={p.projectId || p.id} value={p.projectId || p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {currentProject && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentProject(null);
                    setMaterials([]);
                    setSelectedMaterialIds([]);
                  }}
                  className="p-1.5 flex-shrink-0 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                  title="Close active Project"
                  aria-label="Close active Project"
                >
                  ✕
                </button>
              )}

              {currentProject && currentProject.type !== 'CLASS' && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={handleOpenRename} className="p-1.5 flex-shrink-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Rename Project">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={handleDeleteProject} className="p-1.5 flex-shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete Project">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )}
            </div>

            {isArchivedClassProject && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold leading-relaxed text-amber-800">
                🔒 Archived Class Project — history is read-only. You can view materials, chat, quizzes, flashcards and notes, but AI and editing features are disabled.
              </div>
            )}

            <div>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.docx"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !currentProject || isArchivedClassProject}
                className={`w-full text-xs py-2 rounded-lg font-bold transition-colors shadow-sm border ${
                  currentProject && !isArchivedClassProject
                    ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                    : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed'
                }`}
              >
                {uploading ? 'Uploading...' : '📁 Upload Materials'}
              </button>
            </div>
          </div>

          {/* ACTIVE CONTEXT SELECTION (UC01-UI09) */}
          <div className="flex-1 overflow-y-auto p-4 text-xs text-gray-600 leading-relaxed space-y-2.5 bg-white">
            {errorMsg ? (
              <p className="text-center text-red-500 mt-10">{errorMsg}</p>
            ) : !currentProject ? (
              <div className="text-center mt-10">
                <p className="text-gray-400 mb-2">Create a Personal Project or select a Class Project to get started.</p>
              </div>
            ) : materials.length > 0 ? (
              <>
                <p className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wide">
                  Active Context ({selectedMaterialIds.length}/{materials.length})
                </p>
                {materials.map((mat, idx) => {
                  const matId = mat.materialId || mat.id;
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 relative group transition-colors ${
                        selectedMaterialIds.includes(matId)
                          ? 'bg-blue-50/30 border-blue-200'
                          : 'bg-white border-gray-100 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 cursor-pointer w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                        checked={selectedMaterialIds.includes(matId)}
                        disabled={isArchivedClassProject}
                        onChange={() => toggleMaterialSelection(matId)}
                      />
                      <div className="flex-1 flex flex-col gap-1 min-w-0 pr-5">
                        <p
                          className={`font-bold line-clamp-2 leading-tight break-words text-xs ${
                            selectedMaterialIds.includes(matId) ? 'text-gray-800' : 'text-gray-500'
                          }`}
                        >
                          {mat.title}
                        </p>
                        <div className="flex items-center mt-1">
                          <span className="text-[8px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded uppercase font-semibold">
                            {mat.fileType || 'Doc'}
                          </span>
                          <a
                            href={mat.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline text-[9px] font-semibold ml-auto"
                          >
                            View &rarr;
                          </a>
                        </div>
                      </div>
                      {!isArchivedClassProject && (
                        <button
                          onClick={() => handleDeleteMaterial(matId, mat.title)}
                          className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="text-center mt-10">
                <p className="text-gray-400 mb-2">No context materials available.</p>
              </div>
            )}
          </div>

          {/* AI GENERATORS */}
          <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex-shrink-0 grid grid-cols-2 gap-2">
            <button
              onClick={handleOpenFlashcardModal}
              disabled={generatingFlashcards || !currentProject || materials.length === 0 || isArchivedClassProject}
              className="flex items-center justify-center gap-1.5 p-2 bg-white border border-gray-200 rounded-lg hover:border-emerald-400 hover:shadow-sm transition-all disabled:opacity-50"
            >
              <span className="text-xs">🗂️</span>
              <span className="text-[10px] font-bold text-gray-700">Generate Flashcards</span>
            </button>
            <button
              onClick={() => setShowQuizModal(true)}
              disabled={generatingQuiz || !currentProject || materials.length === 0 || isArchivedClassProject}
              className="flex items-center justify-center gap-1.5 p-2 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all disabled:opacity-50"
            >
              <span className="text-xs">📝</span>
              <span className="text-[10px] font-bold text-gray-700">Quiz</span>
            </button>
          </div>
        </div>
      )}

      {showLeftPanel && (
        <div
          onMouseDown={startDraggingLeft}
          className="w-1.5 h-full hover:bg-blue-500 cursor-col-resize flex-shrink-0 bg-transparent transition-colors z-20 flex items-center justify-center group"
        >
          <div className="w-0.5 h-6 bg-gray-300 group-hover:bg-blue-600 rounded-full" />
        </div>
      )}

      {/* PANEL 2: AI TUTOR CHAT (UC-01 & UC-02) */}
      <div className="flex-1 h-full flex flex-col bg-gray-50/30 min-w-0 overflow-hidden">
        <div className="p-3.5 border-b border-gray-100 bg-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            {!showLeftPanel && (
              <button
                onClick={() => setShowLeftPanel(true)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-semibold flex items-center gap-1 shadow-sm transition-colors"
                title="Open documents"
              >
                ▶ Documents
              </button>
            )}
            <h2 className="text-sm font-bold text-gray-800">💬 AI Tutor Chat</h2>
          </div>
          <div className="flex items-center gap-2">
            {currentProject && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-semibold truncate max-w-[180px]">
                Active: {currentProject.name}
              </span>
            )}
            {!showRightPanel && (
              <button
                onClick={() => setShowRightPanel(true)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-semibold flex items-center gap-1 shadow-sm transition-colors"
                title="Open notes"
              >
                📝 Personal Notes
              </button>
            )}
          </div>
        </div>

        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs min-h-0">
          {loadingHistory ? (
            <div className="text-center text-gray-400 italic py-4">Syncing conversation...</div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`p-4 rounded-2xl max-w-[85%] leading-relaxed ${
                    msg.from === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm whitespace-pre-wrap'
                  }`}
                >
                  {msg.from === 'user' ? (
                    msg.text
                  ) : (
                    <ReactMarkdown className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:text-gray-800">
                      {renderInlineLatexSymbols(msg.text)}
                    </ReactMarkdown>
                  )}
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
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())}
              placeholder={isArchivedClassProject ? 'Archived Class Project — AI Tutor is disabled.' : (currentProject ? 'Ask the AI Tutor about the selected materials...' : 'Select a Project to start chatting...')}
              disabled={!currentProject || sendingChat || isArchivedClassProject}
              rows="2"
              className="w-full bg-gray-50 text-xs rounded-xl p-4 pr-12 border border-gray-200 outline-none resize-none focus:border-blue-400 focus:bg-white transition-all disabled:bg-gray-100"
            />
            <button
              disabled={!currentProject || !chatInput.trim() || sendingChat || isArchivedClassProject}
              onClick={handleSendChat}
              className="absolute right-3 top-3 w-8 h-8 bg-blue-600 disabled:bg-gray-300 text-white rounded-lg flex items-center justify-center text-sm transition-colors shadow-sm hover:bg-blue-700"
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      {showRightPanel && (
        <div
          onMouseDown={startDraggingRight}
          className="w-1.5 h-full hover:bg-blue-500 cursor-col-resize flex-shrink-0 bg-transparent transition-colors z-20 flex items-center justify-center group"
        >
          <div className="w-0.5 h-6 bg-gray-300 group-hover:bg-blue-600 rounded-full" />
        </div>
      )}

      {/* PANEL 3: PERSONAL NOTES EDITOR (UC-01 & UC-23) */}
      {showRightPanel && (
        <div
          style={{ width: `${rightWidth}%` }}
          className="h-full bg-white border-l border-gray-100 flex flex-col p-4 gap-3 flex-shrink-0 min-w-0 max-w-[500px] overflow-hidden"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRightPanel(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-200 transition-colors text-xs"
                title="Hide Personal Notes"
              >
                ▶
              </button>
              <h2 className="text-sm font-bold text-gray-800">📝 Personal Notes</h2>
            </div>
            <Link to="/learner/notes" className="text-[10px] font-bold text-blue-600 hover:underline">
              Manage all →
            </Link>
          </div>

          <button
            type="button"
            onClick={handleCreateNewNote}
            disabled={!currentProjectId || isArchivedClassProject}
            className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Create new note
          </button>

          <div className="max-h-28 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-1.5">
            {loadingNotes ? (
              <p className="px-2 py-3 text-center text-[10px] text-gray-400">Loading notes...</p>
            ) : projectNotes.length === 0 ? (
              <p className="px-2 py-3 text-center text-[10px] text-gray-400">No saved notes in this Project.</p>
            ) : (
              <div className="space-y-1">
                {projectNotes.map((note) => {
                  const noteId = note.noteId || note.id;
                  const isActive = String(noteId) === String(activeNoteId);
                  return (
                    <button
                      key={noteId}
                      type="button"
                      onClick={() => handleOpenNote(note)}
                      className={`w-full rounded-lg px-2.5 py-2 text-left text-[10px] transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="block truncate font-bold">{note.title || 'Untitled Note'}</span>
                      <span className={`mt-0.5 block truncate ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                        {String(note.content || '').replace(/<[^>]+>/g, ' ').trim() || 'No content'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            disabled={!currentProjectId || isArchivedClassProject}
            placeholder="Note title..."
            className="w-full text-xs font-bold border border-gray-200 p-3 rounded-xl outline-none focus:border-amber-400 bg-gray-50 focus:bg-white transition-colors disabled:opacity-50"
          />
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            disabled={!currentProjectId || isArchivedClassProject}
            rows="12"
            placeholder="Type a note or paste copied AI Tutor content here..."
            className="w-full text-xs border border-gray-200 p-3 rounded-xl outline-none resize-none flex-1 focus:border-amber-400 bg-gray-50 focus:bg-white transition-colors leading-relaxed disabled:opacity-50"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[10px] text-gray-400 italic">{noteStatus}</span>
            <div className="flex items-center gap-2">
              {activeNoteId && (
                <button
                  type="button"
                  onClick={handleDeleteNote}
                  disabled={savingNote || isArchivedClassProject}
                  className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={!currentProjectId || savingNote || isArchivedClassProject}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors"
              >
                {savingNote ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREATE PROJECT */}
      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Create Personal Project</h3>
            <p className="text-xs text-gray-500 mb-5">Group related learning materials into your own study space.</p>
            <form onSubmit={handleCreateProject}>
              <input
                type="text"
                required
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. IELTS Preparation..."
                className="w-full text-sm text-gray-800 border border-gray-200 p-3 rounded-xl mb-6 outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingProject(false);
                    setNewProjectName('');
                  }}
                  className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProjectName.trim()}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RENAME PROJECT (UC01-UI04 & UC01-UI05) */}
      {isRenamingProject && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Rename Project</h3>
            <p className="text-xs text-gray-500 mb-5">Enter a new name for your Personal Project.</p>
            <form onSubmit={handleConfirmRename}>
              <input
                type="text"
                required
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter a new name..."
                className="w-full text-sm text-gray-800 border border-gray-200 p-3 rounded-xl mb-6 outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRenamingProject(false)}
                  className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renaming || !renameValue.trim()}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFCModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Generate Flashcards</h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Select the source materials to use for this Flashcard set. This selection is independent from the
              Project&apos;s Active Context.
            </p>

            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <label className="mb-2 block text-xs font-bold text-gray-700">Source Materials</label>
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {materials.map((material) => {
                  const materialId = material.materialId || material.id;
                  const isSelected = flashcardMaterialIds.some(
                    (id) => String(id) === String(materialId)
                  );

                  return (
                    <label
                      key={materialId}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                        isSelected
                          ? 'border-emerald-200 bg-emerald-50 text-gray-800'
                          : 'border-gray-100 bg-white text-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-emerald-600"
                        checked={isSelected}
                        onChange={() => toggleFlashcardMaterial(materialId)}
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {material.title || 'Learning Material'}
                      </span>
                    </label>
                  );
                })}
              </div>

              <p className="mt-2 text-[10px] font-semibold text-gray-400">
                Selected {flashcardMaterialIds.length}/{materials.length} material(s).
              </p>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-xs font-bold text-gray-700">Selected Materials</p>
              {flashcardMaterialIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {materials
                    .filter((material) => {
                      const materialId = material.materialId || material.id;
                      return flashcardMaterialIds.some(
                        (id) => String(id) === String(materialId)
                      );
                    })
                    .map((material) => (
                      <span
                        key={`selected-${material.materialId || material.id}`}
                        className="max-w-full truncate rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"
                        title={material.title || 'Learning Material'}
                      >
                        {material.title || 'Learning Material'}
                      </span>
                    ))}
                </div>
              ) : (
                <p className="text-[10px] font-semibold text-amber-600">
                  Select at least one source material before generating Flashcards.
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 mb-2">Target number of cards</label>
              <input
                type="number"
                min="1"
                max="50"
                value={flashcardCount}
                onChange={(e) => setFlashcardCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowFCModal(false)}
                className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateFlashcards}
                disabled={generatingFlashcards || flashcardMaterialIds.length === 0}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
              >
                {generatingFlashcards ? 'Generating...' : 'Generate Flashcards'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuizModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Create Practice Quiz</h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Current Project: <span className="font-bold text-blue-700">{currentProject?.name || '—'}</span>.
              Only materials from this Project can be used to generate the Quiz.
            </p>

            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <label className="mb-2 block text-xs font-bold text-gray-700">Select materials:</label>
              <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
                {materials.map((material) => {
                  const materialId = material.materialId || material.id;
                  return (
                    <label key={materialId} className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-2.5 py-2 text-xs text-gray-700 border border-gray-100">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-blue-600"
                        checked={selectedMaterialIds.includes(materialId)}
                        onChange={() => toggleMaterialSelection(materialId)}
                      />
                      <span className="min-w-0 flex-1 truncate">{material.title || 'Learning Material'}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] font-semibold text-gray-400">
                Selected {selectedMaterialIds.length}/{materials.length} materials in {currentProject?.name || 'Project'}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Number of questions:</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={quizCount}
                  onChange={(e) => setQuizCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Difficulty:</label>
                <select
                  value={quizDifficulty}
                  onChange={(e) => setQuizDifficulty(e.target.value)}
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowQuizModal(false)}
                className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateQuiz}
                disabled={generatingQuiz || selectedMaterialIds.length === 0}
                className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-sm"
              >
                {generatingQuiz ? 'Generating...' : 'Generate Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}