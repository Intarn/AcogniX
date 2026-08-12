import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link
} from 'react-router';

import {
  getCourses
} from '../../features/classroom/courseApi';

import {
  getCourseMembers
} from '../../features/classroom/enrollmentApi';

import {
  getAssessmentSubmissions,
  getManagedAssessments
} from '../../features/assessment/assessmentApi';


function getInitials(name) {
  if (!name) {
    return '?';
  }


  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0)
    )
    .join('')
    .toUpperCase();
}


function formatDate(value) {
  if (!value) {
    return 'N/A';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'N/A';
  }


  return date.toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }
  );
}


function getAssessmentStatusClasses(
  status
) {
  switch (status) {
    case 'DRAFT':
      return `
        bg-gray-100
        text-gray-600
      `;

    case 'SCHEDULED':
      return `
        bg-blue-100
        text-blue-700
      `;

    case 'IN_PROGRESS':
      return `
        bg-amber-100
        text-amber-700
      `;

    case 'CLOSED':
      return `
        bg-green-100
        text-green-700
      `;

    default:
      return `
        bg-gray-100
        text-gray-600
      `;
  }
}


export default function DashboardPage() {
  const [
    courses,
    setCourses
  ] = useState([]);


  const [
    enrollments,
    setEnrollments
  ] = useState([]);


  const [
    users,
    setUsers
  ] = useState([]);


  const [
    assessments,
    setAssessments
  ] = useState([]);


  const [
    submissions,
    setSubmissions
  ] = useState([]);


  const [
    loading,
    setLoading
  ] = useState(true);


  const [
    loadError,
    setLoadError
  ] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setLoadError('');

        /*
        * =========================
        * COURSES
        * =========================
        */
        const courseResult =
          await getCourses();

        const loadedCourses =
          Array.isArray(
            courseResult?.courses
          )
            ? courseResult.courses
            : [];


        /*
        * =========================
        * MEMBERS + ASSESSMENTS
        * =========================
        */
        const courseBundles =
          await Promise.all(
            loadedCourses.map(
              async (course) => {
                const [
                  memberResult,
                  assessmentResult
                ] = await Promise.all([
                  getCourseMembers(
                    course.courseId
                  ),

                  getManagedAssessments(
                    course.courseId
                  )
                ]);

                return {
                  course,

                  members:
                    Array.isArray(
                      memberResult?.members
                    )
                      ? memberResult.members
                      : [],

                  assessments:
                    Array.isArray(
                      assessmentResult
                        ?.assessments
                    )
                      ? assessmentResult
                          .assessments
                      : []
                };
              }
            )
          );


        const loadedEnrollments = [];

        const learnerMap =
          new Map();

        const loadedAssessments = [];


        courseBundles.forEach(
          (bundle) => {
            bundle.members.forEach(
              (entry) => {
                const enrollment =
                  entry.enrollment ||
                  entry;

                const learner =
                  entry.learner ||
                  entry.user ||
                  null;

                loadedEnrollments.push(
                  enrollment
                );

                const learnerId =
                  learner?.userId ??
                  learner?.id;

                if (learnerId) {
                  learnerMap.set(
                    String(
                      learnerId
                    ),
                    learner
                  );
                }
              }
            );

            loadedAssessments.push(
              ...bundle.assessments
            );
          }
        );


        /*
        * =========================
        * SUBMISSIONS
        * =========================
        */
        const submissionGroups =
          await Promise.all(
            loadedAssessments
              .filter(
                (assessment) =>
                  assessment.status !==
                  'DRAFT'
              )
              .map(
                async (assessment) => {
                  const result =
                    await getAssessmentSubmissions(
                      assessment
                        .assessmentId
                    );

                  const entries =
                    Array.isArray(
                      result?.submissions
                    )
                      ? result.submissions
                      : [];

                  return entries.map(
                    (entry) =>
                      entry?.submission ||
                      entry
                  );
                }
              )
          );


        if (cancelled) {
          return;
        }


        setCourses(
          loadedCourses
        );

        setEnrollments(
          loadedEnrollments
        );

        setUsers(
          Array.from(
            learnerMap.values()
          )
        );

        setAssessments(
          loadedAssessments
        );

        setSubmissions(
          submissionGroups.flat()
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load educator dashboard:',
            error
          );

          setCourses([]);
          setEnrollments([]);
          setUsers([]);
          setAssessments([]);
          setSubmissions([]);

          setLoadError(
            error.message ||
            'Unable to load dashboard.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadDashboard();


    return () => {
      cancelled = true;
    };
  }, []);

  const activeCourses =
    useMemo(() => {
      return courses
        .filter(
          (course) =>
            course.status ===
            'ACTIVE'
        )
        .sort(
          (
            first,
            second
          ) => {
            const firstDate =
              new Date(
                first.updatedAt ||
                first.createdAt ||
                0
              ).getTime();


            const secondDate =
              new Date(
                second.updatedAt ||
                second.createdAt ||
                0
              ).getTime();


            return (
              secondDate -
              firstDate
            );
          }
        );
    }, [
      courses
    ]);


  /*
   * APPROVED ENROLLMENTS
   */
  const approvedEnrollments =
    useMemo(() => {
      return enrollments.filter(
        (enrollment) =>
          enrollment.status ===
          'APPROVED'
      );
    }, [
      enrollments
    ]);


  /*
   * UNIQUE LEARNERS
   */
  const uniqueLearnerIds =
    useMemo(() => {
      return new Set(
        approvedEnrollments.map(
          (enrollment) =>
            String(
              enrollment.learnerId
            )
        )
      );
    }, [
      approvedEnrollments
    ]);


  /*
   * PENDING REQUESTS
   */
  const pendingEnrollments =
    useMemo(() => {
      return enrollments.filter(
        (enrollment) =>
          enrollment.status ===
          'PENDING'
      );
    }, [
      enrollments
    ]);


  /*
   * Enrich pending requests
   * with learner and course.
   */
  const pendingRequestRows =
    useMemo(() => {
      return pendingEnrollments
        .map(
          (enrollment) => {
            const learner =
              users.find(
                (user) =>
                  String(
                    user.userId ??
                    user.id
                  ) ===
                  String(
                    enrollment.learnerId
                  )
              );


            const course =
              courses.find(
                (item) =>
                  String(
                    item.courseId
                  ) ===
                  String(
                    enrollment.courseId
                  )
              );


            if (!course) {
              return null;
            }


            return {
              enrollment,

              learner:
                learner || {
                  userId:
                    enrollment.learnerId,

                  displayName:
                    'Unknown Learner',

                  email:
                    'N/A',

                  avatarUrl:
                    null
                },

              course
            };
          }
        )
        .filter(Boolean)
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              second
                .enrollment
                .requestedAt ||
              0
            ).getTime() -
            new Date(
              first
                .enrollment
                .requestedAt ||
              0
            ).getTime()
        );
    }, [
      pendingEnrollments,
      users,
      courses
    ]);


  /*
   * PENDING REVIEW SUBMISSIONS
   */
  const pendingReviewSubmissions =
    useMemo(() => {
      return submissions.filter(
        (submission) =>
          submission.status ===
          'PENDING_REVIEW'
      );
    }, [
      submissions
    ]);


  /*
   * Group pending-review submissions
   * by assessment.
   */
  const assessmentsRequiringReview =
    useMemo(() => {
      const reviewMap =
        new Map();


      pendingReviewSubmissions.forEach(
        (submission) => {
          const assessment =
            assessments.find(
              (item) =>
                String(
                  item.assessmentId
                ) ===
                String(
                  submission.assessmentId
                )
            );


          if (!assessment) {
            return;
          }


          const course =
            courses.find(
              (item) =>
                String(
                  item.courseId
                ) ===
                String(
                  assessment.courseId
                )
            );


          if (!course) {
            return;
          }


          const key =
            String(
              assessment.assessmentId
            );


          if (
            !reviewMap.has(
              key
            )
          ) {
            reviewMap.set(
              key,
              {
                assessment,
                course,
                count: 0
              }
            );
          }


          reviewMap.get(
            key
          ).count += 1;
        }
      );


      return Array.from(
        reviewMap.values()
      ).sort(
        (
          first,
          second
        ) =>
          second.count -
          first.count
      );
    }, [
      pendingReviewSubmissions,
      assessments,
      courses
    ]);


  /*
   * Active course cards with
   * derived learner / pending counts.
   */
  const activeCourseCards =
    useMemo(() => {
      return activeCourses.map(
        (course) => {
          const learnerCount =
            approvedEnrollments.filter(
              (enrollment) =>
                String(
                  enrollment.courseId
                ) ===
                String(
                  course.courseId
                )
            ).length;


          const pendingCount =
            pendingEnrollments.filter(
              (enrollment) =>
                String(
                  enrollment.courseId
                ) ===
                String(
                  course.courseId
                )
            ).length;


          return {
            course,
            learnerCount,
            pendingCount
          };
        }
      );
    }, [
      activeCourses,
      approvedEnrollments,
      pendingEnrollments
    ]);


  return (
    <>
      {/* TOPBAR */}
      <header
        className="
          min-h-16
          bg-white
          border-b
          border-gray-100
          flex
          items-center
          justify-between
          gap-4
          px-6
          py-3
          flex-shrink-0
        "
      >
        <div>
          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Educator Dashboard
          </h1>


          <p
            className="
              text-xs
              text-gray-400
              mt-0.5
            "
          >
            Overview of your courses,
            learners and assessment
            activity.
          </p>
        </div>


        <Link
          to="/educator/courses/new"
          className="
            bg-blue-600
            hover:bg-blue-700
            text-white
            text-xs
            font-semibold
            px-4
            py-2
            rounded-lg
            shadow-sm
          "
        >
          + Create Course
        </Link>
      </header>


      {/* MAIN */}
      <main
        className="
          p-6
          space-y-6
        "
      >
        {loading && (
          <div
            className="
              bg-white
              border
              border-gray-100
              rounded-xl
              p-6
              text-sm
              text-gray-500
              text-center
            "
          >
            Loading dashboard...
          </div>
        )}


        {loadError && (
          <div
            className="
              bg-red-50
              border
              border-red-100
              rounded-xl
              px-4
              py-3
              text-sm
              text-red-600
            "
          >
            {
              loadError
            }
          </div>
        )}
        {/* KPI */}
        <div
          className="
            grid
            grid-cols-1
            sm:grid-cols-2
            xl:grid-cols-4
            gap-4
          "
        >
          <MetricCard
            label="Active Courses"
            value={
              activeCourses.length
            }
            helper="Courses currently available"
          />


          <MetricCard
            label="Total Students"
            value={
              uniqueLearnerIds.size
            }
            helper="Unique approved learners"
          />


          <MetricCard
            label="Pending Requests"
            value={
              pendingEnrollments.length
            }
            helper="Enrollment requests awaiting review"
          />


          <MetricCard
            label="Pending Reviews"
            value={
              pendingReviewSubmissions.length
            }
            helper="Submissions requiring grading"
          />
        </div>


        {/* MAIN GRID */}
        <div
          className="
            grid
            grid-cols-1
            xl:grid-cols-3
            gap-6
          "
        >
          {/* LEFT */}
          <div
            className="
              xl:col-span-2
              space-y-6
            "
          >
            {/* ACTIVE COURSES */}
            <section
              className="
                bg-white
                border
                border-gray-100
                rounded-xl
                shadow-sm
                overflow-hidden
              "
            >
              <div
                className="
                  px-5
                  py-4
                  border-b
                  border-gray-100
                  flex
                  items-center
                  justify-between
                  gap-4
                "
              >
                <div>
                  <h2
                    className="
                      text-base
                      font-bold
                      text-gray-800
                    "
                  >
                    My Active Courses
                  </h2>


                  <p
                    className="
                      text-xs
                      text-gray-400
                      mt-1
                    "
                  >
                    Recently updated
                    active courses.
                  </p>
                </div>


                <Link
                  to="/educator/courses"
                  className="
                    text-xs
                    font-semibold
                    text-blue-600
                    hover:underline
                  "
                >
                  View All
                </Link>
              </div>


              {activeCourseCards.length ===
              0 ? (
                <EmptySection
                  message="No active courses yet."
                />
              ) : (
                <div
                  className="
                    divide-y
                    divide-gray-100
                  "
                >
                  {activeCourseCards
                    .slice(
                      0,
                      5
                    )
                    .map(
                      ({
                        course,
                        learnerCount,
                        pendingCount
                      }) => (
                        <div
                          key={
                            course.courseId
                          }
                          className="
                            p-5
                            flex
                            items-center
                            justify-between
                            gap-5
                          "
                        >
                          <div
                            className="
                              flex
                              items-start
                              gap-4
                              min-w-0
                            "
                          >
                            <div
                              className="
                                w-10
                                h-10
                                rounded-lg
                                bg-blue-50
                                flex
                                items-center
                                justify-center
                                flex-shrink-0
                              "
                            >
                              <svg
                                className="
                                  w-5
                                  h-5
                                  text-blue-600
                                "
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                />
                              </svg>
                            </div>


                            <div
                              className="
                                min-w-0
                              "
                            >
                              <Link
                                to={
                                  `/educator/courses/${course.courseId}`
                                }
                                className="
                                  text-sm
                                  font-bold
                                  text-gray-800
                                  hover:text-blue-600
                                "
                              >
                                {
                                  course.subjectName
                                }
                              </Link>


                              <p
                                className="
                                  text-xs
                                  text-gray-400
                                  mt-1
                                "
                              >
                                {
                                  course.courseCode
                                }
                              </p>


                              <div
                                className="
                                  flex
                                  items-center
                                  flex-wrap
                                  gap-3
                                  mt-2
                                "
                              >
                                <span
                                  className="
                                    text-[11px]
                                    text-gray-500
                                  "
                                >
                                  {
                                    learnerCount
                                  }{' '}
                                  learners
                                </span>


                                {pendingCount >
                                  0 && (
                                  <span
                                    className="
                                      text-[11px]
                                      font-semibold
                                      text-amber-600
                                    "
                                  >
                                    {
                                      pendingCount
                                    }{' '}
                                    pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>


                          <Link
                            to={
                              `/educator/courses/${course.courseId}`
                            }
                            className="
                              text-xs
                              font-semibold
                              text-blue-600
                              bg-blue-50
                              hover:bg-blue-100
                              px-3
                              py-2
                              rounded-lg
                              flex-shrink-0
                            "
                          >
                            Open
                          </Link>
                        </div>
                      )
                    )}
                </div>
              )}
            </section>


            {/* ASSESSMENTS REQUIRING REVIEW */}
            <section
              className="
                bg-white
                border
                border-gray-100
                rounded-xl
                shadow-sm
                overflow-hidden
              "
            >
              <div
                className="
                  px-5
                  py-4
                  border-b
                  border-gray-100
                "
              >
                <h2
                  className="
                    text-base
                    font-bold
                    text-gray-800
                  "
                >
                  Assessments Requiring
                  Review
                </h2>


                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  Assessments with
                  submissions waiting
                  for manual grading.
                </p>
              </div>


              {assessmentsRequiringReview.length ===
              0 ? (
                <EmptySection
                  message="No submissions are currently waiting for review."
                />
              ) : (
                <div
                  className="
                    divide-y
                    divide-gray-100
                  "
                >
                  {assessmentsRequiringReview
                    .slice(
                      0,
                      5
                    )
                    .map(
                      ({
                        assessment,
                        course,
                        count
                      }) => (
                        <div
                          key={
                            assessment.assessmentId
                          }
                          className="
                            p-5
                            flex
                            items-center
                            justify-between
                            gap-5
                          "
                        >
                          <div
                            className="
                              min-w-0
                            "
                          >
                            <div
                              className="
                                flex
                                items-center
                                gap-2
                                flex-wrap
                              "
                            >
                              <p
                                className="
                                  text-sm
                                  font-semibold
                                  text-gray-800
                                "
                              >
                                {
                                  assessment.title
                                }
                              </p>


                              <span
                                className={`
                                  inline-flex
                                  rounded-full
                                  px-2.5
                                  py-1
                                  text-[10px]
                                  font-bold

                                  ${getAssessmentStatusClasses(
                                    assessment.status
                                  )}
                                `}
                              >
                                {
                                  assessment.status
                                }
                              </span>
                            </div>


                            <p
                              className="
                                text-xs
                                text-gray-400
                                mt-1
                              "
                            >
                              {
                                course.subjectName
                              }
                              {' · '}
                              {
                                course.courseCode
                              }
                            </p>


                            <p
                              className="
                                text-xs
                                font-semibold
                                text-amber-600
                                mt-2
                              "
                            >
                              {
                                count
                              }{' '}
                              {
                                count === 1
                                  ? 'submission'
                                  : 'submissions'
                              }{' '}
                              pending review
                            </p>
                          </div>


                          <Link
                            to={
                              `/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/submissions`
                            }
                            className="
                              text-xs
                              font-semibold
                              text-blue-600
                              bg-blue-50
                              hover:bg-blue-100
                              px-3
                              py-2
                              rounded-lg
                              flex-shrink-0
                            "
                          >
                            Review
                          </Link>
                        </div>
                      )
                    )}
                </div>
              )}
            </section>
          </div>


          {/* RIGHT */}
          <div
            className="
              space-y-6
            "
          >
            {/* PENDING REQUESTS */}
            <section
              className="
                bg-white
                border
                border-gray-100
                rounded-xl
                shadow-sm
                overflow-hidden
              "
            >
              <div
                className="
                  px-5
                  py-4
                  border-b
                  border-gray-100
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <div>
                  <h2
                    className="
                      text-base
                      font-bold
                      text-gray-800
                    "
                  >
                    Pending Requests
                  </h2>


                  <p
                    className="
                      text-xs
                      text-gray-400
                      mt-1
                    "
                  >
                    Recent enrollment
                    requests.
                  </p>
                </div>


                <span
                  className="
                    text-xs
                    font-bold
                    text-amber-700
                    bg-amber-100
                    rounded-full
                    px-2.5
                    py-1
                  "
                >
                  {
                    pendingRequestRows.length
                  }
                </span>
              </div>


              {pendingRequestRows.length ===
              0 ? (
                <EmptySection
                  message="No pending enrollment requests."
                />
              ) : (
                <div
                  className="
                    divide-y
                    divide-gray-100
                  "
                >
                  {pendingRequestRows
                    .slice(
                      0,
                      5
                    )
                    .map(
                      ({
                        enrollment,
                        learner,
                        course
                      }) => (
                        <div
                          key={
                            enrollment.enrollmentId
                          }
                          className="
                            p-4
                          "
                        >
                          <LearnerIdentity
                            learner={
                              learner
                            }
                          />


                          <div
                            className="
                              mt-3
                              flex
                              items-center
                              justify-between
                              gap-3
                            "
                          >
                            <div>
                              <p
                                className="
                                  text-xs
                                  font-semibold
                                  text-gray-600
                                "
                              >
                                {
                                  course.courseCode
                                }
                              </p>


                              <p
                                className="
                                  text-[10px]
                                  text-gray-400
                                  mt-0.5
                                "
                              >
                                Requested{' '}
                                {
                                  formatDate(
                                    enrollment.requestedAt
                                  )
                                }
                              </p>
                            </div>


                            <Link
                              to={
                                `/educator/courses/${course.courseId}/members`
                              }
                              className="
                                text-xs
                                font-semibold
                                text-blue-600
                                hover:underline
                              "
                            >
                              Review
                            </Link>
                          </div>
                        </div>
                      )
                    )}
                </div>
              )}
            </section>


            {/* QUICK ACTIONS */}
            <section
              className="
                bg-white
                border
                border-gray-100
                rounded-xl
                shadow-sm
                p-5
              "
            >
              <h2
                className="
                  text-base
                  font-bold
                  text-gray-800
                "
              >
                Quick Actions
              </h2>


              <div
                className="
                  mt-4
                  space-y-2
                "
              >
                <QuickAction
                  to="/educator/courses/new"
                  label="Create Course"
                />


                <QuickAction
                  to="/educator/courses"
                  label="Manage Courses"
                />


                <QuickAction
                  to="/educator/students"
                  label="View Students"
                />


                <QuickAction
                  to="/educator/gradebook"
                  label="Open Gradebook"
                />


                <QuickAction
                  to="/educator/analytics"
                  label="View Analytics"
                />
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}


function MetricCard({
  label,
  value,
  helper
}) {
  return (
    <div
      className="
        bg-white
        border
        border-gray-100
        rounded-xl
        shadow-sm
        p-5
      "
    >
      <p
        className="
          text-xs
          text-gray-400
        "
      >
        {label}
      </p>


      <p
        className="
          text-2xl
          font-bold
          text-gray-800
          mt-2
        "
      >
        {value}
      </p>


      <p
        className="
          text-[10px]
          text-gray-400
          mt-2
        "
      >
        {helper}
      </p>
    </div>
  );
}


function LearnerIdentity({
  learner
}) {
  const displayName =
    learner.displayName ||
    learner.fullname ||
    'Unknown Learner';


  return (
    <div
      className="
        flex
        items-center
        gap-3
        min-w-0
      "
    >
      {learner.avatarUrl ? (
        <img
          src={
            learner.avatarUrl
          }
          alt={
            displayName
          }
          className="
            w-9
            h-9
            rounded-full
            object-cover
            flex-shrink-0
          "
        />
      ) : (
        <div
          className="
            w-9
            h-9
            rounded-full
            bg-blue-100
            text-blue-700
            flex
            items-center
            justify-center
            text-xs
            font-bold
            flex-shrink-0
          "
        >
          {
            getInitials(
              displayName
            )
          }
        </div>
      )}


      <div
        className="
          min-w-0
        "
      >
        <p
          className="
            text-sm
            font-semibold
            text-gray-800
            truncate
          "
        >
          {
            displayName
          }
        </p>


        <p
          className="
            text-[10px]
            text-gray-400
            truncate
            mt-0.5
          "
        >
          {
            learner.email
          }
        </p>
      </div>
    </div>
  );
}


function QuickAction({
  to,
  label
}) {
  return (
    <Link
      to={
        to
      }
      className="
        flex
        items-center
        justify-between
        gap-3
        bg-gray-50
        hover:bg-blue-50
        rounded-lg
        px-3
        py-3
        text-sm
        font-semibold
        text-gray-700
        hover:text-blue-700
        transition
      "
    >
      <span>
        {label}
      </span>


      <span
        className="
          text-gray-400
        "
      >
        →
      </span>
    </Link>
  );
}


function EmptySection({
  message
}) {
  return (
    <div
      className="
        py-9
        px-5
        text-center
      "
    >
      <p
        className="
          text-sm
          text-gray-500
        "
      >
        {message}
      </p>
    </div>
  );
}