import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createCourse, getCourses, updateCourse } from '../../features/classroom/courseApi';

export default function CourseBuilderPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const isEditMode = Boolean(courseId);

  const [subjectName, setSubjectName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    if (!isEditMode) return;
    async function loadCourse() {
      try {
        const result = await getCourses();
        const courses = Array.isArray(result?.courses) ? result.courses : [];
        const course = courses.find((item) => String(item.courseId) === String(courseId));
        if (course) {
          setSubjectName(course.subjectName || '');
          setCourseCode(course.courseCode || '');
          setDescription(course.description || '');
          setStatus(course.status || 'ACTIVE');
        }
      } catch (error) {
        console.error('Unable to load course:', error);
      }
    }
    loadCourse();
  }, [courseId, isEditMode]);

  function validateForm() {
    const nextErrors = {};
    if (!subjectName.trim()) nextErrors.subjectName = 'Subject Name is required.';
    if (!courseCode.trim()) nextErrors.courseCode = 'Course Code is required.';

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please complete all required fields');
      return false;
    }

    setFormError('');
    return true;
  }

  async function handleSave() {
    if (saveInFlightRef.current) return;
    if (!validateForm()) return;

    saveInFlightRef.current = true;
    setSaving(true);

    try {
      setFormError('');
      const payload = { subjectName: subjectName.trim(), courseCode: courseCode.trim(), description: description.trim() };
      if (isEditMode) {
        await updateCourse(courseId, payload);
        navigate(`/educator/courses/${courseId}`);
      } else {
        const result = await createCourse(payload);
        navigate(`/educator/courses/${result.course.courseId}`);
      }
    } catch (error) {
      setFormError(error.message || 'Unable to save course.');
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  function handleCancel() {
    // UC13 Alternative Flow 4:
    // - Creating: discard the unsaved draft and return to Course Management.
    // - Editing: discard the unsaved changes and return to the original Course details.
    navigate(isEditMode ? `/educator/courses/${courseId}` : '/educator/courses');
  }

  const isArchived = status === 'ARCHIVED';

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50">
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">{isEditMode ? 'Edit Course' : 'Create New Course'}</h1>
          <p className="text-xs text-gray-500 font-medium mt-1">Configure your course details below.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleCancel} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition">Cancel</button>
          <button onClick={handleSave} disabled={isArchived || saving} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50">
            {saving ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Course')}
          </button>
        </div>
      </header>

      <main className="p-8 max-w-3xl mx-auto w-full space-y-6">
        {isArchived && <div className="bg-amber-50 text-amber-800 text-xs font-bold p-4 rounded-2xl border border-amber-200">This course is archived and cannot be edited.</div>}

        {formError && (
          <div role="alert" className="bg-red-50 text-red-700 text-xs font-bold p-4 rounded-2xl border border-red-200">
            {formError}
          </div>
        )}
        
        <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Subject Name *</label>
            <input
              value={subjectName}
              onChange={(e) => {
                setSubjectName(e.target.value);
                if (errors.subjectName) setErrors((prev) => ({ ...prev, subjectName: undefined }));
                if (formError) setFormError('');
              }}
              disabled={isArchived}
              aria-invalid={Boolean(errors.subjectName)}
              className={`w-full rounded-2xl border p-4 text-xs font-semibold focus:border-blue-500 outline-none bg-gray-50 transition ${errors.subjectName ? 'border-red-400' : 'border-gray-200'}`}
              placeholder="e.g. Advanced AI"
            />
            {errors.subjectName && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.subjectName}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Course Code *</label>
            <input
              value={courseCode}
              onChange={(e) => {
                setCourseCode(e.target.value);
                if (errors.courseCode) setErrors((prev) => ({ ...prev, courseCode: undefined }));
                if (formError) setFormError('');
              }}
              disabled={isArchived}
              aria-invalid={Boolean(errors.courseCode)}
              className={`w-full rounded-2xl border p-4 text-xs font-semibold focus:border-blue-500 outline-none bg-gray-50 transition ${errors.courseCode ? 'border-red-400' : 'border-gray-200'}`}
              placeholder="e.g. AI-402"
            />
            {errors.courseCode && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.courseCode}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Description</label>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (formError) setFormError('');
              }}
              disabled={isArchived}
              className="w-full rounded-2xl border border-gray-200 p-4 text-xs font-semibold focus:border-blue-500 outline-none bg-gray-50 transition resize-none"
              placeholder="Describe the course content..."
            />
          </div>
        </section>
      </main>
    </div>
  );
}