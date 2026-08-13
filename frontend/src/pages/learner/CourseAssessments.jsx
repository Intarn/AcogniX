import {
  useEffect,
  useState
} from 'react';

import {
  Link,
  useParams
} from 'react-router-dom';

import {
  getCourses
} from '../../services/courseService';

import {
  getLearnerAssessments
} from '../../services/assessmentService';


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
    case 'IN_PROGRESS':
      return `
        bg-green-100
        text-green-700
      `;

    case 'SCHEDULED':
      return `
        bg-blue-100
        text-blue-700
      `;

    case 'CLOSED':
      return `
        bg-gray-100
        text-gray-600
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


export default function CourseAssessments() {
  const {
    courseId
  } = useParams();


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


  useEffect(() => {
    if (!courseId) {
      setLoading(false);

      setLoadError(
        'Course ID is missing.'
      );

      return;
    }


    let cancelled =
      false;


    async function loadPage() {
      try {
        setLoading(true);

        setLoadError('');


        const [
          courseResult,
          assessmentResult
        ] =
          await Promise.all([
            getCourses(),

            getLearnerAssessments()
          ]);


        const courseList =
          Array.isArray(
            courseResult?.courses
          )
            ? courseResult.courses
            : [];


        const foundCourse =
          courseList.find(
            (item) =>
              String(
                item.courseId
              ) ===
              String(
                courseId
              )
          ) || null;


        if (!foundCourse) {
          throw new Error(
            'Course not found or you do not have access to this course.'
          );
        }


        const allAssessments =
          Array.isArray(
            assessmentResult
              ?.assessments
          )
            ? assessmentResult
                .assessments
            : (
                Array.isArray(
                  assessmentResult
                )
                  ? assessmentResult
                  : []
              );


        /*
         * Only assessments belonging
         * to this Course.
         */
        const courseAssessments =
          allAssessments
            .filter(
              (assessment) =>
                String(
                  assessment.courseId
                ) ===
                String(
                  courseId
                )
            )
            .sort(
              (
                first,
                second
              ) =>
                new Date(
                  first.startTime ||
                  first.createdAt ||
                  0
                ).getTime() -
                new Date(
                  second.startTime ||
                  second.createdAt ||
                  0
                ).getTime()
            );


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );

        setAssessments(
          courseAssessments
        );

      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          'Unable to load course assessments:',
          error
        );

        setCourse(null);

        setAssessments([]);

        setLoadError(
          error.message ||
          'Unable to load assessments.'
        );

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadPage();


    return () => {
      cancelled = true;
    };

  }, [
    courseId
  ]);


  if (loading) {
    return (
      <div
        className="
          flex-1
          flex
          items-center
          justify-center
          p-8
          bg-gray-50
        "
      >
        <p className="text-sm text-gray-500">
          Loading assessments...
        </p>
      </div>
    );
  }


  if (loadError) {
    return (
      <div
        className="
          flex-1
          flex
          flex-col
          items-center
          justify-center
          p-8
          bg-gray-50
        "
      >
        <p className="text-sm text-red-500">
          {loadError}
        </p>

        <Link
          to="/learner/my-courses"
          className="
            mt-3
            text-sm
            font-semibold
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
    return null;
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
          px-6
          py-3
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
              to="/learner/my-courses"
              className="hover:text-blue-600"
            >
              My Courses
            </Link>

            <span>/</span>

            <Link
              to={
                `/learner/courses/${course.courseId}`
              }
              className="hover:text-blue-600"
            >
              {course.subjectName}
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
      </header>


      {/* MAIN */}
      <main
        className="
          flex-1
          p-6
          bg-gray-50
          overflow-y-auto
        "
      >
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
              px-6
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
              Official quizzes and assignments
              for {course.subjectName}.
            </p>
          </div>


          <div className="p-6">
            {assessments.length === 0 ? (
              <div
                className="
                  py-16
                  text-center
                "
              >
                <div
                  className="
                    w-12
                    h-12
                    mx-auto
                    rounded-full
                    bg-violet-50
                    flex
                    items-center
                    justify-center
                    mb-3
                  "
                >
                  📝
                </div>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-600
                  "
                >
                  No assessments are
                  available for this course.
                </p>

                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  Published assessments will
                  appear here.
                </p>
              </div>

            ) : (
              <div className="space-y-3">
                {assessments.map(
                  (assessment) => {
                    const isQuiz =
                      assessment.type ===
                      'QUIZ';

                    const isAssignment =
                      assessment.type ===
                      'ASSIGNMENT';

                    const isOpen =
                      assessment.status ===
                      'IN_PROGRESS';

                    const isScheduled =
                      assessment.status ===
                      'SCHEDULED';

                    const isClosed =
                      assessment.status ===
                      'CLOSED';
                      
                    const submissionStatus =
                      assessment.submission
                        ?.status ||
                      null;


                    const submissionInProgress =
                      submissionStatus ===
                      'IN_PROGRESS';


                    const hasFinalizedSubmission =
                      [
                        'SUBMITTED',
                        'PENDING_REVIEW',
                        'GRADED'
                      ].includes(
                        submissionStatus
                      );


                    /*
                    * Assignment đã submit,
                    * nhưng Assessment còn mở:
                    * Learner vẫn được edit.
                    */
                    const assignmentSubmittedButEditable =
                      isAssignment &&
                      isOpen &&
                      [
                        'SUBMITTED',
                        'PENDING_REVIEW'
                      ].includes(
                        submissionStatus
                      );


                    /*
                    * Quiz submit là khóa ngay.
                    */
                    const quizFinalized =
                      isQuiz &&
                      hasFinalizedSubmission;


                    /*
                    * Review khi:
                    *
                    * - Assessment CLOSED
                    * - Quiz đã finalize
                    * - Submission đã GRADED
                    */
                    const canReview =
                      isClosed ||
                      quizFinalized ||
                      submissionStatus ===
                        'GRADED';


                    return (
                      <article
                        key={
                          assessment.assessmentId
                        }
                        className="
                          border
                          border-gray-100
                          rounded-xl
                          p-5
                          flex
                          items-start
                          justify-between
                          gap-4
                          hover:border-blue-200
                          hover:shadow-sm
                          transition
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
                              w-11
                              h-11
                              rounded-xl
                              bg-violet-50
                              flex
                              items-center
                              justify-center
                              flex-shrink-0
                            "
                          >
                            📝
                          </div>


                          <div className="min-w-0">
                            <div
                              className="
                                flex
                                flex-wrap
                                items-center
                                gap-2
                              "
                            >
                              <h3
                                className="
                                  text-sm
                                  font-bold
                                  text-gray-800
                                "
                              >
                                {
                                  assessment.title ||
                                  'Untitled Assessment'
                                }
                              </h3>


                              <span
                                className={`
                                  px-2
                                  py-0.5
                                  rounded-full
                                  text-[10px]
                                  font-semibold
                                  ${getTypeClasses(
                                    assessment.type
                                  )}
                                `}
                              >
                                {
                                  assessment.type
                                }
                              </span>


                              <span
                                className={`
                                  px-2
                                  py-0.5
                                  rounded-full
                                  text-[10px]
                                  font-semibold
                                  ${getStatusClasses(
                                    assessment.status
                                  )}
                                `}
                              >
                                {
                                  assessment.status
                                }
                              </span>
                            </div>


                            {assessment.description && (
                              <p
                                className="
                                  text-xs
                                  text-gray-500
                                  mt-2
                                  line-clamp-2
                                "
                              >
                                {
                                  assessment.description
                                }
                              </p>
                            )}


                            <div
                              className="
                                flex
                                flex-wrap
                                gap-x-4
                                gap-y-1
                                mt-3
                                text-[11px]
                                text-gray-400
                              "
                            >
                              <span>
                                {
                                  assessment.totalPoints ??
                                  0
                                }{' '}
                                points
                              </span>

                              <span>
                                Starts:{' '}
                                {
                                  formatDateTime(
                                    assessment.startTime
                                  )
                                }
                              </span>

                              <span>
                                Due:{' '}
                                {
                                  formatDateTime(
                                    assessment.deadline
                                  )
                                }
                              </span>
                            </div>


                            {assessment
                              .instructionFileUrl && (
                              <a
                                href={
                                  assessment
                                    .instructionFileUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="
                                  inline-block
                                  mt-3
                                  text-xs
                                  font-semibold
                                  text-blue-600
                                  hover:underline
                                "
                              >
                                View Instructions
                              </a>
                            )}
                          </div>
                        </div>


                        {/* ACTION */}
                        <div
                          className="
                            flex-shrink-0
                          "
                        >
                          {/* Already submitted
                              OR Assessment closed */}
                          {canReview && (
                            <Link
                              to={
                                `/learner/courses/${course.courseId}/assessments/${assessment.assessmentId}/review`
                              }
                              className="
                                inline-flex
                                items-center
                                px-4
                                py-2
                                rounded-lg
                                bg-gray-100
                                text-gray-700
                                text-xs
                                font-semibold
                                hover:bg-gray-200
                                transition
                              "
                            >
                              View Review
                            </Link>
                          )}


                          {/* Not opened yet */}
                          {!canReview &&
                            isScheduled && (
                            <span
                              className="
                                text-xs
                                font-semibold
                                text-gray-400
                              "
                            >
                              Not Open Yet
                            </span>
                          )}


                          {/* Open Quiz */}
                          {!canReview &&
                            isOpen &&
                            isQuiz && (
                            <Link
                              to={
                                `/learner/quizzes?id=${assessment.assessmentId}`
                              }
                              className="
                                inline-flex
                                px-4
                                py-2
                                rounded-lg
                                bg-blue-600
                                text-white
                                text-xs
                                font-semibold
                                hover:bg-blue-700
                                transition
                              "
                            >
                              {
                                submissionInProgress
                                  ? 'Continue Quiz'
                                  : 'Open Quiz'
                              }
                            </Link>
                          )}


                          {/* Assignment */}
                          {!canReview &&
                            isOpen &&
                            isAssignment && (
                            <Link
                              to={
                                `/learner/courses/${course.courseId}/assessments/${assessment.assessmentId}/assignment`
                              }
                              className="
                                inline-flex
                                px-4
                                py-2
                                rounded-lg
                                bg-emerald-600
                                text-white
                                text-xs
                                font-semibold
                                hover:bg-emerald-700
                                transition
                              "
                            >
                              {
                                 submissionInProgress
                                  ? 'Continue Assignment'

                                  : assignmentSubmittedButEditable
                                    ? 'Edit Assignment'

                                    : 'Open Assignment'
                              }
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}