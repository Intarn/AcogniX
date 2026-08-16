// frontend/src/pages/educator/CourseAnnouncementsPage.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../services/apiClient';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';

function formatDateTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getFileNameFromUrl(url, index) {
  if (!url) return `Attachment ${index + 1}`;
  try {
    const cleanUrl = String(url).split('?')[0];
    const rawFileName = cleanUrl.split('/').pop();
    if (!rawFileName) return `Attachment ${index + 1}`;
    const decoded = decodeURIComponent(rawFileName);
    return decoded.replace(/^\d+__?/, '').replace(/^[0-9a-fA-F-]{36}__?/, '') || `Attachment ${index + 1}`;
  } catch {
    return `Attachment ${index + 1}`;
  }
}

export default function CourseAnnouncementsPage() {
  const { courseId } = useParams();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [course, setCourse] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  // Form State & Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Validation Error States (UC17-UI03 & UC17-UI04)
  const [titleError, setTitleError] = useState(false);
  const [bodyError, setBodyError] = useState(false);
  const [validationErrorMsg, setValidationErrorMsg] = useState('');

  const fileInputRef = useRef(null);

  const fetchData = async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      const [coursesRes, announcementsRes] = await Promise.all([
        apiRequest('/courses', { method: 'GET' }).catch(() => []),
        apiRequest(`/courses/${courseId}/announcements`, { method: 'GET' }).catch(() => ({ announcements: [] }))
      ]);

      const courseList = Array.isArray(coursesRes?.courses) ? coursesRes.courses : Array.isArray(coursesRes) ? coursesRes : [];
      setCourse(courseList.find((c) => String(c.courseId) === String(courseId)) || { courseId, subjectName: 'Classroom' });

      const loadedAnnouncements = Array.isArray(announcementsRes?.announcements)
        ? announcementsRes.announcements
        : Array.isArray(announcementsRes)
        ? announcementsRes
        : [];

      setAnnouncements(
        loadedAnnouncements.sort(
          (a, b) => new Date(b.publishedAt || b.createdAt || 0).getTime() - new Date(a.publishedAt || a.createdAt || 0).getTime()
        )
      );
    } catch (error) {
      showToast('Failed to load announcements.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courseId]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      showToast('You can attach a maximum of 5 files.', 'warning');
      return;
    }
    setSelectedFiles((prev) => [...prev, ...files].slice(0, 5));
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  // UC17-UI05 & UC17-UI06: Discard draft handling
  const handleRequestClose = () => {
    if (newTitle.trim() || newBody.trim() || selectedFiles.length > 0) {
      setShowDiscardConfirm(true);
    } else {
      setShowCreateModal(false);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    setShowCreateModal(false);
    setNewTitle('');
    setNewBody('');
    setSelectedFiles([]);
    setTitleError(false);
    setBodyError(false);
    setValidationErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  // UC17 Basic Flow & Validation
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    const isTitleEmpty = !newTitle.trim();
    const isBodyEmpty = !newBody.trim();

    if (isTitleEmpty || isBodyEmpty) {
      setTitleError(isTitleEmpty);
      setBodyError(isBodyEmpty);
      setValidationErrorMsg('Title and content cannot be empty. Please fill in the required fields.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('title', newTitle.trim());
      formData.append('body', newBody.trim());
      selectedFiles.forEach((file) => formData.append('attachments', file));

      const response = await apiRequest(`/courses/${courseId}/announcements`, {
        method: 'POST',
        body: formData
      });

      // UC17-UI07: Email failure handling
      if (response?.emailFailed) {
        showToast(
          'The announcement was posted successfully, but email notifications could not be sent at this time due to a server issue.',
          'warning'
        );
      } else {
        showToast('Announcement posted and emails sent successfully!', 'success');
      }

      handleConfirmDiscard();
      await fetchData();
    } catch (error) {
      showToast(error.message || 'Failed to post announcement.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (e, announcementId, announcementTitle) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: 'Delete Announcement',
      message: `Are you sure you want to delete "${announcementTitle || 'this announcement'}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!isConfirmed) return;

    try {
      await apiRequest(`/courses/announcements/${announcementId}`, { method: 'DELETE' });
      showToast('Announcement deleted successfully!', 'success');
      if (selectedAnnouncement?.announcementId === announcementId) setSelectedAnnouncement(null);
      setAnnouncements((prev) => prev.filter((item) => item.announcementId !== announcementId));
    } catch (error) {
      showToast(error.message || 'Failed to delete announcement.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1">
            <Link to="/educator/courses" className="hover:text-blue-600 transition">My Courses</Link>
            <span>/</span>
            <Link to={`/educator/courses/${courseId}`} className="hover:text-blue-600 transition">{course?.subjectName || 'Course'}</Link>
            <span>/</span>
            <span className="text-gray-700">Announcements</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Class Announcements</h1>
        </div>
        <button
          onClick={() => {
            setTitleError(false);
            setBodyError(false);
            setValidationErrorMsg('');
            setShowCreateModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-md transition flex items-center gap-2"
        >
          <span>+</span> Post New Announcement
        </button>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-base font-black text-gray-900">Broadcast Board</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">All published updates for enrolled learners.</p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full">{announcements.length} posts</span>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="py-16 text-center text-xs font-bold text-gray-400">Loading announcements...</div>
            ) : announcements.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold mb-3">📢</div>
                <p className="text-base font-black text-gray-900">No announcements yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-6">Post your first announcement to keep learners updated.</p>
                <button
                  onClick={() => {
                    setTitleError(false);
                    setBodyError(false);
                    setValidationErrorMsg('');
                    setShowCreateModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md transition"
                >
                  Create Announcement
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((item) => {
                  const hasAttachments = Array.isArray(item.attachmentUrls) && item.attachmentUrls.length > 0;
                  return (
                    <article
                      key={item.announcementId}
                      onClick={() => setSelectedAnnouncement(item)}
                      className="border border-gray-100 rounded-2xl p-5 bg-white hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer group relative"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 text-lg group-hover:scale-105 transition">
                          📢
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                          <div className="flex items-start justify-between flex-wrap gap-2">
                            <h3 className="text-sm font-bold text-gray-800 group-hover:text-amber-600 transition truncate">{item.title}</h3>
                            <span className="text-[11px] text-gray-400 font-semibold">{formatDateTime(item.publishedAt || item.createdAt)}</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mt-2">{item.body}</p>
                          <div className="mt-3.5 flex items-center justify-between pt-3 border-t border-gray-50">
                            {hasAttachments ? (
                              <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded">📎 {item.attachmentUrls.length} attachments</span>
                            ) : <div />}
                            <span className="text-[11px] font-bold text-amber-600 group-hover:underline">View details &rarr;</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAnnouncement(e, item.announcementId, item.title)}
                        className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Delete announcement"
                      >
                        🗑️
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* DETAIL MODAL */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100 bg-amber-50/40 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl">📢</div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">{selectedAnnouncement.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Published on: {formatDateTime(selectedAnnouncement.publishedAt || selectedAnnouncement.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAnnouncement(null)} className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center text-sm shadow-xs transition">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-gray-700 leading-relaxed whitespace-pre-wrap text-xs font-medium">
                {selectedAnnouncement.body}
              </div>

              {Array.isArray(selectedAnnouncement.attachmentUrls) && selectedAnnouncement.attachmentUrls.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Attachments ({selectedAnnouncement.attachmentUrls.length})</h4>
                  <div className="space-y-2">
                    {selectedAnnouncement.attachmentUrls.map((url, index) => {
                      const fileName = getFileNameFromUrl(url, index);
                      return (
                        <a key={index} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3.5 bg-blue-50/50 hover:bg-blue-100/60 border border-blue-100 rounded-2xl transition group">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-base">📄</span>
                            <span className="text-xs font-bold text-gray-800 truncate">{fileName}</span>
                          </div>
                          <span className="text-xs font-bold text-blue-600 group-hover:underline flex-shrink-0 ml-4">Download ↗</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <button onClick={(e) => handleDeleteAnnouncement(e, selectedAnnouncement.announcementId, selectedAnnouncement.title)} className="text-xs font-bold text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition">
                Delete Post
              </button>
              <button onClick={() => setSelectedAnnouncement(null)} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition shadow-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL (UC-17) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 bg-gray-50/60 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-800">Post Announcement</h3>
                <p className="text-xs text-gray-400 mt-0.5">Send a broadcast and email notification to all class learners.</p>
              </div>
              <button onClick={handleRequestClose} className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-400 flex items-center justify-center text-sm shadow-xs">✕</button>
            </div>

            <form onSubmit={handleCreateAnnouncement} noValidate className="p-6 space-y-4">
              {validationErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{validationErrorMsg}</span>
                </div>
              )}

              {/* Title Field with Red Border Error State (UC17-UI03) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (titleError) setTitleError(false);
                    if (validationErrorMsg) setValidationErrorMsg('');
                  }}
                  placeholder="E.g., Midterm Exam Schedule..."
                  className={`w-full text-xs rounded-xl px-4 py-3 outline-none transition ${
                    titleError
                      ? 'border-2 border-red-500 bg-red-50/20 focus:border-red-600'
                      : 'border border-gray-200 bg-gray-50 focus:border-blue-500 focus:bg-white'
                  }`}
                />
              </div>

              {/* Body Field with Red Border Error State (UC17-UI04) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="5"
                  value={newBody}
                  onChange={(e) => {
                    setNewBody(e.target.value);
                    if (bodyError) setBodyError(false);
                    if (validationErrorMsg) setValidationErrorMsg('');
                  }}
                  placeholder="Write your announcement details here..."
                  className={`w-full text-xs rounded-xl p-4 outline-none resize-none leading-relaxed transition ${
                    bodyError
                      ? 'border-2 border-red-500 bg-red-50/20 focus:border-red-600'
                      : 'border border-gray-200 bg-gray-50 focus:border-blue-500 focus:bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Attachments (Max 5 files)</label>
                <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2">
                  <span>📎</span> Choose Files from Device
                </button>

                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs">
                        <span className="font-semibold text-gray-700 truncate max-w-[280px]">{file.name}</span>
                        <button type="button" onClick={() => handleRemoveFile(idx)} className="text-xs text-red-500 hover:underline font-bold">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={handleRequestClose} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50">
                  {submitting ? 'Posting...' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCARD CONFIRMATION MODAL (UC17-UI05 & UC17-UI06) */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-xl font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-black text-gray-900">Discard Announcement?</h3>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Are you sure you want to discard this announcement? All unsaved changes will be lost.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Keep Drafting
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}