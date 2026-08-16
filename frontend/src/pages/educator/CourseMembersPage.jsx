import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';
import {
  approveEnrollment,
  getCourseMembers,
  rejectEnrollment,
  removeMember
} from '../../features/classroom/enrollmentApi';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

function formatDate(dateValue) {
  if (!dateValue) return 'N/A';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
}

export default function CourseMembersPage() {
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const { courseId: routeCourseId } = useParams();
  const courseId = routeCourseId || null;

  const [course, setCourse] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionTarget, setActionTarget] = useState(null);
  const [processingEnrollmentIds, setProcessingEnrollmentIds] = useState([]);
  const [actionNotice, setActionNotice] = useState(null);

  useEffect(() => {
    if (!courseId) {
      setCourse(null); setEnrollments([]); setUsers([]); setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadMembersPage() {
      try {
        setLoading(true); setLoadError('');
        const [courseResult, memberResult] = await Promise.all([
          getCourses(),
          getCourseMembers(courseId)
        ]);
        const courses = Array.isArray(courseResult?.courses) ? courseResult.courses : [];
        const foundCourse = courses.find((item) => String(item.courseId) === String(courseId)) || null;
        const memberRows = Array.isArray(memberResult?.members) ? memberResult.members : [];

        if (!cancelled) {
          setCourse(foundCourse);
          setEnrollments(memberRows.map((item) => item.enrollment).filter(Boolean));
          setUsers(memberRows.map((item) => item.learner).filter(Boolean));
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Unable to load course members.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadMembersPage();
    return () => { cancelled = true; };
  }, [courseId]);

  const courseEnrollments = useMemo(() => {
    return enrollments.filter((enrollment) => String(enrollment.courseId) === String(courseId));
  }, [enrollments, courseId]);

  const memberRows = useMemo(() => {
    return courseEnrollments.map((enrollment) => {
      const learner = users.find((user) => String(user.userId ?? user.id) === String(enrollment.learnerId));
      return {
        enrollment,
        learner: learner || { userId: enrollment.learnerId, displayName: 'Unknown Learner', email: 'N/A', avatarUrl: null }
      };
    });
  }, [courseEnrollments, users]);

  const pendingMembers = useMemo(() => memberRows.filter(({ enrollment }) => enrollment.status === 'PENDING'), [memberRows]);
  const approvedMembers = useMemo(() => memberRows.filter(({ enrollment }) => enrollment.status === 'APPROVED'), [memberRows]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading class members...</p>
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

  async function refreshMemberRows() {
    const memberResult = await getCourseMembers(courseId);
    const memberRows = Array.isArray(memberResult?.members) ? memberResult.members : [];
    setEnrollments(memberRows.map((item) => item.enrollment).filter(Boolean));
    setUsers(memberRows.map((item) => item.learner).filter(Boolean));
  }

  const isArchived = course.status === 'ARCHIVED';

  async function handleApprove(enrollment, learner) {
    if (isArchived) return;

    const enrollmentId = enrollment.enrollmentId;
    if (processingEnrollmentIds.includes(enrollmentId)) return;

    const learnerName = learner?.displayName || learner?.fullname || learner?.email || 'this Learner';
    const confirmed = await confirm({
      title: 'Approve Enrollment Request?',
      message: `Are you sure you want to approve ${learnerName}'s enrollment request? The Learner will gain access to this Course.`,
      confirmLabel: 'Approve',
      cancelLabel: 'Cancel',
      tone: 'success'
    });
    if (!confirmed) return;

    setProcessingEnrollmentIds((prev) => [...prev, enrollmentId]);
    setActionNotice({
      type: 'processing',
      message: `Approving ${learnerName}... Please wait while Course and AI Workspace access are prepared.`
    });

    try {
      const result = await approveEnrollment(enrollmentId);
      const updatedEnrollment = result.enrollment;

      setEnrollments((prev) => prev.map((item) =>
        String(item.enrollmentId) === String(updatedEnrollment.enrollmentId)
          ? { ...item, ...updatedEnrollment }
          : item
      ));

      const successMessage = result.message || 'Enrollment approved successfully.';
      showToast(successMessage, result.workspaceReady === false ? 'warning' : 'success');
      setActionNotice({
        type: result.workspaceReady === false ? 'warning' : 'success',
        message: successMessage
      });
    } catch (error) {
      // A stale UI can happen when the first approval request completed in the DB
      // but the browser did not receive its response. Refresh instead of showing a
      // raw backend rule such as "Only a pending enrollment...".
      if (
        error.code === 'ENROLLMENT_NOT_PENDING' ||
        error.code === 'ENROLLMENT_ALREADY_PROCESSED'
      ) {
        try {
          await refreshMemberRows();
        } catch (refreshError) {
          console.error('[Enrollment Refresh Error]:', refreshError);
        }

        const message = 'This enrollment request has already been processed. The member list has been refreshed.';
        showToast(message, 'info');
        setActionNotice({ type: 'info', message });
      } else {
        const message = error.message || 'Unable to approve enrollment. Please try again.';
        showToast(message, 'error');
        setActionNotice({ type: 'error', message });
      }
    } finally {
      setProcessingEnrollmentIds((prev) => prev.filter((id) => String(id) !== String(enrollmentId)));
    }
  }

  function openRejectDialog(enrollment, learner) {
    if (isArchived) return;
    setActionTarget({ type: 'REJECT', enrollment, learner });
  }

  function openRemoveDialog(enrollment, learner) {
    if (isArchived) return;
    setActionTarget({ type: 'REMOVE', enrollment, learner });
  }

  async function confirmAction() {
    if (!actionTarget) return;
    const { type, enrollment: targetEnrollment } = actionTarget;

    try {
      if (type === 'REJECT') {
        const result = await rejectEnrollment(targetEnrollment.enrollmentId);
        const updatedEnrollment = result.enrollment;
        setEnrollments((prev) => prev.map((e) => String(e.enrollmentId) === String(updatedEnrollment.enrollmentId) ? { ...e, ...updatedEnrollment } : e));
      } else if (type === 'REMOVE') {
        const result = await removeMember(targetEnrollment.enrollmentId);
        const updatedEnrollment = result.enrollment;
        setEnrollments((prev) => prev.map((e) => String(e.enrollmentId) === String(updatedEnrollment.enrollmentId) ? { ...e, ...updatedEnrollment } : e));
      }
      setActionTarget(null);
    } catch (error) {
      alert(error.message || 'Action failed.');
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
            <span className="text-gray-700">Members</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Class Members</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">{approvedMembers.length} enrolled</span>
          {pendingMembers.length > 0 && (
            <span className="text-xs font-black text-amber-700 bg-amber-100 px-3 py-1.5 rounded-xl animate-pulse">
              {pendingMembers.length} pending
            </span>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {actionNotice && (
          <div className={`border text-xs font-bold rounded-2xl px-5 py-4 flex items-center justify-between gap-4 ${
            actionNotice.type === 'processing'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : actionNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : actionNotice.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : actionNotice.type === 'info'
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <div className="flex items-center gap-3">
              {actionNotice.type === 'processing' && (
                <span className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin flex-shrink-0"></span>
              )}
              <p>{actionNotice.message}</p>
            </div>
            {actionNotice.type !== 'processing' && (
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="text-current opacity-60 hover:opacity-100 transition"
                aria-label="Dismiss enrollment notification"
              >
                ×
              </button>
            )}
          </div>
        )}

        {isArchived && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-2xl px-5 py-4 flex items-center gap-3">
            <span>⚠️</span>
            <p>This course is archived. Member information is available for viewing only.</p>
          </div>
        )}

        {/* PENDING REQUESTS SECTION */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900">Pending Enrollment Requests</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Review students requesting access to this course.</p>
            </div>
            <span className="text-xs font-black text-amber-700 bg-amber-50 px-3 py-1 rounded-full">{pendingMembers.length}</span>
          </div>

          {pendingMembers.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400">No pending enrollment requests.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Learner</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Requested Date</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                  {pendingMembers.map(({ enrollment, learner }) => (
                    <tr key={enrollment.enrollmentId} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4"><LearnerIdentity learner={learner} /></td>
                      <td className="px-6 py-4 text-gray-500">{learner.email}</td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(enrollment.requestedAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={isArchived || processingEnrollmentIds.includes(enrollment.enrollmentId)}
                            onClick={() => handleApprove(enrollment, learner)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed min-w-[84px]"
                          >
                            {processingEnrollmentIds.includes(enrollment.enrollmentId) ? 'Approving...' : 'Approve'}
                          </button>
                          <button disabled={isArchived || processingEnrollmentIds.includes(enrollment.enrollmentId)} onClick={() => openRejectDialog(enrollment, learner)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed">Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ENROLLED LEARNERS SECTION */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900">Enrolled Learners</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Students actively enrolled in this class.</p>
            </div>
            <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{approvedMembers.length}</span>
          </div>

          {approvedMembers.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400">No learners currently enrolled.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Learner</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Joined Date</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                  {approvedMembers.map(({ enrollment, learner }) => (
                    <tr key={enrollment.enrollmentId} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4"><LearnerIdentity learner={learner} /></td>
                      <td className="px-6 py-4 text-gray-500">{learner.email}</td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(enrollment.approvedAt)}</td>
                      <td className="px-6 py-4">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">Approved</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/educator/analytics?courseId=${course.courseId}`} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl shadow-xs transition">Analytics</Link>
                          <button disabled={isArchived} onClick={() => openRemoveDialog(enrollment, learner)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl shadow-xs transition disabled:opacity-40">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* CONFIRM ACTION MODAL */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl font-bold mb-4 ${actionTarget.type === 'REMOVE' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
              {actionTarget.type === 'REMOVE' ? '⚠️' : '❓'}
            </div>
            <h2 className="text-lg font-black text-gray-900">
              {actionTarget.type === 'REJECT' ? 'Reject Request?' : 'Remove Learner?'}
            </h2>
            <p className="text-xs text-gray-500 mt-2 font-medium">
              {actionTarget.type === 'REJECT' ? 'This learner will not be added to the class.' : 'This learner will lose access to course materials and AI workspace.'}
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded-2xl text-xs font-bold text-gray-800 border border-gray-100 truncate">
              {actionTarget.learner.displayName || actionTarget.learner.email}
            </div>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={() => setActionTarget(null)} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition">Cancel</button>
              <button onClick={confirmAction} className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition ${actionTarget.type === 'REMOVE' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LearnerIdentity({ learner }) {
  const displayName = learner.displayName || learner.fullname || 'Unknown Learner';
  return (
    <div className="flex items-center gap-3">
      {learner.avatarUrl ? (
        <img src={learner.avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black border border-blue-100">
          {getInitials(displayName)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-900 truncate">{displayName}</p>
        <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">Learner</p>
      </div>
    </div>
  );
}