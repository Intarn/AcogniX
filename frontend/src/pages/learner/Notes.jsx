// frontend/src/pages/learner/Notes.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getProjectNotes,
  createNote,
  updateNote,
  deleteNote
} from '../../features/notes/noteApi';
import { getWorkspaceData } from '../../services/workspaceService';

export default function Notes() {
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [notes, setNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false
  });

  const contentEditableRef = useRef(null);

  const updateToolbarState = useCallback(() => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight')
      });
    } catch {}
  }, []);

  const handleNewNote = () => {
    setActiveNoteId(null);
    setNoteTitle('');
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = '';
      contentEditableRef.current.focus();
    }
    setSaveStatus('');
    updateToolbarState();
  };

  const loadNoteContent = (note) => {
    setActiveNoteId(note.noteId || note.id);
    setNoteTitle(note.title || '');
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = note.content || '';
    }
    setSaveStatus('');
    updateToolbarState();
  };

  useEffect(() => {
    let cancelled = false;
    const loadWorkspace = async () => {
      try {
        setLoadingWorkspace(true);
        const workspace = await getWorkspaceData();
        if (cancelled) return;

        const loadedProjects = Array.isArray(workspace?.AI_Project)
          ? workspace.AI_Project
          : Array.isArray(workspace?.AI_Projects)
          ? workspace.AI_Projects
          : [];

        const activeProjects = loadedProjects.filter(
          (project) => project.status !== 'INACTIVE' && project.status !== 'ARCHIVED'
        );

        setProjects(activeProjects);
        if (activeProjects.length > 0) {
          setSelectedProjectId(activeProjects[0].projectId || activeProjects[0].id);
        } else {
          setSelectedProjectId('');
          setNotes([]);
        }
      } catch (error) {
        console.error('[Notes Error]:', error);
        if (!cancelled) {
          setProjects([]);
          setSelectedProjectId('');
          setNotes([]);
        }
      } finally {
        if (!cancelled) setLoadingWorkspace(false);
      }
    };

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadNotes = async (projectId, preferredNoteId = null) => {
    if (!projectId) {
      setNotes([]);
      return;
    }

    try {
      setLoadingNotes(true);
      const result = await getProjectNotes(projectId);
      const loadedNotes = Array.isArray(result)
        ? result
        : Array.isArray(result?.notes)
        ? result.notes
        : [];

      const sortedNotes = [...loadedNotes].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setNotes(sortedNotes);

      const targetId = preferredNoteId || activeNoteId;
      if (targetId) {
        const found = sortedNotes.find((n) => String(n.noteId || n.id) === String(targetId));
        if (found) {
          loadNoteContent(found);
          return;
        }
      }

      if (sortedNotes.length > 0) {
        loadNoteContent(sortedNotes[0]);
      } else {
        handleNewNote();
      }
    } catch (error) {
      console.error('[Notes Load Error]:', error);
      setNotes([]);
      handleNewNote();
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (!selectedProjectId) return;
    setActiveNoteId(null);
    setNoteTitle('');
    setSaveStatus('');
    loadNotes(selectedProjectId);
  }, [selectedProjectId]);

  const handleSaveNote = async () => {
    const title = noteTitle.trim();
    const editor = contentEditableRef.current;
    const content = editor ? editor.innerHTML.trim() : '';
    const plainText = editor ? (editor.textContent || editor.innerText || '').trim() : '';

    if (!plainText) {
      showToast('Note content cannot be empty', 'warning');
      return;
    }

    if (!selectedProjectId) {
      showToast('Please select an AI Project before saving.', 'warning');
      return;
    }

    try {
      setIsSaving(true);
      setSaveStatus('Saving...');
      let result;

      if (activeNoteId) {
        result = await updateNote(activeNoteId, {
          title: title || 'Untitled Note',
          content
        });
      } else {
        result = await createNote(selectedProjectId, {
          title: title || 'Untitled Note',
          content
        });
      }

      const savedNote = result?.note || result;
      const savedNoteId = savedNote?.noteId || savedNote?.id;
      const now = new Date();
      setSaveStatus(`Saved at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
      showToast('Note saved successfully!', 'success');

      await loadNotes(selectedProjectId, savedNoteId);
    } catch (error) {
      console.error('[Note Save Error]:', error);
      setSaveStatus('Save failed');
      showToast(error.message || 'Unable to save note.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async () => {
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
      setSaveStatus('Deleting...');
      await deleteNote(activeNoteId);
      showToast('Note deleted successfully!', 'success');
      setActiveNoteId(null);
      setNoteTitle('');
      setSaveStatus('');
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = '';
      }
      await loadNotes(selectedProjectId);
    } catch (error) {
      console.error('[Note Delete Error]:', error);
      setSaveStatus('Delete failed');
      showToast(error.message || 'Unable to delete note.', 'error');
    }
  };

  const handleFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();
    }
    updateToolbarState();
  };

  const filteredNotes = notes.filter((note) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const title = String(note.title || '').toLowerCase();
    const content = String(note.content || '').toLowerCase();
    return title.includes(term) || content.includes(term);
  });

  return (
    <main className="flex-1 flex overflow-hidden bg-white w-full h-full">
      {/* SIDEBAR: NOTE LIST */}
      <div className="w-80 h-full bg-slate-50/50 border-r border-gray-200/60 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200/60 bg-white">
          <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
            AI Context Project
          </label>
          {loadingWorkspace ? (
            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-400 font-medium">
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-500 font-medium">
              No active projects
            </div>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-gray-50 text-xs font-bold text-gray-800 rounded-xl px-3 py-2.5 border border-gray-200 outline-none focus:bg-white focus:border-blue-600 shadow-xs cursor-pointer truncate"
            >
              {projects.map((project) => {
                const pId = project.projectId || project.id;
                return (
                  <option key={pId} value={pId}>
                    {project.name} {project.type === 'CLASS' ? '(Class)' : '(Personal)'}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        <div className="p-4 border-b border-gray-200/60 flex justify-between items-center gap-2 bg-white">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Quick search notes..."
              className="w-full bg-gray-50 text-xs rounded-xl pl-8 pr-3 py-2.5 border border-gray-200 outline-none focus:bg-white focus:border-blue-500 transition shadow-inner"
            />
          </div>
          <button
            type="button"
            onClick={handleNewNote}
            disabled={!selectedProjectId}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all whitespace-nowrap"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingNotes ? (
            <p className="text-center text-gray-400 py-8 text-xs italic font-medium">Loading notes list...</p>
          ) : !selectedProjectId ? (
            <p className="text-center text-gray-400 py-8 text-xs font-medium">Please select an AI Project.</p>
          ) : filteredNotes.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-xs font-medium">
              {searchTerm ? 'No matching notes found.' : 'No notes yet. Click "+ New" to create one.'}
            </p>
          ) : (
            filteredNotes.map((note) => {
              const nId = note.noteId || note.id;
              const isActive = nId === activeNoteId;
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = note.content || '';
              const snippet = (tempDiv.textContent || tempDiv.innerText || '').substring(0, 50);
              const noteDate = note.updatedAt || note.createdAt;

              return (
                <div
                  key={nId}
                  onClick={() => loadNoteContent(note)}
                  className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-blue-50/80 border-blue-200 shadow-xs'
                      : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                  }`}
                >
                  <h3 className={`text-xs font-black truncate ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>
                    {note.title || 'Untitled Note'}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                    {snippet || 'Empty content'}
                  </p>
                  <span className="text-[9px] text-gray-400 mt-2 block font-semibold">
                    {noteDate ? new Date(noteDate).toLocaleString('en-US') : ''}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: EDITOR PANEL */}
      <div className="flex-1 h-full flex flex-col min-w-0 bg-white">
        <div className="flex-shrink-0 bg-white border-b border-gray-200/60 flex flex-wrap items-center justify-between px-6 py-2.5 gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-50/80 p-1.5 rounded-2xl border border-gray-200/70">
            <button
              type="button"
              onClick={() => handleFormat('bold')}
              className={`px-3 h-7 rounded-xl text-xs font-black flex items-center justify-center transition shadow-xs ${
                activeFormats.bold ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200/70 text-gray-800 bg-white'
              }`}
              title="Bold"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => handleFormat('italic')}
              className={`px-3 h-7 rounded-xl italic font-black text-xs flex items-center justify-center transition shadow-xs ${
                activeFormats.italic ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200/70 text-gray-800 bg-white'
              }`}
              title="Italic"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => handleFormat('underline')}
              className={`px-3 h-7 rounded-xl underline font-black text-xs flex items-center justify-center transition shadow-xs ${
                activeFormats.underline ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200/70 text-gray-800 bg-white'
              }`}
              title="Underline"
            >
              U
            </button>
            <button
              type="button"
              onClick={() => handleFormat('strikeThrough')}
              className={`px-3 h-7 rounded-xl line-through text-xs font-bold flex items-center justify-center transition shadow-xs ${
                activeFormats.strikeThrough ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200/70 text-gray-800 bg-white'
              }`}
              title="Strikethrough"
            >
              S
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1" />

            <button
              type="button"
              onClick={() => handleFormat('justifyLeft')}
              className={`px-3 h-7 rounded-xl text-xs font-bold flex items-center justify-center transition shadow-xs ${
                activeFormats.justifyLeft ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200/70 text-gray-800 bg-white'
              }`}
              title="Align Left"
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => handleFormat('justifyCenter')}
              className={`px-3 h-7 rounded-xl text-xs font-bold flex items-center justify-center transition shadow-xs ${
                activeFormats.justifyCenter ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200/70 text-gray-800 bg-white'
              }`}
              title="Align Center"
            >
              Center
            </button>
            <button
              type="button"
              onClick={() => handleFormat('justifyRight')}
              className={`px-3 h-7 rounded-xl text-xs font-bold flex items-center justify-center transition shadow-xs ${
                activeFormats.justifyRight ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200/70 text-gray-800 bg-white'
              }`}
              title="Align Right"
            >
              Right
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-400 font-semibold italic">
              {saveStatus}
            </span>
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={!selectedProjectId || isSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition whitespace-nowrap"
            >
              {isSaving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 max-w-4xl w-full mx-auto space-y-6">
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            disabled={!selectedProjectId}
            className="w-full text-2xl font-black text-gray-900 outline-none pb-3 border-b border-gray-100 placeholder-gray-300 disabled:bg-transparent"
            placeholder="Note title..."
          />

          <div
            ref={contentEditableRef}
            contentEditable={Boolean(selectedProjectId)}
            suppressContentEditableWarning
            onKeyUp={updateToolbarState}
            onMouseUp={updateToolbarState}
            className="text-sm text-gray-800 leading-relaxed outline-none min-h-[420px] prose max-w-none focus:ring-0"
          />

          {activeNoteId && (
            <div className="pt-6 border-t border-gray-100 flex items-center">
              <button
                type="button"
                onClick={handleDeleteNote}
                className="text-red-600 bg-red-50 hover:bg-red-100 text-xs font-bold px-5 py-3 rounded-2xl transition shadow-xs"
              >
                Delete this note
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}