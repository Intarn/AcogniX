// frontend/src/pages/learner/Notes.jsx

import {
  useState,
  useEffect,
  useRef
} from 'react';

import {
  getProjectNotes,
  createNote,
  updateNote,
  deleteNote
} from '../../features/notes/noteApi';

import {
  getWorkspaceData
} from '../../services/workspaceService';


const EMPTY_NOTE_PLACEHOLDER =
  'Bắt đầu viết ghi chú tại đây...';


export default function Notes() {
  /*
   * =========================================================
   * STATE
   * =========================================================
   */

  // Danh sách AI Project của Learner
  const [
    projects,
    setProjects
  ] = useState([]);

  // Project hiện đang được chọn
  const [
    selectedProjectId,
    setSelectedProjectId
  ] = useState('');

  // Danh sách Notes thuộc Project đang chọn
  const [
    notes,
    setNotes
  ] = useState([]);

  const [
    searchTerm,
    setSearchTerm
  ] = useState('');

  // null = đang tạo Note mới
  // có noteId = đang edit Note có sẵn
  const [
    activeNoteId,
    setActiveNoteId
  ] = useState(null);

  const [
    noteTitle,
    setNoteTitle
  ] = useState('');

  const [
    saveStatus,
    setSaveStatus
  ] = useState('');

  const [
    loadingWorkspace,
    setLoadingWorkspace
  ] = useState(true);

  const [
    loadingNotes,
    setLoadingNotes
  ] = useState(false);

  const contentEditableRef =
    useRef(null);


  /*
   * =========================================================
   * HELPER
   * =========================================================
   */

  // Reset editor về trạng thái tạo Note mới
  const handleNewNote = () => {
    setActiveNoteId(null);

    setNoteTitle('');

    if (
      contentEditableRef.current
    ) {
      contentEditableRef.current.innerHTML =
        `<p>${EMPTY_NOTE_PLACEHOLDER}</p>`;

      contentEditableRef.current.focus();
    }

    setSaveStatus('');
  };


  // Mở một Note có sẵn
  const loadNoteContent = (
    note
  ) => {
    setActiveNoteId(
      note.noteId
    );

    setNoteTitle(
      note.title || ''
    );

    if (
      contentEditableRef.current
    ) {
      contentEditableRef.current.innerHTML =
        note.content || '';
    }

    setSaveStatus('');
  };


  /*
   * =========================================================
   * LOAD WORKSPACE + PROJECTS
   * =========================================================
   */

  useEffect(() => {
    let cancelled = false;


    const loadWorkspace =
      async () => {
        try {
          setLoadingWorkspace(
            true
          );


          /*
           * Backend:
           *
           * GET /api/workspace
           *
           * Response:
           *
           * {
           *   workspaceId,
           *   learnerId,
           *   ...,
           *   AI_Project: [...]
           * }
           */
          const workspace =
            await getWorkspaceData();


          if (cancelled) {
            return;
          }


          const loadedProjects =
            Array.isArray(
              workspace?.AI_Project
            )
              ? workspace.AI_Project
              : [];


          /*
           * Chỉ hiển thị Project đang ACTIVE.
           *
           * Personal Project thường ACTIVE.
           * Class Project bị revoke có thể INACTIVE.
           */
          const activeProjects =
            loadedProjects.filter(
              (project) =>
                project.status !==
                'INACTIVE'
            );


          setProjects(
            activeProjects
          );


          /*
           * Mặc định chọn Project đầu tiên.
           */
          if (
            activeProjects.length > 0
          ) {
            setSelectedProjectId(
              activeProjects[0]
                .projectId
            );
          } else {
            setSelectedProjectId(
              ''
            );

            setNotes([]);
          }
        } catch (error) {
          if (!cancelled) {
            console.error(
              'Unable to load Workspace:',
              error
            );

            setProjects([]);

            setSelectedProjectId(
              ''
            );

            setNotes([]);
          }
        } finally {
          if (!cancelled) {
            setLoadingWorkspace(
              false
            );
          }
        }
      };


    loadWorkspace();


    return () => {
      cancelled = true;
    };
  }, []);


  /*
   * =========================================================
   * LOAD NOTES
   * =========================================================
   */

  const loadNotes =
    async (
      projectId,
      preferredNoteId = null
    ) => {
      if (!projectId) {
        setNotes([]);

        return;
      }


      try {
        setLoadingNotes(true);


        /*
         * Backend:
         *
         * GET
         * /api/workspace/projects/:projectId/notes
         */
        const result =
          await getProjectNotes(
            projectId
          );


        /*
         * NoteController trả:
         *
         * {
         *   projectId,
         *   count,
         *   notes
         * }
         */
        const loadedNotes =
          Array.isArray(result)
            ? result
            : Array.isArray(
                result?.notes
              )
              ? result.notes
              : [];


        /*
         * Note mới chỉnh sửa gần nhất
         * được đưa lên đầu.
         */
        const sortedNotes = [
          ...loadedNotes
        ].sort(
          (a, b) => {
            const dateA =
              new Date(
                a.updatedAt ||
                a.createdAt ||
                0
              ).getTime();

            const dateB =
              new Date(
                b.updatedAt ||
                b.createdAt ||
                0
              ).getTime();


            return (
              dateB - dateA
            );
          }
        );


        setNotes(
          sortedNotes
        );


        /*
         * Sau create/update:
         * giữ đúng Note vừa lưu.
         */
        if (
          preferredNoteId
        ) {
          const preferredNote =
            sortedNotes.find(
              (note) =>
                note.noteId ===
                preferredNoteId
            );


          if (preferredNote) {
            loadNoteContent(
              preferredNote
            );

            return;
          }
        }


        /*
         * Nếu Note đang mở vẫn tồn tại
         * thì giữ nó.
         */
        if (
          activeNoteId
        ) {
          const currentNote =
            sortedNotes.find(
              (note) =>
                note.noteId ===
                activeNoteId
            );


          if (currentNote) {
            loadNoteContent(
              currentNote
            );

            return;
          }
        }


        /*
         * Nếu chưa có Note đang mở,
         * chọn Note đầu tiên.
         */
        if (
          sortedNotes.length > 0
        ) {
          loadNoteContent(
            sortedNotes[0]
          );
        } else {
          handleNewNote();
        }
      } catch (error) {
        console.error(
          'Unable to load Notes:',
          error
        );

        setNotes([]);

        handleNewNote();
      } finally {
        setLoadingNotes(false);
      }
    };


  /*
   * Khi Learner đổi Project
   * → load Notes của Project đó.
   */
  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }


    setActiveNoteId(null);

    setNoteTitle('');

    setSaveStatus('');


    loadNotes(
      selectedProjectId
    );
  }, [selectedProjectId]);


  /*
   * =========================================================
   * SAVE NOTE
   * =========================================================
   */

  const handleSaveNote =
    async () => {
      const title =
        noteTitle.trim();


      const editor =
        contentEditableRef.current;


      const content =
        editor
          ? editor.innerHTML.trim()
          : '';


      const plainText =
        editor
          ? (
              editor.textContent ||
              editor.innerText ||
              ''
            ).trim()
          : '';


      /*
       * UC-25 Alternative Flow 1:
       * Blank Submission.
       */
      if (
        !plainText ||
        plainText ===
          EMPTY_NOTE_PLACEHOLDER
      ) {
        alert(
          'Note content cannot be empty.'
        );

        return;
      }


      if (!selectedProjectId) {
        alert(
          'Please select an AI Project first.'
        );

        return;
      }


      try {
        setSaveStatus(
          'Saving...'
        );


        let result;


        /*
         * ==================================
         * UPDATE EXISTING NOTE
         * ==================================
         */
        if (activeNoteId) {
          /*
           * PATCH
           * /api/workspace/notes/:noteId
           */
          result =
            await updateNote(
              activeNoteId,
              {
                title:
                  title ||
                  'Untitled Note',

                content
              }
            );
        }

        /*
         * ==================================
         * CREATE NEW NOTE
         * ==================================
         */
        else {
          /*
           * POST
           * /api/workspace/projects/
           * :projectId/notes
           */
          result =
            await createNote(
              selectedProjectId,
              {
                title:
                  title ||
                  'Untitled Note',

                content
              }
            );
        }


        /*
         * Backend response:
         *
         * {
         *   message,
         *   note
         * }
         */
        const savedNote =
          result?.note ||
          result;


        const savedNoteId =
          savedNote?.noteId;


        const now =
          new Date();


        setSaveStatus(
          `Saved at ${now.toLocaleTimeString(
            'en-US',
            {
              hour: '2-digit',
              minute: '2-digit'
            }
          )}`
        );


        /*
         * Reload danh sách từ database.
         */
        await loadNotes(
          selectedProjectId,
          savedNoteId
        );
      } catch (error) {
        console.error(
          'Unable to save Note:',
          error
        );


        setSaveStatus(
          'Save failed'
        );


        alert(
          error.message ||
          'Unable to save Note.'
        );
      }
    };


  /*
   * =========================================================
   * DELETE NOTE
   * =========================================================
   */

  const handleDeleteNote =
    async () => {
      if (!activeNoteId) {
        return;
      }


      /*
       * UC-25 Alternative Flow 2:
       * Confirm Before Delete.
       */
      const confirmed =
        window.confirm(
          'Delete this note permanently?'
        );


      if (!confirmed) {
        return;
      }


      try {
        setSaveStatus(
          'Deleting...'
        );


        /*
         * DELETE
         * /api/workspace/notes/:noteId
         */
        await deleteNote(
          activeNoteId
        );


        setActiveNoteId(null);

        setNoteTitle('');

        setSaveStatus('');


        if (
          contentEditableRef.current
        ) {
          contentEditableRef.current
            .innerHTML =
            `<p>${EMPTY_NOTE_PLACEHOLDER}</p>`;
        }


        /*
         * Reload từ database
         * sau khi Delete.
         */
        await loadNotes(
          selectedProjectId
        );
      } catch (error) {
        console.error(
          'Unable to delete Note:',
          error
        );


        setSaveStatus(
          'Delete failed'
        );


        alert(
          error.message ||
          'Unable to delete Note.'
        );
      }
    };


  /*
   * =========================================================
   * TEXT FORMATTING
   * =========================================================
   */

  const handleFormat = (
    command,
    value = null
  ) => {
    document.execCommand(
      command,
      false,
      value
    );


    if (
      contentEditableRef.current
    ) {
      contentEditableRef.current
        .focus();
    }
  };


  /*
   * =========================================================
   * SEARCH
   * =========================================================
   */

  const filteredNotes =
    notes.filter(
      (note) => {
        const term =
          searchTerm
            .toLowerCase()
            .trim();


        if (!term) {
          return true;
        }


        const title =
          String(
            note.title || ''
          ).toLowerCase();


        const content =
          String(
            note.content || ''
          ).toLowerCase();


        return (
          title.includes(term) ||
          content.includes(term)
        );
      }
    );


  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <main className="flex-1 flex overflow-hidden bg-white">

      {/* ===================================================
          CỘT TRÁI: DANH SÁCH GHI CHÚ
      =================================================== */}
      <div className="w-80 h-full bg-white border-r border-gray-100 flex flex-col flex-shrink-0">

        {/* PROJECT SELECTOR */}
        <div className="p-4 border-b border-gray-100">

          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            AI Project
          </label>


          {loadingWorkspace ? (
            <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400">
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500">
              No AI Project available
            </div>
          ) : (
            <select
              value={
                selectedProjectId
              }
              onChange={(event) =>
                setSelectedProjectId(
                  event.target.value
                )
              }
              className="w-full bg-gray-50 text-xs rounded-lg px-3 py-2 border border-gray-200 outline-none focus:bg-white focus:border-blue-300 transition-colors"
            >
              {projects.map(
                (project) => (
                  <option
                    key={
                      project.projectId
                    }
                    value={
                      project.projectId
                    }
                  >
                    {project.name ||
                      'Untitled Project'}
                  </option>
                )
              )}
            </select>
          )}

        </div>


        {/* SEARCH + NEW NOTE */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center gap-2">

          <div className="relative flex-1">

            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>


            <input
              type="text"
              value={
                searchTerm
              }
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder="Search notes..."
              className="w-full bg-gray-50/80 text-xs rounded-lg pl-9 pr-4 py-2 border border-gray-200 outline-none focus:bg-white focus:border-blue-300 transition-colors"
            />

          </div>


          <button
            onClick={
              handleNewNote
            }
            disabled={
              !selectedProjectId
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm whitespace-nowrap"
          >
            + New
          </button>

        </div>


        {/* NOTE LIST */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">

          {loadingNotes ? (
            <p className="text-center text-gray-400 py-4 text-xs">
              Đang tải ghi chú...
            </p>
          ) : !selectedProjectId ? (
            <p className="text-center text-gray-500 py-4 text-xs">
              Hãy chọn một AI Project.
            </p>
          ) : filteredNotes.length ===
            0 ? (
            <p className="text-center text-gray-500 py-4 text-xs">
              {searchTerm
                ? 'Không tìm thấy ghi chú.'
                : 'Chưa có ghi chú nào. Bấm "+ New" để tạo mới.'}
            </p>
          ) : (
            filteredNotes.map(
              (note) => {
                const isActive =
                  note.noteId ===
                  activeNoteId;


                /*
                 * Convert HTML content
                 * → plain text snippet.
                 */
                const tempDiv =
                  document.createElement(
                    'div'
                  );

                tempDiv.innerHTML =
                  note.content || '';


                const snippet =
                  (
                    tempDiv.textContent ||
                    tempDiv.innerText ||
                    ''
                  ).substring(
                    0,
                    45
                  );


                const noteDate =
                  note.updatedAt ||
                  note.createdAt;


                return (
                  <div
                    key={
                      note.noteId
                    }
                    onClick={() =>
                      loadNoteContent(
                        note
                      )
                    }
                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                      isActive
                        ? 'bg-blue-50 border-blue-200'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >

                    <h3
                      className={`text-sm font-bold truncate ${
                        isActive
                          ? 'text-blue-800'
                          : 'text-gray-800'
                      }`}
                    >
                      {note.title ||
                        'Untitled Note'}
                    </h3>


                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {snippet}
                      {snippet
                        ? '...'
                        : ''}
                    </p>


                    <span className="text-[10px] text-gray-400 mt-2 block">
                      {noteDate
                        ? new Date(
                            noteDate
                          ).toLocaleString()
                        : ''}
                    </span>

                  </div>
                );
              }
            )
          )}

        </div>

      </div>


      {/* ===================================================
          CỘT PHẢI: TRÌNH BIÊN TẬP
      =================================================== */}
      <div className="flex-1 h-full flex flex-col min-w-0">

        {/* TOOLBAR */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between px-5 py-2.5 gap-2">

          <div className="flex flex-wrap items-center gap-1">

            {/* STYLE */}
            <select
              onChange={(event) =>
                handleFormat(
                  'formatBlock',
                  event.target.value
                )
              }
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700 outline-none focus:bg-white focus:border-blue-300 font-semibold cursor-pointer"
              defaultValue="<p>"
            >
              <option value="<p>">
                Văn bản thường
              </option>

              <option value="<h1>">
                Tiêu đề lớn (H1)
              </option>

              <option value="<h2>">
                Tiêu đề vừa (H2)
              </option>

              <option value="<h3>">
                Tiêu đề nhỏ (H3)
              </option>

              <option value="<blockquote>">
                Trích dẫn (Quote)
              </option>
            </select>


            <div className="w-px h-5 bg-gray-200 mx-1" />


            {/* BOLD */}
            <button
              onClick={() =>
                handleFormat(
                  'bold'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 font-bold text-sm flex items-center justify-center transition-colors"
              title="In đậm (Bold)"
            >
              B
            </button>


            {/* ITALIC */}
            <button
              onClick={() =>
                handleFormat(
                  'italic'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 italic text-sm flex items-center justify-center transition-colors"
              title="In nghiêng (Italic)"
            >
              I
            </button>


            {/* UNDERLINE */}
            <button
              onClick={() =>
                handleFormat(
                  'underline'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 underline text-sm flex items-center justify-center transition-colors"
              title="Gạch chân (Underline)"
            >
              U
            </button>


            {/* STRIKE */}
            <button
              onClick={() =>
                handleFormat(
                  'strikeThrough'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 line-through text-sm flex items-center justify-center transition-colors"
              title="Gạch ngang (Strikethrough)"
            >
              S
            </button>


            <div className="w-px h-5 bg-gray-200 mx-1" />


            {/* UNORDERED LIST */}
            <button
              onClick={() =>
                handleFormat(
                  'insertUnorderedList'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 text-sm flex items-center justify-center transition-colors"
              title="Danh sách chấm đầu dòng"
            >
              • List
            </button>


            {/* ORDERED LIST */}
            <button
              onClick={() =>
                handleFormat(
                  'insertOrderedList'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center justify-center transition-colors"
              title="Danh sách số"
            >
              1. List
            </button>


            <div className="w-px h-5 bg-gray-200 mx-1" />


            {/* ALIGN LEFT */}
            <button
              onClick={() =>
                handleFormat(
                  'justifyLeft'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 text-xs flex items-center justify-center transition-colors"
              title="Căn trái"
            >
              ⬅️
            </button>


            {/* ALIGN CENTER */}
            <button
              onClick={() =>
                handleFormat(
                  'justifyCenter'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 text-xs flex items-center justify-center transition-colors"
              title="Căn giữa"
            >
              ↔️
            </button>


            {/* ALIGN RIGHT */}
            <button
              onClick={() =>
                handleFormat(
                  'justifyRight'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 text-xs flex items-center justify-center transition-colors"
              title="Căn phải"
            >
              ➡️
            </button>


            <div className="w-px h-5 bg-gray-200 mx-1" />


            {/* HORIZONTAL RULE */}
            <button
              onClick={() =>
                handleFormat(
                  'insertHorizontalRule'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center transition-colors"
              title="Chèn đường kẻ ngang"
            >
              ―
            </button>


            {/* REMOVE FORMAT */}
            <button
              onClick={() =>
                handleFormat(
                  'removeFormat'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-red-500 text-xs font-bold flex items-center justify-center transition-colors"
              title="Xóa định dạng"
            >
              🧹
            </button>


            <div className="w-px h-5 bg-gray-200 mx-1" />


            {/* UNDO */}
            <button
              onClick={() =>
                handleFormat(
                  'undo'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 text-xs flex items-center justify-center transition-colors"
              title="Hoàn tác (Undo)"
            >
              ↩️
            </button>


            {/* REDO */}
            <button
              onClick={() =>
                handleFormat(
                  'redo'
                )
              }
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 text-xs flex items-center justify-center transition-colors"
              title="Làm lại (Redo)"
            >
              ↪️
            </button>

          </div>


          <span className="text-xs text-gray-400 font-medium ml-auto">
            {saveStatus}
          </span>

        </div>


        {/* ===================================================
            NOTE EDITOR
        =================================================== */}
        <div className="flex-1 overflow-y-auto p-8">

          <input
            type="text"
            value={
              noteTitle
            }
            onChange={(event) =>
              setNoteTitle(
                event.target.value
              )
            }
            disabled={
              !selectedProjectId
            }
            className="w-full text-2xl font-bold text-gray-800 outline-none mb-6 bg-transparent placeholder-gray-300 disabled:text-gray-400"
            placeholder="Note Title..."
          />


          <div
            ref={
              contentEditableRef
            }
            contentEditable={
              Boolean(
                selectedProjectId
              )
            }
            suppressContentEditableWarning={
              true
            }
            className="text-base text-gray-700 leading-relaxed space-y-3 outline-none min-h-[350px] prose max-w-none"
          />


          <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-4">

            {activeNoteId && (
              <button
                onClick={
                  handleDeleteNote
                }
                className="text-red-600 bg-red-50 hover:bg-red-100 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Delete Note
              </button>
            )}


            <button
              onClick={
                handleSaveNote
              }
              disabled={
                !selectedProjectId
              }
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold px-6 py-2 rounded-lg shadow-sm transition-colors"
            >
              Save Note
            </button>

          </div>

        </div>

      </div>

    </main>
  );
}