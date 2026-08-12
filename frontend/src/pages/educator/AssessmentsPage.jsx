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
  deleteAssessment,
  getManagedAssessments
} from '../../features/assessment/assessmentApi';



function formatDateTime(value) {
  if (!value) {
    return 'Not set';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Not set';
  }

  return date.toLocaleString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }
  );
}


function getStatusClasses(status) {
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


function getTypeClasses(type) {
  if (type === 'QUIZ') {
    return `
      bg-violet-50
      text-violet-700
    `;
  }

  return `
    bg-emerald-50
    text-emerald-700
  `;
}


function isEditableAssessment(
  assessment
) {
  return (
    assessment.status === 'DRAFT' ||
    assessment.status === 'SCHEDULED'
  );
}


export default function AssessmentsPage() {
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
    assessments,
    setAssessments
  ] = useState([]);


  const [
    loading,
    setLoading
  ] = useState(true);


  const [
    loadError,
    setLoadError
  ] = useState('');

  const [
    assessmentToDelete,
    setAssessmentToDelete
  ] = useState(null);


  const [
    blockedAssessment,
    setBlockedAssessment
  ] = useState(null);



  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setAssessments([]);
      setLoadError('');
      setLoading(false);

      return;
    }


    let cancelled = false;


    async function loadAssessmentsPage() {
      try {
        setLoading(true);
        setLoadError('');


        const [
          courseResult,
          assessmentResult
        ] = await Promise.all([
          getCourses(),
          getManagedAssessments(
            courseId
          )
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


        const loadedAssessments =
          Array.isArray(
            assessmentResult
              ?.assessments
          )
            ? assessmentResult.assessments
            : [];


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );

        setAssessments(
          loadedAssessments
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load assessments:',
            error
          );


          setCourse(null);
          setAssessments([]);


          setLoadError(
            error.message ||
            'Unable to load assessments.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadAssessmentsPage();


    return () => {
      cancelled = true;
    };
  }, [courseId]);



  const courseAssessments =
    useMemo(() => {
      return assessments
        .filter(
          (assessment) =>
            String(
              assessment.courseId
            ) ===
            String(courseId)
        )
        .sort(
          (first, second) => {
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
      assessments,
      courseId
    ]);


  if (loading) {
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
            text-gray-500
          "
        >
          Loading assessments...
        </p>
      </div>
    );
  }

  if (loadError) {
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
          {loadError}
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


  function requestDelete(
    assessment
  ) {
    if (
      !isEditableAssessment(
        assessment
      )
    ) {
      setBlockedAssessment(
        assessment
      );

      return;
    }


    setAssessmentToDelete(
      assessment
    );
  }


 async function confirmDelete() {
  if (!assessmentToDelete) {
    return;
  }


  try {
    await deleteAssessment(
      assessmentToDelete
        .assessmentId
    );


    setAssessments(
      (previousAssessments) =>
        previousAssessments.filter(
          (assessment) =>
            String(
              assessment.assessmentId
            ) !==
            String(
              assessmentToDelete
                .assessmentId
            )
        )
    );


    setAssessmentToDelete(
      null
    );
  } catch (error) {
    console.error(
      'Unable to delete assessment:',
      error
    );


    alert(
      error.message ||
      'Unable to delete assessment.'
    );
  }
}


  function handleBlockedAction(
    assessment
  ) {
    setBlockedAssessment(
      assessment
    );
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


            <span>/</span>


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


            <span>/</span>


            <span>
              Assessments
            </span>
          </div>


          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Assessments
          </h1>
        </div>


        {!isArchived && (
          <Link
            to={
              `/educator/courses/${course.courseId}/assessments/new`
            }
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
            + Create Assessment
          </Link>
        )}
      </header>


      {/* MAIN */}
      <main
        className="
          p-6
          space-y-5
        "
      >
        {/* ARCHIVED */}
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
            Existing assessments are
            available for viewing only.
          </div>
        )}


        {/* SUMMARY */}
        <div
          className="
            grid
            grid-cols-2
            md:grid-cols-4
            gap-4
          "
        >
          <SummaryCard
            label="Total"
            value={
              courseAssessments.length
            }
          />


          <SummaryCard
            label="Draft"
            value={
              courseAssessments.filter(
                (assessment) =>
                  assessment.status ===
                  'DRAFT'
              ).length
            }
          />


          <SummaryCard
            label="Scheduled"
            value={
              courseAssessments.filter(
                (assessment) =>
                  assessment.status ===
                  'SCHEDULED'
              ).length
            }
          />


          <SummaryCard
            label="In Progress"
            value={
              courseAssessments.filter(
                (assessment) =>
                  assessment.status ===
                  'IN_PROGRESS'
              ).length
            }
          />
        </div>


        {/* TABLE */}
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
            "
          >
            <h2
              className="
                text-base
                font-bold
                text-gray-800
              "
            >
              Course Assessments
            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-1
              "
            >
              Manage quizzes and
              official assignments
              for this course.
            </p>
          </div>


          {courseAssessments.length ===
          0 ? (
            <div
              className="
                py-16
                px-6
                text-center
              "
            >
              <div
                className="
                  w-12
                  h-12
                  mx-auto
                  rounded-full
                  bg-blue-50
                  flex
                  items-center
                  justify-center
                "
              >
                <svg
                  className="
                    w-6
                    h-6
                    text-blue-500
                  "
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a3 3 0 006 0M9 12h6m-6 4h6"
                  />
                </svg>
              </div>


              <h3
                className="
                  text-base
                  font-bold
                  text-gray-800
                  mt-4
                "
              >
                No assessments yet
              </h3>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                Create a quiz or
                assignment for this
                course.
              </p>


              {!isArchived && (
                <Link
                  to={
                    `/educator/courses/${course.courseId}/assessments/new`
                  }
                  className="
                    inline-block
                    mt-4
                    text-sm
                    font-semibold
                    text-blue-600
                    hover:underline
                  "
                >
                  Create Assessment
                </Link>
              )}
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
                  min-w-[1050px]
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
                      Assessment
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Type
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Start
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Deadline
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Points
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
                      "
                    >
                      Submissions
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
                  {courseAssessments.map(
                    (assessment) => {
                      const editable =
                        isEditableAssessment(
                          assessment
                        );

                      return (
                        <tr
                          key={
                            assessment
                              .assessmentId
                          }
                          className="
                            hover:bg-gray-50/50
                          "
                        >
                          {/* TITLE */}
                          <td
                            className="
                              px-5
                              py-4
                            "
                          >
                            <div
                              className="
                                max-w-[220px]
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


                              {assessment.description && (
                                <p
                                  className="
                                    text-xs
                                    text-gray-400
                                    mt-1
                                    truncate
                                  "
                                >
                                  {
                                    assessment.description
                                  }
                                </p>
                              )}
                            </div>
                          </td>


                          {/* TYPE */}
                          <td
                            className="
                              px-5
                              py-4
                            "
                          >
                            <span
                              className={`
                                inline-flex
                                rounded-full
                                px-2.5
                                py-1
                                text-[10px]
                                font-bold

                                ${getTypeClasses(
                                  assessment.type
                                )}
                              `}
                            >
                              {
                                assessment.type
                              }
                            </span>
                          </td>


                          {/* START */}
                          <td
                            className="
                              px-5
                              py-4
                              text-xs
                              text-gray-500
                            "
                          >
                            {
                              formatDateTime(
                                assessment.startTime
                              )
                            }
                          </td>


                          {/* DEADLINE */}
                          <td
                            className="
                              px-5
                              py-4
                              text-xs
                              text-gray-500
                            "
                          >
                            {
                              formatDateTime(
                                assessment.deadline
                              )
                            }
                          </td>


                          {/* POINTS */}
                          <td
                            className="
                              px-5
                              py-4
                              text-gray-700
                              font-semibold
                            "
                          >
                            {
                              assessment.totalPoints ??
                              0
                            }
                          </td>


                          {/* STATUS */}
                          <td
                            className="
                              px-5
                              py-4
                            "
                          >
                            <span
                              className={`
                                inline-flex
                                rounded-full
                                px-2.5
                                py-1
                                text-[10px]
                                font-bold

                                ${getStatusClasses(
                                  assessment.status
                                )}
                              `}
                            >
                              {
                                assessment.status
                              }
                            </span>
                          </td>


                          {/* SUBMISSIONS */}
                          <td
                            className="
                              px-5
                              py-4
                            "
                          >
                            <Link
                              to={
                                `/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/submissions`
                              }
                              className="
                                text-xs
                                font-semibold
                                text-blue-600
                                hover:underline
                              "
                            >
                              View submissions
                            </Link>
                          </td>


                          {/* ACTIONS */}
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
                                  `/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}`
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


                              {!isArchived && (
                                <>
                                  {editable ? (
                                    <Link
                                      to={
                                        `/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/edit`
                                      }
                                      className="
                                        text-xs
                                        font-semibold
                                        text-gray-600
                                        bg-gray-100
                                        px-3
                                        py-2
                                        rounded-lg
                                        hover:bg-gray-200
                                      "
                                    >
                                      Edit
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleBlockedAction(
                                          assessment
                                        )
                                      }
                                      className="
                                        text-xs
                                        font-semibold
                                        text-gray-400
                                        bg-gray-100
                                        px-3
                                        py-2
                                        rounded-lg
                                        cursor-not-allowed
                                      "
                                    >
                                      Edit
                                    </button>
                                  )}


                                  <button
                                    type="button"
                                    onClick={() =>
                                      requestDelete(
                                        assessment
                                      )
                                    }
                                    className={`
                                      text-xs
                                      font-semibold
                                      px-3
                                      py-2
                                      rounded-lg

                                      ${
                                        editable
                                          ? `
                                            text-red-600
                                            bg-red-50
                                            hover:bg-red-100
                                          `
                                          : `
                                            text-gray-400
                                            bg-gray-100
                                            cursor-not-allowed
                                          `
                                      }
                                    `}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>


      {/* DELETE CONFIRMATION */}
      {assessmentToDelete && (
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
                className="
                  w-11
                  h-11
                  rounded-full
                  bg-red-100
                  flex
                  items-center
                  justify-center
                  mb-4
                "
              >
                <svg
                  className="
                    w-6
                    h-6
                    text-red-600
                  "
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
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
                Delete Assessment?
              </h2>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                Are you sure you want
                to delete this
                assessment? This action
                cannot be undone.
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
                    assessmentToDelete
                      .title
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
                    assessmentToDelete
                      .type
                  }
                  {' · '}
                  {
                    assessmentToDelete
                      .status
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
                onClick={() =>
                  setAssessmentToDelete(
                    null
                  )
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
                  confirmDelete
                }
                className="
                  text-sm
                  font-semibold
                  text-white
                  bg-red-600
                  hover:bg-red-700
                  px-4
                  py-2
                  rounded-lg
                "
              >
                Delete Assessment
              </button>
            </div>
          </div>
        </div>
      )}


      {/* BLOCK ACTIVE ASSESSMENT */}
      {blockedAssessment && (
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
                className="
                  w-11
                  h-11
                  rounded-full
                  bg-amber-100
                  flex
                  items-center
                  justify-center
                  mb-4
                "
              >
                <svg
                  className="
                    w-6
                    h-6
                    text-amber-600
                  "
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
                Assessment Cannot Be Modified
              </h2>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                This assessment is
                currently active or has
                already been closed.
                It can no longer be
                edited or deleted.
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
                    blockedAssessment
                      .title
                  }
                </p>


                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  Status:{' '}
                  {
                    blockedAssessment
                      .status
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
              "
            >
              <button
                type="button"
                onClick={() =>
                  setBlockedAssessment(
                    null
                  )
                }
                className="
                  text-sm
                  font-semibold
                  text-white
                  bg-blue-600
                  hover:bg-blue-700
                  px-4
                  py-2
                  rounded-lg
                "
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


function SummaryCard({
  label,
  value
}) {
  return (
    <div
      className="
        bg-white
        border
        border-gray-100
        rounded-xl
        shadow-sm
        p-4
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
    </div>
  );
}