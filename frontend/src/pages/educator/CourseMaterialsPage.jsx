import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';
import {
  addCourseMaterial,
  deleteCourseMaterial,
  getCourseMaterials,
  updateCourseMaterial,
  reorderCourseMaterials
} from '../../features/classroom/courseContentApi';

function getMaterialOrder(material) {
  const order = Number(material.orderIndex);
  if (Number.isFinite(order) && order > 0) return order;
  const materialId = Number(material.materialId);
  return Number.isFinite(materialId) ? materialId : 0;
}

function createEmptyForm() {
  return { title: '', description: '', resourceType: 'FILE', file: null, fileName: '', resourceUrl: '' };
}

export default function CourseMaterialsPage() {
  const { courseId: routeCourseId } = useParams();
  const courseId = routeCourseId || null;

  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [loadError, setLoadError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!courseId) {
      setCourse(null); setMaterials([]); setLoadError(''); setLoading(false);
      return;
    }
    let cancelled = false;
    async function loadMaterialsPage() {
      try {
        setLoading(true); setLoadError('');
        const [courseResult, materialResult] = await Promise.all([
          getCourses(),
          getCourseMaterials(courseId)
        ]);
        const courses = Array.isArray(courseResult?.courses) ? courseResult.courses : [];
        const foundCourse = courses.find((item) => String(item.courseId) === String(courseId)) || null;
        const loadedMaterials = Array.isArray(materialResult?.materials) ? materialResult.materials : [];

        if (!cancelled) {
          setCourse(foundCourse);
          setMaterials(loadedMaterials);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Unable to load course materials.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadMaterialsPage();
    return () => { cancelled = true; };
  }, [courseId]);

  const courseMaterials = useMemo(() => {
    return materials
      .filter((m) => String(m.courseId) === String(courseId))
      .sort((a, b) => getMaterialOrder(a) - getMaterialOrder(b));
  }, [materials, courseId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading course materials...</p>
        </div>
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50 space-y-4">
        <p className="text-sm font-bold text-red-500">{loadError || 'Course not found.'}</p>
        <Link to="/educator/courses" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition">
          Back to My Courses
        </Link>
      </div>
    );
  }

  const isArchived = course.status === 'ARCHIVED';
  const editingMaterial = editingMaterialId !== null ? materials.find((m) => String(m.materialId) === String(editingMaterialId)) || null : null;
  const hasExistingFile = editingMaterial?.resourceType === 'FILE' && Boolean(editingMaterial?.resourceUrl);

  function openAddModal() {
    setEditingMaterialId(null); setForm(createEmptyForm()); setErrors({}); setIsModalOpen(true);
  }

  function openEditModal(material) {
    setEditingMaterialId(material.materialId);
    setForm({
      title: material.title || '',
      description: material.description || '',
      resourceType: material.resourceType || 'FILE',
      file: null,
      fileName: material.fileName || '',
      resourceUrl: material.resourceUrl || ''
    });
    setErrors({}); setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false); setEditingMaterialId(null); setForm(createEmptyForm()); setErrors({});
  }

  function handleResourceTypeChange(type) {
    setForm((prev) => ({
      ...prev, resourceType: type, file: null, fileName: '', resourceUrl: type === 'LINK' && prev.resourceType === 'LINK' ? prev.resourceUrl : ''
    }));
    setErrors((prev) => ({ ...prev, fileName: null, resourceUrl: null }));
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, file: file, fileName: file?.name || '' }));
    setErrors((prev) => ({ ...prev, fileName: null }));
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function validateMaterial() {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = 'Title is required.';
    if (form.resourceType === 'FILE' && !form.file && !hasExistingFile) nextErrors.fileName = 'Please choose a file.';
    if (form.resourceType === 'LINK' && !form.resourceUrl.trim()) nextErrors.resourceUrl = 'Link URL is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveMaterial() {
    if (!validateMaterial()) return;
    const formData = new FormData();
    formData.append('title', form.title.trim());
    formData.append('description', form.description.trim());
    formData.append('resourceType', form.resourceType);

    if (form.resourceType === 'FILE') {
      if (form.file) formData.append('file', form.file);
    } else {
      formData.append('linkUrl', form.resourceUrl.trim());
    }

    try {
      if (editingMaterialId !== null) {
        const result = await updateCourseMaterial(editingMaterialId, formData);
        setMaterials((prev) => prev.map((m) => String(m.materialId) === String(result.material.materialId) ? { ...m, ...result.material } : m));
      } else {
        const result = await addCourseMaterial(courseId, formData);
        setMaterials((prev) => [...prev, result.material]);
      }
      closeModal();
    } catch (error) {
      alert(error.message || 'Unable to save course material.');
    }
  }

  async function handleMoveMaterial(materialId, direction) {
    if (isArchived || reordering) return;
    const currentIndex = courseMaterials.findIndex((m) => String(m.materialId) === String(materialId));
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= courseMaterials.length) return;

    const prevMaterials = materials;
    const reorderedList = [...courseMaterials];
    [reorderedList[currentIndex], reorderedList[targetIndex]] = [reorderedList[targetIndex], reorderedList[currentIndex]];
    const reordered = reorderedList.map((m, i) => ({ ...m, orderIndex: i + 1 }));
    const reorderedMap = new Map(reordered.map((m) => [String(m.materialId), m]));

    setMaterials((prev) => prev.map((m) => reorderedMap.get(String(m.materialId)) || m));
    try {
      setReordering(true);
      await reorderCourseMaterials(courseId, reordered.map((m) => ({ materialId: m.materialId, orderIndex: m.orderIndex })));
    } catch (error) {
      setMaterials(prevMaterials);
      alert(error.message || 'Unable to reorder materials.');
    } finally {
      setReordering(false);
    }
  }

  async function handleDeleteMaterial() {
    if (!materialToDelete) return;
    try {
      await deleteCourseMaterial(materialToDelete.materialId);
      setMaterials((prev) => prev.filter((m) => String(m.materialId) !== String(materialToDelete.materialId)));
      setMaterialToDelete(null);
    } catch (error) {
      alert(error.message || 'Unable to delete material.');
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1">
            <Link to="/educator/courses" className="hover:text-blue-600 transition">My Courses</Link>
            <span>/</span>
            <Link to={`/educator/courses/${course.courseId}`} className="hover:text-blue-600 transition">{course.subjectName}</Link>
            <span>/</span>
            <span className="text-gray-700 truncate">Materials</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Course Materials</h1>
        </div>
        {!isArchived && (
          <button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition">
            + Add Material
          </button>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {isArchived && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p>This course is archived.</p>
              <p className="font-medium text-amber-700 mt-0.5">Materials are available for viewing only.</p>
            </div>
          </div>
        )}

        {courseMaterials.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm py-16 px-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold mb-4">📚</div>
            <h2 className="text-base font-black text-gray-900">No materials uploaded</h2>
            <p className="text-xs text-gray-500 mt-2 font-medium">Add files or links to provide learning resources for this course.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {courseMaterials.map((material, index) => (
              <div key={material.materialId} className="p-6 flex items-start justify-between gap-5 hover:bg-gray-50/50 transition">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-[10px] font-black uppercase tracking-widest ${material.resourceType === 'LINK' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                    {material.resourceType === 'LINK' ? '🔗' : '📄'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-gray-800 truncate" title={material.title}>
                      {material.title || 'Untitled Material'}
                    </h3>
                    {material.resourceType === 'FILE' && material.fileName && (
                      <p className="text-[11px] font-semibold text-blue-600 mt-1 truncate" title={material.fileName}>{material.fileName}</p>
                    )}
                    {material.description && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{material.description}</p>
                    )}
                  </div>
                </div>

                {!isArchived && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleMoveMaterial(material.materialId, -1)} disabled={index === 0 || reordering} className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-2 rounded-xl hover:bg-gray-200 disabled:opacity-40 transition">↑</button>
                    <button onClick={() => handleMoveMaterial(material.materialId, 1)} disabled={index === courseMaterials.length - 1 || reordering} className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-2 rounded-xl hover:bg-gray-200 disabled:opacity-40 transition">↓</button>
                    <button onClick={() => openEditModal(material)} className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition shadow-xs">Edit</button>
                    <button onClick={() => setMaterialToDelete(material)} className="text-xs font-bold text-red-600 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition shadow-xs">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="text-base font-black text-gray-900">{editingMaterialId !== null ? 'Edit Material' : 'Add Material'}</h2>
              <button onClick={closeModal} className="w-8 h-8 rounded-full bg-white hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm transition">✕</button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-700">Title <span className="text-red-500">*</span></label>
                <input type="text" value={form.title} onChange={(e) => updateForm('title', e.target.value)} className={`mt-1.5 w-full rounded-xl border px-4 py-3 text-xs outline-none focus:border-blue-500 bg-gray-50 focus:bg-white transition ${errors.title ? 'border-red-400' : 'border-gray-200'}`} placeholder="E.g., Week 1 Reading..." />
                {errors.title && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => updateForm('description', e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-xs outline-none focus:border-blue-500 bg-gray-50 focus:bg-white resize-y transition" placeholder="Optional brief overview..." />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 mb-2 block">Resource Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input type="radio" name="resourceType" value="FILE" checked={form.resourceType === 'FILE'} onChange={() => handleResourceTypeChange('FILE')} className="accent-blue-600" /> File Upload
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input type="radio" name="resourceType" value="LINK" checked={form.resourceType === 'LINK'} onChange={() => handleResourceTypeChange('LINK')} className="accent-blue-600" /> External Link
                  </label>
                </div>
              </div>

              {form.resourceType === 'FILE' && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">File Attachment <span className="text-red-500">*</span></label>
                  <input id="upload-mat-file" type="file" className="hidden" onChange={handleFileChange} />
                  
                  {hasExistingFile && !form.file ? (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-lg">📄</span>
                        <span className="text-xs font-bold text-blue-900 truncate">{editingMaterial?.fileName || 'Current File'}</span>
                      </div>
                      <label htmlFor="upload-mat-file" className="text-xs font-bold text-blue-600 hover:underline cursor-pointer flex-shrink-0">Replace</label>
                    </div>
                  ) : !form.file ? (
                    <label htmlFor="upload-mat-file" className={`block w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${errors.fileName ? 'border-red-300 bg-red-50/30' : 'border-gray-200 bg-gray-50 hover:bg-blue-50/30 hover:border-blue-300'}`}>
                      <div className="text-2xl mb-2">📁</div>
                      <p className="text-xs font-bold text-gray-700">Click to browse from your device</p>
                    </label>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-lg">✅</span>
                        <div className="truncate">
                          <p className="text-xs font-bold text-emerald-900 truncate">{form.file.name}</p>
                          <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{(form.file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setForm(p => ({ ...p, file: null, fileName: '' }))} className="text-xs font-bold text-red-500 hover:underline">Remove</button>
                    </div>
                  )}
                  {errors.fileName && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.fileName}</p>}
                </div>
              )}

              {form.resourceType === 'LINK' && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">Link URL <span className="text-red-500">*</span></label>
                  <input type="url" value={form.resourceUrl} onChange={(e) => updateForm('resourceUrl', e.target.value)} placeholder="https://..." className={`w-full rounded-xl border px-4 py-3 text-xs outline-none focus:border-blue-500 bg-gray-50 focus:bg-white transition ${errors.resourceUrl ? 'border-red-400' : 'border-gray-200'}`} />
                  {errors.resourceUrl && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.resourceUrl}</p>}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition">Cancel</button>
              <button type="button" onClick={handleSaveMaterial} className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition">
                {editingMaterialId !== null ? 'Save Changes' : 'Upload Material'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {materialToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
            <div className="w-14 h-14 mx-auto bg-red-50 text-red-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">🗑️</div>
            <h2 className="text-lg font-black text-gray-900">Remove Material?</h2>
            <p className="text-xs text-gray-500 mt-2 font-medium">This material will be removed from all Learners' synchronized workspaces. This action cannot be undone.</p>
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-800 truncate border border-gray-100">
              {materialToDelete.title}
            </div>
            <div className="flex justify-center gap-3 mt-6">
              <button type="button" onClick={() => setMaterialToDelete(null)} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition">Cancel</button>
              <button type="button" onClick={handleDeleteMaterial} className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-md transition">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}