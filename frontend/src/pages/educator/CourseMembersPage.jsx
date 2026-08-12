import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link,
  useParams
} from 'react-router';

import {
  getCourses
} from '../../features/classroom/courseApi';

import {
  approveEnrollment,
  getCourseMembers,
  rejectEnrollment,
  removeMember
} from '../../features/classroom/enrollmentApi';



function formatDate(dateValue) {
  if (!dateValue) {
    return 'N/A';
  }

  const date =
    new Date(dateValue);

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


export default function CourseMembersPage() {
  const {
    courseId:
      routeCourseId
  } = useParams();


  const courseId =
    routeCourseId || null;


  const [
    course,
    setCourse
  ] = useState(null);


  const [
    enrollments,
    setEnrollments
  ] = useState([]);


  const [
    users,
    setUsers
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
    if (!courseId) {
      setCourse(null);
      setEnrollments([]);
      setUsers([]);
      setLoading(false);

      return;
    }


    let cancelled = false;


    async function loadMembersPage() {
      try {
        setLoading(true);
        setLoadError('');


        const [
          courseResult,
          memberResult
        ] = await Promise.all([
          getCourses(),
          getCourseMembers(courseId)
        ]);


        const courses =
          Array.isArray(
            courseResult?.courses
          )
            ? courseResult.courses
            : [];


        const foundCourse =
          courses.find(
            (item) =>
              String(
                item.courseId
              ) ===
              String(courseId)
          ) || null;


        const memberRows =
          Array.isArray(
            memberResult?.members
          )
            ? memberResult.members
            : [];


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );


        setEnrollments(
          memberRows
            .map(
              (item) =>
                item.enrollment
            )
            .filter(Boolean)
        );


        setUsers(
          memberRows
            .map(
              (item) =>
                item.learner
            )
            .filter(Boolean)
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load course members:',
            error
          );


          setCourse(null);
          setEnrollments([]);
          setUsers([]);


          setLoadError(
            error.message ||
            'Unable to load course members.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadMembersPage();


    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const [
    actionTarget,
    setActionTarget
  ] = useState(null);


  /*
   * actionTarget structure:
   *
   * {
   *   type:
   *     'REJECT'
   *     | 'REMOVE',
   *
   *   enrollment,
   *   learner
   * }
   */


  const courseEnrollments =
    useMemo(() => {
      return enrollments.filter(
        (enrollment) =>
          String(
            enrollment.courseId
          ) ===
          String(courseId)
      );
    }, [
      enrollments,
      courseId
    ]);


  const memberRows =
    useMemo(() => {
      return courseEnrollments.map(
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


          return {
            enrollment,

            learner: learner || {
              userId:
                enrollment.learnerId,

              displayName:
                'Unknown Learner',

              email:
                'N/A',

              avatarUrl:
                null
            }
          };
        }
      );
    }, [
      courseEnrollments,
      users
    ]);


  const pendingMembers =
    useMemo(() => {
      return memberRows.filter(
        ({ enrollment }) =>
          enrollment.status ===
          'PENDING'
      );
    }, [memberRows]);


  const approvedMembers =
    useMemo(() => {
      return memberRows.filter(
        ({ enrollment }) =>
          enrollment.status ===
          'APPROVED'
      );
    }, [memberRows]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">
          Loading class members...
        </p>
      </div>
    );
  }


  if (loadError) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-500">
          {loadError}
        </p>

        <Link
          to="/educator/courses"
          className="inline-block mt-3 text-sm text-blue-600 hover:underline"
        >
          Back to My Courses
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div
        className="
          p-8
          text-center
        "
      >
        <p
          className="
            text-sm
            text-red-500
          "
        >
          Course not found.
        </p>


        <Link
          to="/educator/courses"
          className="
            inline-block
            mt-3
            text-sm
            text-blue-600
            hover:underline
          "
        >
          Back to My Courses
        </Link>
      </div>
    );
  }


  const isArchived =
    course.status ===
    'ARCHIVED';



  async function handleApprove(
    enrollmentId
  ) {
    if (isArchived) {
      return;
    }


    try {
      const result =
        await approveEnrollment(
          enrollmentId
        );


      const updatedEnrollment =
        result.enrollment;


      setEnrollments(
        (previousEnrollments) =>
          previousEnrollments.map(
            (enrollment) =>
              String(
                enrollment.enrollmentId
              ) ===
              String(
                updatedEnrollment.enrollmentId
              )
                ? {
                    ...enrollment,
                    ...updatedEnrollment
                  }
                : enrollment
          )
      );
    } catch (error) {
      console.error(
        'Unable to approve enrollment:',
        error
      );


      alert(
        error.message ||
        'Unable to approve enrollment.'
      );
    }
  }


  function openRejectDialog(
    enrollment,
    learner
  ) {
    if (isArchived) {
      return;
    }


    setActionTarget({
      type:
        'REJECT',

      enrollment,
      learner
    });
  }


  function openRemoveDialog(
    enrollment,
    learner
  ) {
    if (isArchived) {
      return;
    }


    setActionTarget({
      type:
        'REMOVE',

      enrollment,
      learner
    });
  }


  function closeActionDialog() {
    setActionTarget(null);
  }


  async function confirmAction() {
    if (!actionTarget) {
      return;
    }


    const {
      type,
      enrollment:
        targetEnrollment
    } = actionTarget;

    if (type === 'REJECT') {
      try {
        const result =
          await rejectEnrollment(
            targetEnrollment.enrollmentId
          );


        const updatedEnrollment =
          result.enrollment;


        setEnrollments(
          (previousEnrollments) =>
            previousEnrollments.map(
              (enrollment) =>
                String(
                  enrollment.enrollmentId
                ) ===
                String(
                  updatedEnrollment.enrollmentId
                )
                  ? {
                      ...enrollment,
                      ...updatedEnrollment
                    }
                  : enrollment
            )
        );


        closeActionDialog();


        return;
      } catch (error) {
        console.error(
          'Unable to reject enrollment:',
          error
        );


        alert(
          error.message ||
          'Unable to reject enrollment.'
        );


        return;
      }
    }

    if (type === 'REMOVE') {
      try {
        const result =
          await removeMember(
            targetEnrollment.enrollmentId
          );


        const updatedEnrollment =
          result.enrollment;


        setEnrollments(
          (previousEnrollments) =>
            previousEnrollments.map(
              (enrollment) =>
                String(
                  enrollment.enrollmentId
                ) ===
                String(
                  updatedEnrollment.enrollmentId
                )
                  ? {
                      ...enrollment,
                      ...updatedEnrollment
                    }
                  : enrollment
            )
        );


        closeActionDialog();


        return;
      } catch (error) {
        console.error(
          'Unable to remove member:',
          error
        );


        alert(
          error.message ||
          'Unable to remove member.'
        );


        return;
      }
    }
  }


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
          <div
            className="
              flex
              items-center
              gap-2
              text-xs
              text-gray-400
              mb-1
            "
          >
            <Link
              to="/educator/courses"
              className="
                hover:text-blue-600
              "
            >
              My Courses
            </Link>


            <span>
              /
            </span>


            <Link
              to={
                `/educator/courses/${course.courseId}`
              }
              className="
                hover:text-blue-600
              "
            >
              {
                course.subjectName
              }
            </Link>


            <span>
              /
            </span>


            <span>
              Members
            </span>
          </div>


          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Class Members
          </h1>
        </div>


        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <span
            className="
              text-xs
              text-gray-500
            "
          >
            {
              approvedMembers.length
            }{' '}
            enrolled
          </span>


          {pendingMembers.length > 0 && (
            <span
              className="
                bg-amber-100
                text-amber-700
                text-xs
                font-bold
                rounded-full
                px-2.5
                py-1
              "
            >
              {
                pendingMembers.length
              }{' '}
              pending
            </span>
          )}
        </div>
      </header>


      {/* MAIN */}
      <main
        className="
          p-6
          space-y-6
        "
      >
        {/* ARCHIVED NOTICE */}
        {isArchived && (
          <div
            className="
              bg-amber-50
              border
              border-amber-200
              text-amber-800
              text-sm
              rounded-xl
              px-4
              py-3
            "
          >
            This course is archived.
            Member information is
            available for viewing only.
          </div>
        )}


        {/* PENDING REQUESTS */}
        <section
          className="
            bg-white
            rounded-xl
            border
            border-gray-100
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
                Pending Requests
              </h2>


              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Review learners who
                have requested access
                to this course.
              </p>
            </div>


            <span
              className="
                bg-amber-50
                text-amber-700
                text-xs
                font-bold
                rounded-full
                px-2.5
                py-1
              "
            >
              {
                pendingMembers.length
              }
            </span>
          </div>


          {pendingMembers.length ===
          0 ? (
            <div
              className="
                py-10
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
                No pending enrollment
                requests.
              </p>
            </div>
          ) : (
            <div
              className="
                overflow-x-auto
              "
            >
              <table
                className="
                  w-full
                  text-sm
                  text-left
                "
              >
                <thead
                  className="
                    text-xs
                    text-gray-500
                    uppercase
                    bg-gray-50/50
                  "
                >
                  <tr>
                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Learner
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Email
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Requested
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                        text-right
                      "
                    >
                      Actions
                    </th>
                  </tr>
                </thead>


                <tbody
                  className="
                    divide-y
                    divide-gray-100
                  "
                >
                  {pendingMembers.map(
                    ({
                      enrollment,
                      learner
                    }) => (
                      <tr
                        key={
                          enrollment
                            .enrollmentId
                        }
                        className="
                          hover:bg-gray-50/50
                        "
                      >
                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          <LearnerIdentity
                            learner={
                              learner
                            }
                          />
                        </td>


                        <td
                          className="
                            px-5
                            py-4
                            text-gray-500
                          "
                        >
                          {
                            learner.email
                          }
                        </td>


                        <td
                          className="
                            px-5
                            py-4
                            text-gray-500
                          "
                        >
                          {
                            formatDate(
                              enrollment
                                .requestedAt
                            )
                          }
                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          <div
                            className="
                              flex
                              items-center
                              justify-end
                              gap-2
                            "
                          >
                            <button
                              type="button"
                              disabled={
                                isArchived
                              }
                              onClick={() =>
                                handleApprove(
                                  enrollment
                                    .enrollmentId
                                )
                              }
                              className={`
                                text-xs
                                font-semibold
                                px-3
                                py-2
                                rounded-lg

                                ${
                                  isArchived
                                    ? `
                                      bg-gray-100
                                      text-gray-400
                                      cursor-not-allowed
                                    `
                                    : `
                                      bg-green-50
                                      text-green-700
                                      hover:bg-green-100
                                    `
                                }
                              `}
                            >
                              Approve
                            </button>


                            <button
                              type="button"
                              disabled={
                                isArchived
                              }
                              onClick={() =>
                                openRejectDialog(
                                  enrollment,
                                  learner
                                )
                              }
                              className={`
                                text-xs
                                font-semibold
                                px-3
                                py-2
                                rounded-lg

                                ${
                                  isArchived
                                    ? `
                                      bg-gray-100
                                      text-gray-400
                                      cursor-not-allowed
                                    `
                                    : `
                                      bg-red-50
                                      text-red-600
                                      hover:bg-red-100
                                    `
                                }
                              `}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>


        {/* ENROLLED LEARNERS */}
        <section
          className="
            bg-white
            rounded-xl
            border
            border-gray-100
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
                Enrolled Learners
              </h2>


              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Learners who currently
                have access to this
                course.
              </p>
            </div>


            <span
              className="
                bg-blue-50
                text-blue-700
                text-xs
                font-bold
                rounded-full
                px-2.5
                py-1
              "
            >
              {
                approvedMembers.length
              }
            </span>
          </div>


          {approvedMembers.length ===
          0 ? (
            <div
              className="
                py-10
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
                No learners are
                currently enrolled.
              </p>
            </div>
          ) : (
            <div
              className="
                overflow-x-auto
              "
            >
              <table
                className="
                  w-full
                  text-sm
                  text-left
                "
              >
                <thead
                  className="
                    text-xs
                    text-gray-500
                    uppercase
                    bg-gray-50/50
                  "
                >
                  <tr>
                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Learner
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Email
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Joined
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Status
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                        text-right
                      "
                    >
                      Actions
                    </th>
                  </tr>
                </thead>


                <tbody
                  className="
                    divide-y
                    divide-gray-100
                  "
                >
                  {approvedMembers.map(
                    ({
                      enrollment,
                      learner
                    }) => (
                      <tr
                        key={
                          enrollment
                            .enrollmentId
                        }
                        className="
                          hover:bg-gray-50/50
                        "
                      >
                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          <LearnerIdentity
                            learner={
                              learner
                            }
                          />
                        </td>


                        <td
                          className="
                            px-5
                            py-4
                            text-gray-500
                          "
                        >
                          {
                            learner.email
                          }
                        </td>


                        <td
                          className="
                            px-5
                            py-4
                            text-gray-500
                          "
                        >
                          {
                            formatDate(
                              enrollment
                                .approvedAt
                            )
                          }
                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          <span
                            className="
                              bg-green-100
                              text-green-700
                              text-[10px]
                              font-bold
                              rounded-full
                              px-2.5
                              py-1
                            "
                          >
                            APPROVED
                          </span>
                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          <div
                            className="
                              flex
                              items-center
                              justify-end
                              gap-2
                            "
                          >
                            <Link
                              to={
                                `/educator/analytics?courseId=${course.courseId}`
                              }
                              className="
                                text-xs
                                font-semibold
                                text-blue-600
                                bg-blue-50
                                px-3
                                py-2
                                rounded-lg
                                hover:bg-blue-100
                              "
                            >
                              View
                            </Link>


                            <button
                              type="button"
                              disabled={
                                isArchived
                              }
                              onClick={() =>
                                openRemoveDialog(
                                  enrollment,
                                  learner
                                )
                              }
                              className={`
                                text-xs
                                font-semibold
                                px-3
                                py-2
                                rounded-lg

                                ${
                                  isArchived
                                    ? `
                                      bg-gray-100
                                      text-gray-400
                                      cursor-not-allowed
                                    `
                                    : `
                                      bg-red-50
                                      text-red-600
                                      hover:bg-red-100
                                    `
                                }
                              `}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>


      {/* REJECT / REMOVE CONFIRMATION */}
      {actionTarget && (
        <div
          className="
            fixed
            inset-0
            z-50
            bg-gray-900/50
            flex
            items-center
            justify-center
            p-4
          "
        >
          <div
            className="
              bg-white
              w-full
              max-w-md
              rounded-xl
              shadow-xl
            "
          >
            <div
              className="
                p-6
              "
            >
              <div
                className={`
                  w-11
                  h-11
                  rounded-full
                  flex
                  items-center
                  justify-center
                  mb-4

                  ${
                    actionTarget.type ===
                    'REMOVE'
                      ? `
                        bg-red-100
                      `
                      : `
                        bg-amber-100
                      `
                  }
                `}
              >
                <svg
                  className={`
                    w-6
                    h-6

                    ${
                      actionTarget.type ===
                      'REMOVE'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }
                  `}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.667 1.73-3L13.73 4c-.77-1.333-2.69-1.333-3.46 0L3.34 16c-.77 1.333.19 3 1.73 3z"
                  />
                </svg>
              </div>


              <h2
                className="
                  text-lg
                  font-bold
                  text-gray-800
                "
              >
                {
                  actionTarget.type ===
                  'REJECT'
                    ? 'Reject Enrollment Request?'
                    : 'Remove Learner?'
                }
              </h2>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                {
                  actionTarget.type ===
                  'REJECT'
                    ? (
                      'This learner will not be added to the class. Do you want to continue?'
                    )
                    : (
                      'This learner will lose access to the course content. Do you want to continue?'
                    )
                }
              </p>


              <div
                className="
                  mt-4
                  bg-gray-50
                  rounded-lg
                  px-3
                  py-3
                "
              >
                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  {
                    actionTarget
                      .learner
                      .displayName ||
                    actionTarget
                      .learner
                      .fullname ||
                    'Unknown Learner'
                  }
                </p>


                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  {
                    actionTarget
                      .learner
                      .email
                  }
                </p>
              </div>
            </div>


            <div
              className="
                px-6
                py-4
                border-t
                border-gray-100
                flex
                justify-end
                gap-3
              "
            >
              <button
                type="button"
                onClick={
                  closeActionDialog
                }
                className="
                  text-sm
                  font-semibold
                  text-gray-600
                  bg-gray-100
                  px-4
                  py-2
                  rounded-lg
                  hover:bg-gray-200
                "
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={
                  confirmAction
                }
                className={`
                  text-sm
                  font-semibold
                  text-white
                  px-4
                  py-2
                  rounded-lg

                  ${
                    actionTarget.type ===
                    'REMOVE'
                      ? `
                        bg-red-600
                        hover:bg-red-700
                      `
                      : `
                        bg-amber-600
                        hover:bg-amber-700
                      `
                  }
                `}
              >
                {
                  actionTarget.type ===
                  'REJECT'
                    ? 'Reject Request'
                    : 'Remove Learner'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
            mt-0.5
          "
        >
          Learner
        </p>
      </div>
    </div>
  );
}