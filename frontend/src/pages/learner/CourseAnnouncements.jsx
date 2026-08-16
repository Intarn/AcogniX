// frontend/src/pages/learner/CourseAnnouncements.jsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCourses } from '../../services/courseService';
import { getCourseAnnouncements } from '../../features/classroom/courseContentApi';
import { useToast } from '../../contexts/ToastContext';

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

export default function CourseAnnouncements() {
  const { courseId } = useParams();
  const { showToast } = useToast();
  const [course, setCourse] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [downloadingUrl, setDownloadingUrl] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    async function loadPage() {
      try {
        setLoading(true);
        setLoadError('');
        const [courseResult, announcementResult] = await Promise.all([
          getCourses(),
          getCourseAnnouncements(courseId)
        ]);

        const courseList = Array.isArray(courseResult?.courses)
          ? courseResult.courses
          : (Array.isArray(courseResult) ? courseResult : []);
        const foundCourse = courseList.find((item) => String(item.courseId) === String(courseId)) || null;
        if (!foundCourse) throw new Error('Class not found.');

        const loadedAnnouncements = Array.isArray(announcementResult?.announcements)
          ? [...announcementResult.announcements].sort(
              (a, b) => new Date(b.publishedAt || b.createdAt || 0).getTime() - new Date(a.publishedAt || a.createdAt || 0).getTime()
            )
          : [];

        setCourse(foundCourse);
        setAnnouncements(loadedAnnouncements);
      } catch (error) {
        setLoadError(error.message || 'Unable to load announcements.');
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [courseId]);

  const handleDownloadAttachment = async (e, url, fileName) => {
    e.preventDefault();
    e.stopPropagation();
    if (!url) return;

    try {
      setDownloadingUrl(url);
      showToast('Downloading attachment...', 'info');
      const res = await fetch(url);
      if (!res.ok) throw new Error('Unable to download file.');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      showToast('Attachment downloaded successfully!', 'success');
    } catch (err) {
      console.error('Download error:', err);
      window.open(url, '_blank');
    } finally {
      setDownloadingUrl(null);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading announcements...</p>
        </div>
      </main>
    );
  }

  if (loadError || !course) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50">
        <p className="text-sm font-bold text-red-500">{loadError}</p>
        <Link to="/learner/my-courses" className="mt-3 text-xs font-bold text-blue-600 hover:underline">
          Back to course list
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8 bg-gray-50/50">
      {/* BREADCRUMB & HEADER */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
          <Link to="/learner/my-courses" className="hover:text-blue-600 transition-colors">My Courses</Link>
          <span>/</span>
          <Link to={`/learner/courses/${course.courseId}`} className="hover:text-blue-600 transition-colors">{course.subjectName}</Link>
          <span>/</span>
          <span className="text-gray-700 font-bold">Class Announcements</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Class Announcements</h1>
      </div>

      {/* ANNOUNCEMENTS CONTAINER */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
        {announcements.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl mb-3 font-bold">
              📢
            </div>
            {/* UC16-UI04: EXACT EMPTY MESSAGE */}
            <p className="text-sm font-bold text-gray-700">No announcement yet</p>
            <p className="text-xs text-gray-400 mt-1">Important information from educators will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const hasAttachments = Array.isArray(announcement.attachmentUrls) && announcement.attachmentUrls.length > 0;

              return (
                <div
                  key={announcement.announcementId}
                  onClick={() => setSelectedAnnouncement(announcement)}
                  className="border border-gray-100 rounded-2xl p-5 bg-white hover:border-amber-300 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 text-lg group-hover:scale-105 transition-transform">
                      📢
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-gray-800 group-hover:text-amber-600 transition-colors line-clamp-1">
                          {announcement.title || 'Class Announcement'}
                        </h3>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatDateTime(announcement.publishedAt || announcement.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mt-2">{announcement.body}</p>

                      <div className="mt-3.5 flex items-center justify-between pt-3 border-t border-gray-50">
                        {hasAttachments ? (
                          <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded">
                            📎 {announcement.attachmentUrls.length} attachments
                          </span>
                        ) : <div />}
                        <span className="text-[11px] font-bold text-amber-600 group-hover:underline">
                          View details &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* POPUP MODAL DETAILS */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100 bg-amber-50/40 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl flex-shrink-0">
                  📢
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">
                    {selectedAnnouncement.title || 'Class Announcement'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Published on: {formatDateTime(selectedAnnouncement.publishedAt || selectedAnnouncement.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center text-sm shadow-xs transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-gray-700 leading-relaxed whitespace-pre-wrap text-xs font-medium">
                {selectedAnnouncement.body}
              </div>

              {Array.isArray(selectedAnnouncement.attachmentUrls) && selectedAnnouncement.attachmentUrls.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Attachments ({selectedAnnouncement.attachmentUrls.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedAnnouncement.attachmentUrls.map((url, index) => {
                      const fileName = getFileNameFromUrl(url, index);
                      const isDownloading = downloadingUrl === url;

                      return (
                        <div key={index} className="flex items-center justify-between p-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-base">📄</span>
                            <span className="text-xs font-bold text-gray-800 truncate">{fileName}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            <a href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline">
                              👁️ View
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadAttachment(e, url, fileName)}
                              disabled={isDownloading}
                              className="text-xs font-bold text-emerald-600 hover:underline disabled:opacity-50"
                            >
                              {isDownloading ? '⏳ Downloading...' : '📥 Download'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}