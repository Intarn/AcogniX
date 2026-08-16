import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';
import { getCourseMembers } from '../../features/classroom/enrollmentApi';
import {
  getAssessmentSubmissions,
  getManagedAssessments
} from '../../features/assessment/assessmentApi';

function getInitials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getAssessmentStatusBadge(status) {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'SCHEDULED':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'IN_PROGRESS':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'CLOSED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

export default function DashboardPage() {
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [users, setUsers] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setLoadError('');

        // 1. Load Courses
        const courseResult = await getCourses();
        const loadedCourses = Array.isArray(courseResult?.courses)
          ? courseResult.courses
          : [];

        // 2. Load Members & Assessments
        const courseBundles = await Promise.all(
          loadedCourses.map(async (course) => {
            const [memberResult, assessmentResult] = await Promise.all([
              getCourseMembers(course.courseId).catch(() => ({ members: [] })),
              getManagedAssessments(course.courseId).catch(() => ({ assessments: [] }))
            ]);

            return {
              course,
              members: Array.isArray(memberResult?.members) ? memberResult.members : [],
              assessments: Array.isArray(assessmentResult?.assessments) ? assessmentResult.assessments : []
            };
          })
        );

        const loadedEnrollments = [];
        const learnerMap = new Map();
        const loadedAssessments = [];

        courseBundles.forEach((bundle) => {
          bundle.members.forEach((entry) => {
            const enrollment = entry.enrollment || entry;
            const learner = entry.learner || entry.user || null;
            loadedEnrollments.push(enrollment);

            const learnerId = learner?.userId ?? learner?.id;
            if (learnerId) {
              learnerMap.set(String(learnerId), learner);
            }
          });

          loadedAssessments.push(...bundle.assessments);
        });

        // 3. Load Submissions
        const submissionGroups = await Promise.all(
          loadedAssessments
            .filter((assessment) => assessment.status !== 'DRAFT')
            .map(async (assessment) => {
              const result = await getAssessmentSubmissions(assessment.assessmentId).catch(() => ({ submissions: [] }));
              const entries = Array.isArray(result?.submissions) ? result.submissions : [];
              return entries.map((entry) => entry?.submission || entry);
            })
        );

        if (cancelled) return;

        setCourses(loadedCourses);
        setEnrollments(loadedEnrollments);
        setUsers(Array.from(learnerMap.values()));
        setAssessments(loadedAssessments);
        setSubmissions(submissionGroups.flat());
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to load educator dashboard:', error);
          setCourses([]);
          setEnrollments([]);
          setUsers([]);
          setAssessments([]);
          setSubmissions([]);
          setLoadError(error.message || 'Unable to load dashboard data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCourses = useMemo(() => {
    return courses
      .filter((course) => course.status === 'ACTIVE')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [courses]);

  const approvedEnrollments = useMemo(() => {
    return enrollments.filter((enrollment) => enrollment.status === 'APPROVED');
  }, [enrollments]);

  const uniqueLearnerIds = useMemo(() => {
    return new Set(approvedEnrollments.map((enrollment) => String(enrollment.learnerId)));
  }, [approvedEnrollments]);

  const pendingEnrollments = useMemo(() => {
    return enrollments.filter((enrollment) => enrollment.status === 'PENDING');
  }, [enrollments]);

  const pendingRequestRows = useMemo(() => {
    return pendingEnrollments
      .map((enrollment) => {
        const learner = users.find(
          (user) => String(user.userId ?? user.id) === String(enrollment.learnerId)
        );
        const course = courses.find(
          (item) => String(item.courseId) === String(enrollment.courseId)
        );

        if (!course) return null;

        return {
          enrollment,
          learner: learner || {
            userId: enrollment.learnerId,
            displayName: 'Unknown Learner',
            email: 'N/A',
            avatarUrl: null
          },
          course
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.enrollment.requestedAt || 0) - new Date(a.enrollment.requestedAt || 0));
  }, [pendingEnrollments, users, courses]);

  const pendingReviewSubmissions = useMemo(() => {
    return submissions.filter((submission) => submission.status === 'PENDING_REVIEW');
  }, [submissions]);

  const assessmentsRequiringReview = useMemo(() => {
    const reviewMap = new Map();

    pendingReviewSubmissions.forEach((submission) => {
      const assessment = assessments.find(
        (item) => String(item.assessmentId) === String(submission.assessmentId)
      );
      if (!assessment) return;

      const course = courses.find(
        (item) => String(item.courseId) === String(assessment.courseId)
      );
      if (!course) return;

      const key = String(assessment.assessmentId);
      if (!reviewMap.has(key)) {
        reviewMap.set(key, { assessment, course, count: 0 });
      }
      reviewMap.get(key).count += 1;
    });

    return Array.from(reviewMap.values()).sort((a, b) => b.count - a.count);
  }, [pendingReviewSubmissions, assessments, courses]);

  const activeCourseCards = useMemo(() => {
    return activeCourses.map((course) => {
      const learnerCount = approvedEnrollments.filter(
        (enrollment) => String(enrollment.courseId) === String(course.courseId)
      ).length;

      const pendingCount = pendingEnrollments.filter(
        (enrollment) => String(enrollment.courseId) === String(course.courseId)
      ).length;

      return { course, learnerCount, pendingCount };
    });
  }, [activeCourses, approvedEnrollments, pendingEnrollments]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Synchronizing Educator Dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8 bg-gray-50/50">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Educator Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Overview of your active courses, student enrollment requests, and pending grading tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/educator/courses/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-md shadow-blue-600/15 hover:shadow-lg transition-all flex items-center gap-2"
          >
            <span>+</span> Create New Course
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold">
          {loadError}
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Active Courses"
          value={activeCourses.length}
          helper="Courses currently active"
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <MetricCard
          label="Total Students"
          value={uniqueLearnerIds.size}
          helper="Unique approved learners"
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <MetricCard
          label="Pending Requests"
          value={pendingEnrollments.length}
          helper="Awaiting your approval"
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <MetricCard
          label="Pending Reviews"
          value={pendingReviewSubmissions.length}
          helper="Submissions to grade"
          color="text-violet-600"
          bgColor="bg-violet-50"
        />
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT COLUMN: ACTIVE COURSES & ASSESSMENTS */}
        <div className="col-span-12 xl:col-span-8 space-y-6">
          {/* ACTIVE COURSES */}
          <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
              <div>
                <h2 className="text-base font-black text-gray-900">My Active Courses</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Recently updated courses under your instruction.</p>
              </div>
              <Link to="/educator/courses" className="text-xs font-bold text-blue-600 hover:underline">
                View All &rarr;
              </Link>
            </div>

            {activeCourseCards.length === 0 ? (
              <EmptySection message="No active courses yet. Click '+ Create New Course' to get started." />
            ) : (
              <div className="space-y-3">
                {activeCourseCards.slice(0, 5).map(({ course, learnerCount, pendingCount }) => (
                  <div
                    key={course.courseId}
                    className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-blue-200 hover:shadow-xs transition-all bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-lg font-bold">
                        📖
                      </div>
                      <div className="min-w-0">
                        <Link
                          to={`/educator/courses/${course.courseId}`}
                          className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors truncate block"
                          title={course.subjectName}
                        >
                          {course.subjectName}
                        </Link>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 font-semibold flex-wrap">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold uppercase text-[9px]">
                            {course.courseCode}
                          </span>
                          <span>•</span>
                          <span className="text-gray-600">{learnerCount} {learnerCount === 1 ? 'learner' : 'learners'}</span>
                          {pendingCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
                                {pendingCount} pending
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        to={`/educator/courses/${course.courseId}`}
                        className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold transition-all shadow-xs"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ASSESSMENTS REQUIRING REVIEW */}
          <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
              <div>
                <h2 className="text-base font-black text-gray-900">Assessments Requiring Review</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Submissions waiting for your manual review and scoring.</p>
              </div>
              <Link to="/educator/gradebook" className="text-xs font-bold text-blue-600 hover:underline">
                Gradebook &rarr;
              </Link>
            </div>

            {assessmentsRequiringReview.length === 0 ? (
              <EmptySection message="All submissions have been graded! No pending reviews." />
            ) : (
              <div className="space-y-3">
                {assessmentsRequiringReview.slice(0, 5).map(({ assessment, course, count }) => (
                  <div
                    key={assessment.assessmentId}
                    className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-amber-200 hover:shadow-xs transition-all bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 text-lg font-bold">
                        ✍️
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-900 truncate" title={assessment.title}>
                            {assessment.title}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${getAssessmentStatusBadge(assessment.status)}`}>
                            {assessment.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                          {course.subjectName} <span className="text-gray-300">•</span> {course.courseCode}
                        </p>
                        <p className="text-[11px] font-bold text-amber-600 mt-1">
                          {count} {count === 1 ? 'submission' : 'submissions'} pending review
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/submissions`}
                      className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition shadow-xs flex-shrink-0"
                    >
                      Grade Now
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: PENDING ENROLLMENT REQUESTS & QUICK ACTIONS */}
        <div className="col-span-12 xl:col-span-4 space-y-6">
          {/* PENDING REQUESTS */}
          <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
              <div>
                <h2 className="text-base font-black text-gray-900">Enrollment Requests</h2>
                <p className="text-[11px] text-gray-400 font-medium">Students requesting access.</p>
              </div>
              <span className="text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                {pendingRequestRows.length}
              </span>
            </div>

            {pendingRequestRows.length === 0 ? (
              <EmptySection message="No pending enrollment requests." />
            ) : (
              <div className="space-y-3">
                {pendingRequestRows.slice(0, 5).map(({ enrollment, learner, course }) => (
                  <div key={enrollment.enrollmentId} className="bg-gray-50/60 p-3.5 rounded-2xl border border-gray-100 space-y-3">
                    <LearnerIdentity learner={learner} />
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded-md font-bold text-gray-600">
                          {course.courseCode}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatDate(enrollment.requestedAt)}
                        </p>
                      </div>
                      <Link
                        to={`/educator/courses/${course.courseId}/members`}
                        className="text-xs font-bold text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl transition shadow-xs"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* QUICK ACTIONS CARD */}
          <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-black text-gray-900">Quick Navigation</h2>
            <div className="space-y-2">
              <QuickAction to="/educator/courses/new" label="Create New Course" icon="➕" />
              <QuickAction to="/educator/courses" label="Manage All Courses" icon="📚" />
              <QuickAction to="/educator/students" label="Student Directory" icon="👥" />
              <QuickAction to="/educator/gradebook" label="Class Gradebook" icon="📊" />
              <QuickAction to="/educator/analytics" label="Class Analytics" icon="📈" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value, helper, color, bgColor }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase ${color} ${bgColor} px-2.5 py-1 rounded-full`}>
          {label}
        </span>
      </div>
      <div className="mt-4">
        <span className="text-3xl font-black text-gray-900">{value}</span>
        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{helper}</p>
      </div>
    </div>
  );
}

function LearnerIdentity({ learner }) {
  const displayName = learner.displayName || learner.fullname || 'Unknown Learner';

  return (
    <div className="flex items-center gap-3 min-w-0">
      {learner.avatarUrl ? (
        <img
          src={learner.avatarUrl}
          alt={displayName}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100 shadow-xs"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black flex-shrink-0 border border-blue-100">
          {getInitials(displayName)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-800 truncate">{displayName}</p>
        <p className="text-[10px] text-gray-400 truncate mt-0.5">{learner.email}</p>
      </div>
    </div>
  );
}

function QuickAction({ to, label, icon }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between p-3 bg-gray-50/70 hover:bg-blue-50/60 rounded-2xl border border-gray-100 text-xs font-bold text-gray-700 hover:text-blue-700 transition group shadow-xs"
    >
      <span className="flex items-center gap-2.5">
        <span>{icon}</span>
        {label}
      </span>
      <span className="text-gray-400 group-hover:translate-x-1 group-hover:text-blue-600 transition-transform">
        &rarr;
      </span>
    </Link>
  );
}

function EmptySection({ message }) {
  return (
    <div className="py-12 px-4 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
      <p className="text-xs font-bold text-gray-400">{message}</p>
    </div>
  );
}