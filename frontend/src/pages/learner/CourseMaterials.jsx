// frontend/src/pages/learner/CourseMaterials.jsx
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getCourses } from '../../services/courseService';
import { getCourseMaterials, getCourseMaterialFileBlob } from '../../features/classroom/courseContentApi';
import { useToast } from '../../contexts/ToastContext';
import DocumentPreviewModal from '../../components/common/DocumentPreviewModal';
import { getFileNameFromContentDisposition, getFileNameFromResourceUrl } from '../../utils/documentPreview';

function formatDateTime(value) {
  if (!value) return '';
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

function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CourseMaterials() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // State cho Built-in Document Viewer (UC16-UI03)
  const [viewingMaterial, setViewingMaterial] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      setLoadError('Missing Course ID.');
      return;
    }
    async function loadPage() {
      try {
        setLoading(true);
        setLoadError('');
        const [courseResult, materialResult] = await Promise.all([
          getCourses(),
          getCourseMaterials(courseId)
        ]);
        const courseList = Array.isArray(courseResult?.courses) ? courseResult.courses : (Array.isArray(courseResult) ? courseResult : []);
        const foundCourse = courseList.find((item) => String(item.courseId) === String(courseId)) || null;
        if (!foundCourse) throw new Error('Course not found.');
        setCourse(foundCourse);
        setMaterials(Array.isArray(materialResult?.materials) ? materialResult.materials : []);
      } catch (error) {
        setLoadError(error.message || 'Unable to load materials list.');
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [courseId]);

  const closeViewer = () => {
    setViewingMaterial(null);
    setPreviewFile(null);
  };

  // Built-in Viewer & reliable Storage validation (UC16-UI03, UC16-UI05)
  const handleOpenMaterialViewer = async (material) => {
    const resourceUrl = String(material?.resourceUrl || '').trim();
    if (!resourceUrl) {
      showToast('This file is no longer available.', 'error');
      return;
    }

    if (material.resourceType === 'LINK') {
      const openUrl = !/^https?:\/\//i.test(resourceUrl) ? `https://${resourceUrl}` : resourceUrl;
      window.open(openUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      setViewerLoading(true);
      const { blob, contentType, contentDisposition } = await getCourseMaterialFileBlob(material.materialId);
      const fallbackName = getFileNameFromResourceUrl(material.resourceUrl, material.title || 'course-material');
      const fileName = getFileNameFromContentDisposition(contentDisposition, fallbackName);
      setPreviewFile({ blob, contentType, fileName });
      setViewingMaterial(material);
    } catch (error) {
      closeViewer();
      showToast('This file is no longer available.', 'error');
    } finally {
      setViewerLoading(false);
    }
  };

  const handleDownloadMaterial = async (e, material) => {
    e.preventDefault();
    e.stopPropagation();
    if (!material?.materialId) {
      showToast('This file is no longer available.', 'error');
      return;
    }
    try {
      setDownloadingId(material.materialId);
      const { blob, contentDisposition } = await getCourseMaterialFileBlob(material.materialId, { download: true });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fallbackName = getFileNameFromResourceUrl(material.resourceUrl, material.title || 'course-material');
      link.href = blobUrl;
      link.download = getFileNameFromContentDisposition(contentDisposition, fallbackName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast('This file is no longer available.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // UC16-UI06: Chuyển sang AI Workspace và gửi đủ thông tin URL & Title để map đúng Learning_Material
  function handleOpenInAIWorkspace(material) {
    navigate(
      `/learner/ai-workspace?courseId=${courseId}&sourceUrl=${encodeURIComponent(material.resourceUrl || '')}&title=${encodeURIComponent(material.title || '')}&cmId=${material.materialId}`
    );
  }

  // UC16-UI02: Categorized Course Materials
  const filteredMaterials = materials.filter((mat) => {
    if (activeCategory === 'PDF') return (mat.fileType || '').toLowerCase().includes('pdf');
    if (activeCategory === 'DOCX') return (mat.fileType || '').toLowerCase().includes('word') || (mat.fileType || '').toLowerCase().includes('docx');
    if (activeCategory === 'LINK') return mat.resourceType === 'LINK';
    return true;
  });

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading materials list...</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
            <Link to="/learner/my-courses" className="hover:text-blue-600 transition-colors">My Courses</Link>
            <span>/</span>
            <Link to={`/learner/courses/${course.courseId}`} className="hover:text-blue-600 transition-colors">{course.subjectName}</Link>
            <span>/</span>
            <span className="text-gray-700 font-bold">Study Materials</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Study Materials</h1>
        </div>

        {/* UC16-UI02: CATEGORY TABS */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-gray-100 shadow-xs">
          {['ALL', 'PDF', 'DOCX', 'LINK'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeCategory === cat ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* MATERIALS CONTAINER */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
        {filteredMaterials.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-3 font-bold">
              📂
            </div>
            {/* UC16-UI04: EXACT EMPTY MESSAGE */}
            <p className="text-sm font-bold text-gray-700">No materials have been uploaded for this class.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMaterials.map((material) => {
              const fileSize = formatFileSize(material.sizeBytes);
              const isLink = material.resourceType === 'LINK';
              const isDownloading = downloadingId === material.materialId;

              return (
                <div
                  key={material.materialId}
                  className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-blue-200 hover:shadow-xs transition-all bg-white"
                >
                  <div
                    onClick={() => handleOpenMaterialViewer(material)}
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-sm">
                      {isLink ? '🔗' : '📄'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-800 truncate hover:text-blue-600 transition-colors" title={material.title}>
                        {material.title || 'Untitled material'}
                      </h3>
                      {material.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{material.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold uppercase text-[9px]">
                          {isLink ? 'LINK' : material.fileType || 'Doc'}
                        </span>
                        {fileSize && <span>• {fileSize}</span>}
                        {material.uploadedAt && <span>• {formatDateTime(material.uploadedAt)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenInAIWorkspace(material)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                    >
                      <span>✨</span> AI Workspace
                    </button>
                    {!isLink && (
                      <button
                        type="button"
                        onClick={(e) => handleDownloadMaterial(e, material)}
                        disabled={isDownloading}
                        className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition shadow-xs disabled:opacity-50"
                      >
                        {isDownloading ? '⏳ Downloading...' : '⬇ Download'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenMaterialViewer(material)}
                      className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
                    >
                      {isLink ? 'Open Link' : '👁 View'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewerLoading && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-white px-5 py-3 rounded-2xl shadow-xl text-xs font-bold text-gray-700">Opening document...</div>
        </div>
      )}

      {/* BUILT-IN DOCUMENT VIEWER MODAL (UC16-UI03) */}
      <DocumentPreviewModal
        open={Boolean(viewingMaterial && previewFile)}
        title={viewingMaterial?.title}
        fileName={previewFile?.fileName}
        blob={previewFile?.blob}
        contentType={previewFile?.contentType}
        onClose={closeViewer}
        onDownload={(e) => handleDownloadMaterial(e, viewingMaterial)}
        downloading={downloadingId === viewingMaterial?.materialId}
      />
    </main>
  );
}