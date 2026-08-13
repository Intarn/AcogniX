import {
  useEffect,
  useMemo,
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
  getAssessmentReview
} from '../../services/quizService';


/* =========================================================
   HELPERS
========================================================= */

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


function getSubmissionStatusClasses(
  status
) {
  switch (status) {
    case 'GRADED':
      return `
        bg-green-100
        text-green-700
      `;

    case 'PENDING_REVIEW':
      return `
        bg-amber-100
        text-amber-700
      `;

    case 'SUBMITTED':
      return `
        bg-blue-100
        text-blue-700
      `;

    default:
      return `
        bg-gray-100
        text-gray-600
      `;
  }
}


function getAssessmentTypeClasses(
  type
) {
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


function getFileNameFromUrl(
  url,
  index
) {
  if (!url) {
    return `Submitted File ${index + 1}`;
  }


  try {
    const cleanUrl =
      String(url)
        .split('?')[0];


    const name =
      cleanUrl
        .split('/')
        .pop();


    return (
      decodeURIComponent(name) ||
      `Submitted File ${index + 1}`
    );

  } catch {
    return `Submitted File ${index + 1}`;
  }
}


function normalizeOptions(
  options
) {
  if (!Array.isArray(options)) {
    return [];
  }


  return options.map(
    (option, index) => {
      if (
        option &&
        typeof option ===
          'object'
      ) {
        return {
          optionId:
            option.optionId ||
            `option-${index}`,

          content:
            option.content || ''
        };
      }


      return {
        optionId:
          `option-${index}`,

        content:
          String(
            option ?? ''
          )
      };
    }
  );
}


/* =========================================================
   COMPONENT
========================================================= */

export default function AssessmentReview() {
  const {
    courseId,
    assessmentId
  } = useParams();


  /* =========================
     STATE
  ========================= */

  const [
    course,
    setCourse
  ] = useState(null);


  const [
    assessment,
    setAssessment
  ] = useState(null);


  const [
    questions,
    setQuestions
  ] = useState([]);


  const [
    submission,
    setSubmission
  ] = useState(null);


  const [
    answers,
    setAnswers
  ] = useState([]);


  const [
    files,
    setFiles
  ] = useState([]);


  const [
    loading,
    setLoading
  ] = useState(true);


  const [
    loadError,
    setLoadError
  ] = useState('');


  /* =========================================================
     LOAD REVIEW
  ========================================================= */

  useEffect(() => {
    if (
      !courseId ||
      !assessmentId
    ) {
      setLoadError(
        'Course ID or Assessment ID is missing.'
      );

      setLoading(false);

      return;
    }


    let cancelled =
      false;


    async function loadReview() {
      try {
        setLoading(true);

        setLoadError('');


        const [
          courseResult,
          reviewResult
        ] =
          await Promise.all([
            getCourses(),

            getAssessmentReview(
              assessmentId
            )
          ]);


        /* -------------------------
           COURSE
        ------------------------- */

        const courseList =
          Array.isArray(
            courseResult?.courses
          )
            ? courseResult.courses
            : (
                Array.isArray(
                  courseResult
                )
                  ? courseResult
                  : []
              );


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


        /* -------------------------
           ASSESSMENT
        ------------------------- */

        const loadedAssessment =
          reviewResult?.assessment ||
          null;


        if (!loadedAssessment) {
          throw new Error(
            'Assessment review data was not found.'
          );
        }


        /*
         * Additional safety:
         * Assessment must belong
         * to the Course in URL.
         */
        if (
          String(
            loadedAssessment.courseId
          ) !==
          String(
            courseId
          )
        ) {
          throw new Error(
            'This assessment does not belong to the selected course.'
          );
        }


        /* -------------------------
           QUESTIONS
        ------------------------- */

        const loadedQuestions =
          Array.isArray(
            reviewResult?.questions
          )
            ? [
                ...reviewResult.questions
              ].sort(
                (
                  first,
                  second
                ) =>
                  Number(
                    first.displayOrder ??
                    0
                  ) -
                  Number(
                    second.displayOrder ??
                    0
                  )
              )
            : [];


        /* -------------------------
           SUBMISSION
        ------------------------- */

        const loadedSubmission =
          reviewResult?.submission ||
          null;


        /* -------------------------
           ANSWERS
        ------------------------- */

        const loadedAnswers =
          Array.isArray(
            reviewResult?.answers
          )
            ? reviewResult.answers
            : [];


        /* -------------------------
           FILES
        ------------------------- */

        const loadedFiles =
          Array.isArray(
            reviewResult?.files
          )
            ? reviewResult.files
            : (
                Array.isArray(
                  loadedSubmission
                    ?.uploadedFileUrls
                )
                  ? loadedSubmission
                      .uploadedFileUrls
                  : []
              );


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );


        setAssessment(
          loadedAssessment
        );


        setQuestions(
          loadedQuestions
        );


        setSubmission(
          loadedSubmission
        );


        setAnswers(
          loadedAnswers
        );


        setFiles(
          loadedFiles
        );

      } catch (error) {
        if (cancelled) {
          return;
        }


        console.error(
          'Unable to load assessment review:',
          error
        );


        setCourse(null);

        setAssessment(null);

        setQuestions([]);

        setSubmission(null);

        setAnswers([]);

        setFiles([]);


        setLoadError(
          error.message ||
          'Unable to load assessment review.'
        );

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadReview();


    return () => {
      cancelled = true;
    };

  }, [
    courseId,
    assessmentId
  ]);


  /* =========================================================
     ANSWER LOOKUP
  ========================================================= */

  const answerByQuestionId =
    useMemo(
      () => {
        const result =
          new Map();


        answers.forEach(
          (answer) => {
            result.set(
              String(
                answer.questionId
              ),
              answer
            );
          }
        );


        return result;
      },
      [
        answers
      ]
    );


  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main
        className="
          flex-1
          flex
          items-center
          justify-center
          bg-gray-50
          p-8
        "
      >
        <div className="text-center">
          <div
            className="
              w-8
              h-8
              rounded-full
              border-2
              border-gray-200
              border-t-blue-600
              animate-spin
              mx-auto
              mb-3
            "
          />

          <p
            className="
              text-sm
              text-gray-500
            "
          >
            Loading assessment review...
          </p>
        </div>
      </main>
    );
  }


  /* =========================================================
     ERROR
  ========================================================= */

  if (loadError) {
    return (
      <main
        className="
          flex-1
          flex
          items-center
          justify-center
          bg-gray-50
          p-8
        "
      >
        <div
          className="
            max-w-md
            w-full
            bg-white
            rounded-xl
            border
            border-red-100
            shadow-sm
            p-6
            text-center
          "
        >
          <div
            className="
              w-10
              h-10
              rounded-full
              bg-red-50
              text-red-500
              font-bold
              flex
              items-center
              justify-center
              mx-auto
              mb-3
            "
          >
            !
          </div>


          <h2
            className="
              text-base
              font-bold
              text-gray-800
            "
          >
            Unable to Open Review
          </h2>


          <p
            className="
              text-sm
              text-red-500
              mt-2
            "
          >
            {loadError}
          </p>


          <Link
            to={
              courseId
                ? `/learner/courses/${courseId}/assessments`
                : '/learner/my-courses'
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
            Back to Assessments
          </Link>
        </div>
      </main>
    );
  }


  if (
    !course ||
    !assessment
  ) {
    return null;
  }


  const hasSubmission =
    Boolean(submission);


  const scoreAvailable =
    submission?.score !==
      null &&
    submission?.score !==
      undefined;


  /* =========================================================
     UI
  ========================================================= */

  return (
    <>
      {/* =====================================================
          TOPBAR
      ===================================================== */}

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
        <div
          className="
            min-w-0
          "
        >
          {/* Breadcrumb */}
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
              text-xs
              text-gray-400
              mb-1
            "
          >
            <Link
              to="/learner/my-courses"
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
                `/learner/courses/${course.courseId}`
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


            <Link
              to={
                `/learner/courses/${course.courseId}/assessments`
              }
              className="
                hover:text-blue-600
              "
            >
              Assessments
            </Link>


            <span>
              /
            </span>


            <span
              className="
                truncate
              "
            >
              {
                assessment.title
              }
            </span>
          </div>


          <div
            className="
              flex
              flex-wrap
              items-center
              gap-3
            "
          >
            <h1
              className="
                text-lg
                font-bold
                text-gray-800
              "
            >
              Assessment Review
            </h1>


            <span
              className="
                inline-flex
                rounded-full
                px-2.5
                py-1
                text-[10px]
                font-bold
                bg-gray-100
                text-gray-600
              "
            >
              CLOSED
            </span>
          </div>
        </div>
      </header>


      {/* =====================================================
          MAIN
      ===================================================== */}

      <main
        className="
          flex-1
          bg-gray-50
          p-6
          overflow-y-auto
        "
      >
        <div
          className="
            max-w-6xl
            mx-auto
            space-y-6
          "
        >

          {/* =================================================
              READ ONLY NOTICE
          ================================================= */}

          <div
            className="
              bg-blue-50
              border
              border-blue-100
              rounded-xl
              px-4
              py-3
            "
          >
            <p
              className="
                text-sm
                font-semibold
                text-blue-700
              "
            >
              Read-only assessment review
            </p>

            <p
              className="
                text-xs
                text-blue-600
                mt-1
              "
            >
              This assessment is closed.
              You can review the assessment
              and your submitted work, but
              you can no longer change or
              submit answers.
            </p>
          </div>


          {/* =================================================
              ASSESSMENT INFORMATION
          ================================================= */}

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
                py-5
                border-b
                border-gray-100
              "
            >
              <div
                className="
                  flex
                  flex-wrap
                  items-start
                  justify-between
                  gap-4
                "
              >
                <div>
                  <div
                    className="
                      flex
                      flex-wrap
                      items-center
                      gap-2
                    "
                  >
                    <h2
                      className="
                        text-xl
                        font-bold
                        text-gray-800
                      "
                    >
                      {
                        assessment.title
                      }
                    </h2>


                    <span
                      className={`
                        px-2.5
                        py-1
                        rounded-full
                        text-[10px]
                        font-bold

                        ${
                          getAssessmentTypeClasses(
                            assessment.type
                          )
                        }
                      `}
                    >
                      {
                        assessment.type ||
                        'ASSESSMENT'
                      }
                    </span>
                  </div>


                  {assessment.description && (
                    <p
                      className="
                        text-sm
                        text-gray-500
                        mt-3
                        leading-6
                      "
                    >
                      {
                        assessment.description
                      }
                    </p>
                  )}
                </div>


                <Link
                  to={
                    `/learner/courses/${course.courseId}/assessments`
                  }
                  className="
                    flex-shrink-0
                    px-4
                    py-2
                    rounded-lg
                    border
                    border-gray-200
                    bg-white
                    text-xs
                    font-semibold
                    text-gray-600
                    hover:bg-gray-50
                    transition
                  "
                >
                  Back to Assessments
                </Link>
              </div>
            </div>


            <div
              className="
                p-6
                grid
                grid-cols-1
                sm:grid-cols-2
                lg:grid-cols-4
                gap-4
              "
            >
              {/* TOTAL POINTS */}
              <div
                className="
                  bg-gray-50
                  rounded-xl
                  p-4
                "
              >
                <p
                  className="
                    text-[11px]
                    uppercase
                    font-semibold
                    text-gray-400
                  "
                >
                  Total Points
                </p>

                <p
                  className="
                    text-base
                    font-bold
                    text-gray-800
                    mt-2
                  "
                >
                  {
                    assessment.totalPoints ??
                    0
                  }
                </p>
              </div>


              {/* START */}
              <div
                className="
                  bg-gray-50
                  rounded-xl
                  p-4
                "
              >
                <p
                  className="
                    text-[11px]
                    uppercase
                    font-semibold
                    text-gray-400
                  "
                >
                  Start Time
                </p>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                    mt-2
                  "
                >
                  {
                    formatDateTime(
                      assessment.startTime
                    )
                  }
                </p>
              </div>


              {/* DEADLINE */}
              <div
                className="
                  bg-gray-50
                  rounded-xl
                  p-4
                "
              >
                <p
                  className="
                    text-[11px]
                    uppercase
                    font-semibold
                    text-gray-400
                  "
                >
                  Deadline
                </p>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                    mt-2
                  "
                >
                  {
                    formatDateTime(
                      assessment.deadline
                    )
                  }
                </p>
              </div>


              {/* COURSE */}
              <div
                className="
                  bg-gray-50
                  rounded-xl
                  p-4
                "
              >
                <p
                  className="
                    text-[11px]
                    uppercase
                    font-semibold
                    text-gray-400
                  "
                >
                  Course
                </p>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                    mt-2
                  "
                >
                  {
                    course.subjectName
                  }
                </p>
              </div>
            </div>


            {assessment
              .instructionFileUrl && (
              <div
                className="
                  px-6
                  pb-6
                "
              >
                <a
                  href={
                    assessment
                      .instructionFileUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="
                    inline-flex
                    items-center
                    px-4
                    py-2
                    rounded-lg
                    bg-blue-50
                    text-blue-600
                    text-xs
                    font-semibold
                    hover:bg-blue-100
                    transition
                  "
                >
                  View Instruction File
                </a>
              </div>
            )}
          </section>


          {/* =================================================
              NO SUBMISSION
          ================================================= */}

          {!hasSubmission && (
            <section
              className="
                bg-white
                rounded-xl
                border
                border-gray-100
                shadow-sm
                p-8
                text-center
              "
            >
              <div
                className="
                  w-12
                  h-12
                  bg-gray-100
                  rounded-full
                  flex
                  items-center
                  justify-center
                  mx-auto
                  mb-3
                "
              >
                —
              </div>


              <h2
                className="
                  text-base
                  font-bold
                  text-gray-800
                "
              >
                No Submission
              </h2>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                You did not submit this
                assessment before it closed.
              </p>
            </section>
          )}


          {/* =================================================
              SUBMISSION SUMMARY
          ================================================= */}

          {hasSubmission && (
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
                  Your Submission
                </h2>

                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  Submission status,
                  score and feedback.
                </p>
              </div>


              <div
                className="
                  p-6
                  grid
                  grid-cols-1
                  sm:grid-cols-2
                  lg:grid-cols-4
                  gap-4
                "
              >

                {/* STATUS */}
                <div
                  className="
                    bg-gray-50
                    rounded-xl
                    p-4
                  "
                >
                  <p
                    className="
                      text-[11px]
                      uppercase
                      font-semibold
                      text-gray-400
                    "
                  >
                    Status
                  </p>


                  <span
                    className={`
                      inline-flex
                      mt-2
                      px-2.5
                      py-1
                      rounded-full
                      text-[10px]
                      font-bold

                      ${
                        getSubmissionStatusClasses(
                          submission.status
                        )
                      }
                    `}
                  >
                    {
                      submission.status
                    }
                  </span>
                </div>


                {/* SUBMITTED AT */}
                <div
                  className="
                    bg-gray-50
                    rounded-xl
                    p-4
                  "
                >
                  <p
                    className="
                      text-[11px]
                      uppercase
                      font-semibold
                      text-gray-400
                    "
                  >
                    Submitted At
                  </p>

                  <p
                    className="
                      text-sm
                      font-semibold
                      text-gray-700
                      mt-2
                    "
                  >
                    {
                      formatDateTime(
                        submission.submittedAt
                      )
                    }
                  </p>
                </div>


                {/* SCORE */}
                <div
                  className="
                    bg-gray-50
                    rounded-xl
                    p-4
                  "
                >
                  <p
                    className="
                      text-[11px]
                      uppercase
                      font-semibold
                      text-gray-400
                    "
                  >
                    Score
                  </p>

                  <p
                    className="
                      text-xl
                      font-bold
                      text-gray-800
                      mt-2
                    "
                  >
                    {
                      scoreAvailable
                        ? `${submission.score} / ${assessment.totalPoints}`
                        : 'Pending'
                    }
                  </p>
                </div>


                {/* LATE */}
                <div
                  className="
                    bg-gray-50
                    rounded-xl
                    p-4
                  "
                >
                  <p
                    className="
                      text-[11px]
                      uppercase
                      font-semibold
                      text-gray-400
                    "
                  >
                    Submission Time
                  </p>

                  <span
                    className={`
                      inline-flex
                      mt-2
                      px-2.5
                      py-1
                      rounded-full
                      text-[10px]
                      font-bold

                      ${
                        submission.late
                          ? `
                            bg-amber-100
                            text-amber-700
                          `
                          : `
                            bg-green-100
                            text-green-700
                          `
                      }
                    `}
                  >
                    {
                      submission.late
                        ? 'LATE'
                        : 'ON TIME'
                    }
                  </span>
                </div>
              </div>


              {/* FEEDBACK */}
              <div
                className="
                  px-6
                  pb-6
                "
              >
                <div
                  className="
                    border-t
                    border-gray-100
                    pt-5
                  "
                >
                  <p
                    className="
                      text-xs
                      uppercase
                      font-semibold
                      text-gray-400
                    "
                  >
                    Educator Feedback
                  </p>

                  <p
                    className="
                      text-sm
                      text-gray-600
                      leading-6
                      whitespace-pre-wrap
                      mt-2
                    "
                  >
                    {
                      submission.feedback ||
                      'No feedback has been provided yet.'
                    }
                  </p>
                </div>
              </div>
            </section>
          )}


          {/* =================================================
              QUESTIONS / ANSWERS
          ================================================= */}

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
                Assessment Questions
              </h2>

              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Review the assessment
                and your submitted answers.
              </p>
            </div>


            {questions.length === 0 ? (
              <div
                className="
                  p-10
                  text-center
                  text-sm
                  text-gray-500
                "
              >
                No questions are available
                for this assessment.
              </div>

            ) : (
              <div
                className="
                  divide-y
                  divide-gray-100
                "
              >
                {questions.map(
                  (
                    question,
                    index
                  ) => {
                    const learnerAnswer =
                      answerByQuestionId.get(
                        String(
                          question.questionId
                        )
                      );


                    const response =
                      learnerAnswer
                        ?.response;


                    const awardedPoints =
                      learnerAnswer
                        ?.awardedPoints;


                    const options =
                      normalizeOptions(
                        question.options
                      );


                    const isMultipleChoice =
                      question.type ===
                      'MULTIPLE_CHOICE';


                    return (
                      <article
                        key={
                          question.questionId
                        }
                        className="
                          p-6
                        "
                      >
                        {/* Question header */}
                        <div
                          className="
                            flex
                            items-start
                            justify-between
                            gap-4
                          "
                        >
                          <div
                            className="
                              flex
                              items-start
                              gap-3
                            "
                          >
                            <div
                              className="
                                w-8
                                h-8
                                rounded-lg
                                bg-blue-50
                                text-blue-600
                                flex
                                items-center
                                justify-center
                                flex-shrink-0
                                text-xs
                                font-bold
                              "
                            >
                              {
                                index +
                                1
                              }
                            </div>


                            <div>
                              <h3
                                className="
                                  text-sm
                                  font-semibold
                                  text-gray-800
                                  leading-6
                                "
                              >
                                {
                                  question.content
                                }
                              </h3>


                              <p
                                className="
                                  text-[11px]
                                  text-gray-400
                                  mt-1
                                "
                              >
                                {
                                  question.points ??
                                  0
                                }{' '}
                                points
                              </p>
                            </div>
                          </div>


                          {awardedPoints !==
                            null &&
                            awardedPoints !==
                            undefined && (
                            <span
                              className="
                                flex-shrink-0
                                px-2.5
                                py-1
                                rounded-full
                                bg-gray-100
                                text-gray-600
                                text-xs
                                font-semibold
                              "
                            >
                              {
                                awardedPoints
                              }
                              {' / '}
                              {
                                question.points ??
                                0
                              }
                            </span>
                          )}
                        </div>


                        {/* MULTIPLE CHOICE */}
                        {isMultipleChoice && (
                          <div
                            className="
                              mt-5
                              ml-11
                              space-y-2
                            "
                          >
                            {options.map(
                              (
                                option,
                                optionIndex
                              ) => {
                                const selected =
                                  response !==
                                    null &&
                                  response !==
                                    undefined &&
                                  String(
                                    response
                                  ) ===
                                  String(
                                    option.content
                                  );


                                return (
                                  <div
                                    key={
                                      option.optionId ||
                                      optionIndex
                                    }
                                    className={`
                                      flex
                                      items-center
                                      gap-3
                                      rounded-xl
                                      border
                                      px-4
                                      py-3

                                      ${
                                        selected
                                          ? `
                                            border-blue-300
                                            bg-blue-50
                                          `
                                          : `
                                            border-gray-100
                                            bg-white
                                          `
                                      }
                                    `}
                                  >
                                    <div
                                      className={`
                                        w-5
                                        h-5
                                        rounded-full
                                        border-2
                                        flex
                                        items-center
                                        justify-center
                                        flex-shrink-0

                                        ${
                                          selected
                                            ? `
                                              border-blue-500
                                              bg-blue-500
                                            `
                                            : `
                                              border-gray-300
                                            `
                                        }
                                      `}
                                    >
                                      {selected && (
                                        <div
                                          className="
                                            w-2
                                            h-2
                                            rounded-full
                                            bg-white
                                          "
                                        />
                                      )}
                                    </div>


                                    <span
                                      className={`
                                        text-sm

                                        ${
                                          selected
                                            ? `
                                              text-blue-700
                                              font-semibold
                                            `
                                            : `
                                              text-gray-600
                                            `
                                        }
                                      `}
                                    >
                                      {
                                        option.content
                                      }
                                    </span>


                                    {selected && (
                                      <span
                                        className="
                                          ml-auto
                                          text-[10px]
                                          font-bold
                                          text-blue-600
                                        "
                                      >
                                        YOUR ANSWER
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                            )}


                            {!learnerAnswer && (
                              <p
                                className="
                                  text-xs
                                  text-gray-400
                                  italic
                                  mt-2
                                "
                              >
                                No answer submitted
                                for this question.
                              </p>
                            )}
                          </div>
                        )}


                        {/* OTHER QUESTION TYPES */}
                        {!isMultipleChoice && (
                          <div
                            className="
                              mt-5
                              ml-11
                            "
                          >
                            <p
                              className="
                                text-[11px]
                                uppercase
                                font-semibold
                                text-gray-400
                                mb-2
                              "
                            >
                              Your Answer
                            </p>


                            <div
                              className="
                                bg-gray-50
                                border
                                border-gray-100
                                rounded-xl
                                p-4
                              "
                            >
                              <p
                                className="
                                  text-sm
                                  text-gray-600
                                  whitespace-pre-wrap
                                "
                              >
                                {
                                  response !==
                                    null &&
                                  response !==
                                    undefined &&
                                  String(
                                    response
                                  ).trim()
                                    ? String(
                                        response
                                      )
                                    : 'No answer submitted.'
                                }
                              </p>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>


          {/* =================================================
              SUBMITTED FILES
          ================================================= */}

          {files.length > 0 && (
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
                  Submitted Files
                </h2>

                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  Files included in your
                  submitted assignment.
                </p>
              </div>


              <div
                className="
                  p-6
                  space-y-2
                "
              >
                {files.map(
                  (
                    file,
                    index
                  ) => {
                    /*
                     * Supports either:
                     * "https://..."
                     *
                     * or:
                     * {
                     *   url: "...",
                     *   name: "..."
                     * }
                     */
                    const fileUrl =
                      typeof file ===
                        'string'
                        ? file
                        : (
                            file?.url ||
                            file?.resourceUrl ||
                            ''
                          );


                    const fileName =
                      typeof file ===
                        'object' &&
                      file?.name
                        ? file.name
                        : getFileNameFromUrl(
                            fileUrl,
                            index
                          );


                    return (
                      <a
                        key={
                          `${fileUrl}-${index}`
                        }
                        href={
                          fileUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="
                          flex
                          items-center
                          justify-between
                          gap-4
                          border
                          border-gray-100
                          rounded-xl
                          px-4
                          py-3
                          hover:border-blue-200
                          hover:bg-blue-50/30
                          transition
                        "
                      >
                        <div
                          className="
                            flex
                            items-center
                            gap-3
                            min-w-0
                          "
                        >
                          <div
                            className="
                              w-9
                              h-9
                              rounded-lg
                              bg-blue-50
                              flex
                              items-center
                              justify-center
                              flex-shrink-0
                            "
                          >
                            📎
                          </div>


                          <span
                            className="
                              text-sm
                              font-semibold
                              text-gray-700
                              truncate
                            "
                          >
                            {
                              fileName
                            }
                          </span>
                        </div>


                        <span
                          className="
                            flex-shrink-0
                            text-xs
                            font-semibold
                            text-blue-600
                          "
                        >
                          Open
                        </span>
                      </a>
                    );
                  }
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}