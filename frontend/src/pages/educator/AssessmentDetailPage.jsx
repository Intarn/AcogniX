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
  getAssessmentById,
  getAssessmentQuestions,
  getAssessmentSubmissions
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


function formatFileSize(bytes) {
  if (
    bytes === null ||
    bytes === undefined
  ) {
    return '';
  }


  const numericBytes =
    Number(bytes);


  if (
    !Number.isFinite(
      numericBytes
    )
  ) {
    return '';
  }


  if (
    numericBytes < 1024
  ) {
    return `${numericBytes} B`;
  }


  if (
    numericBytes <
    1024 * 1024
  ) {
    return `${Math.ceil(
      numericBytes / 1024
    )} KB`;
  }


  return `${(
    numericBytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
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
  if (
    type === 'QUIZ'
  ) {
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
    assessment.status ===
      'DRAFT' ||
    assessment.status ===
      'SCHEDULED'
  );
}

function normalizeQuestion(
  question
) {
  const rawOptions =
    Array.isArray(
      question?.options
    )
      ? question.options
      : [];


  const options =
    rawOptions.map(
      (option, index) => {
        if (
          option &&
          typeof option ===
            'object'
        ) {
          return {
            optionId:
              option.optionId ||
              `${question.questionId}-option-${index + 1}`,

            content:
              option.content || '',

            isCorrect:
              option.isCorrect ===
                true ||
              (
                question.correctAnswer !=
                  null &&
                String(
                  option.content
                ) ===
                  String(
                    question.correctAnswer
                  )
              )
          };
        }


        const content =
          String(
            option ?? ''
          );


        return {
          optionId:
            `${question.questionId}-option-${index + 1}`,

          content,

          isCorrect:
            question.correctAnswer !=
              null &&
            content ===
              String(
                question.correctAnswer
              )
        };
      }
    );


  return {
    ...question,

    options:
      question.type ===
      'MULTIPLE_CHOICE'
        ? options
        : []
  };
}


export default function AssessmentDetailPage() {
  const {
    courseId:
      routeCourseId,

    assessmentId:
      routeAssessmentId
  } = useParams();


  const courseId =
    routeCourseId || null;


  const assessmentId =
    routeAssessmentId || null;
  
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
    if (
      !courseId ||
      !assessmentId
    ) {
      setCourse(null);
      setAssessment(null);
      setQuestions([]);
      setSubmissions([]);
      setLoadError('');
      setLoading(false);

      return;
    }


    let cancelled = false;


    async function loadAssessmentDetail() {
      try {
        setLoading(true);
        setLoadError('');


        const [
          courseResult,
          assessmentResult,
          questionResult,
          submissionResult
        ] = await Promise.all([
          getCourses(),

          getAssessmentById(
            assessmentId
          ),

          getAssessmentQuestions(
            assessmentId
          ),

          getAssessmentSubmissions(
            assessmentId
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


        const loadedAssessment =
          assessmentResult
            ?.assessment ||
          assessmentResult ||
          null;


        const assessmentBelongsToCourse =
          loadedAssessment &&
          String(
            loadedAssessment.courseId
          ) ===
          String(courseId);


        const loadedQuestions =
          Array.isArray(
            questionResult?.questions
          )
            ? questionResult.questions
                .map(
                  normalizeQuestion
                )
                .sort(
                  (
                    first,
                    second
                  ) =>
                    Number(
                      first.displayOrder ??
                      first.orderIndex ??
                      0
                    ) -
                    Number(
                      second.displayOrder ??
                      second.orderIndex ??
                      0
                    )
                )
            : [];


        const loadedSubmissions =
          Array.isArray(
            submissionResult
              ?.submissions
          )
            ? submissionResult
                .submissions
            : [];


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );


        setAssessment(
          assessmentBelongsToCourse
            ? loadedAssessment
            : null
        );


        setQuestions(
          loadedQuestions
        );


        setSubmissions(
          loadedSubmissions
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load assessment detail:',
            error
          );


          setCourse(null);
          setAssessment(null);
          setQuestions([]);
          setSubmissions([]);


          setLoadError(
            error.message ||
            'Unable to load assessment details.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadAssessmentDetail();


    return () => {
      cancelled = true;
    };
  }, [
    assessmentId,
    courseId
  ]);

  const questionPointsTotal =
    useMemo(() => {
      return questions.reduce(
        (
          total,
          question
        ) =>
          total +
          Number(
            question.points ||
            0
          ),
        0
      );
    }, [
      questions
    ]);

  const pendingReviewCount =
    useMemo(() => {
      return submissions.filter(
        (submission) =>
          submission?.status ===
          'PENDING_REVIEW'
      ).length;
    }, [submissions]);


  const gradedCount =
    useMemo(() => {
      return submissions.filter(
        (submission) =>
          submission?.status ===
          'GRADED'
      ).length;
    }, [submissions]);

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
          Loading assessment details...
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
          to={
            courseId
              ? `/educator/courses/${courseId}/assessments`
              : '/educator/courses'
          }
          className="
            inline-block
            mt-3
            text-sm
            font-semibold
            text-blue-600
            hover:underline
          "
        >
          Back to Assessments
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <NotFoundState
        title="Course Not Found"
        message="The requested course does not exist."
        backTo="/educator/courses"
        backLabel="Back to My Courses"
      />
    );
  }


  if (!assessment) {
    return (
      <NotFoundState
        title="Assessment Not Found"
        message="The requested assessment does not exist in this course."
        backTo={
          `/educator/courses/${course.courseId}/assessments`
        }
        backLabel="Back to Assessments"
      />
    );
  }

  const courseArchived =
    course.status ===
    'ARCHIVED';


  const editable =
    !courseArchived &&
    isEditableAssessment(
      assessment
    );

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
              text-xs
              text-gray-400
              mb-1
              flex-wrap
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


            <Link
              to={
                `/educator/courses/${course.courseId}/assessments`
              }
              className="
                hover:text-blue-600
              "
            >
              Assessments
            </Link>


            <span>/</span>


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
              items-center
              gap-3
              flex-wrap
            "
          >
            <h1
              className="
                text-lg
                font-bold
                text-gray-800
              "
            >
              {
                assessment.title
              }
            </h1>


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
          </div>
        </div>


        <div
          className="
            flex
            items-center
            gap-3
            flex-shrink-0
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
              bg-blue-50
              hover:bg-blue-100
              px-4
              py-2
              rounded-lg
            "
          >
            View Submissions
          </Link>


          {editable && (
            <Link
              to={
                `/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/edit`
              }
              className="
                text-xs
                font-semibold
                text-white
                bg-blue-600
                hover:bg-blue-700
                px-4
                py-2
                rounded-lg
                shadow-sm
              "
            >
              Edit Assessment
            </Link>
          )}
        </div>
      </header>


      <main
        className="
          p-6
        "
      >
        <div
          className="
            max-w-6xl
            mx-auto
            space-y-6
          "
        >
          {/* ARCHIVED */}
          {courseArchived && (
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
              Assessment information is
              available for viewing only.
            </div>
          )}


          {/* SUMMARY */}
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
                Assessment Overview
              </h2>


              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                General information,
                scoring and current
                assessment status.
              </p>
            </div>


            <div
              className="
                p-6
                space-y-6
              "
            >
              <div
                className="
                  grid
                  grid-cols-1
                  sm:grid-cols-2
                  lg:grid-cols-4
                  gap-4
                "
              >
                <InfoCard
                  label="Type"
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
                </InfoCard>


                <InfoCard
                  label="Total Points"
                  value={
                    assessment.totalPoints ??
                    0
                  }
                />


                <InfoCard
                  label="Questions"
                  value={
                    questions.length
                  }
                />


                <InfoCard
                  label="Submissions"
                  value={
                    submissions.length
                  }
                />
              </div>


              <div>
                <p
                  className="
                    text-xs
                    uppercase
                    font-semibold
                    text-gray-400
                  "
                >
                  Description
                </p>


                <p
                  className="
                    text-sm
                    text-gray-600
                    leading-6
                    mt-2
                    whitespace-pre-wrap
                  "
                >
                  {
                    assessment.description ||
                    'No description provided.'
                  }
                </p>
              </div>
            </div>
          </section>


          {/* TWO COLUMN */}
          <div
            className="
              grid
              grid-cols-1
              lg:grid-cols-3
              gap-6
            "
          >
            {/* LEFT */}
            <div
              className="
                lg:col-span-2
                space-y-6
              "
            >
              {/* INSTRUCTIONS */}
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
                <SectionHeader
                  title="Instructions"
                  description="Instructions and reference file provided to learners."
                />


                <div
                  className="
                    p-6
                  "
                >
                  <p
                    className="
                      text-sm
                      text-gray-600
                      leading-6
                      whitespace-pre-wrap
                    "
                  >
                    {
                      assessment.instructions ||
                      'No written instructions provided.'
                    }
                  </p>


                    {assessment.instructionFileUrl && (
                    <div
                      className="
                        mt-5
                        bg-gray-50
                        border
                        border-gray-100
                        rounded-xl
                        p-4
                        flex
                        items-center
                        justify-between
                        gap-4
                      "
                    >
                      <div
                        className="
                          min-w-0
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
                          Instruction File
                        </p>


                        <p
                          className="
                            text-sm
                            font-semibold
                            text-gray-700
                            mt-1
                            truncate
                          "
                        >
                          {
                            assessment
                              .instructionFileName ||
                            'Assessment instruction file'
                          }
                        </p>


                        {assessment
                          .instructionFileSizeBytes !==
                          undefined &&
                          assessment
                            .instructionFileSizeBytes !==
                            null && (
                          <p
                            className="
                              text-xs
                              text-gray-400
                              mt-1
                            "
                          >
                            {
                              formatFileSize(
                                assessment
                                  .instructionFileSizeBytes
                              )
                            }
                          </p>
                        )}
                      </div>


                      <a
                        href={
                          assessment
                            .instructionFileUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="
                          text-[10px]
                          font-bold
                          text-blue-600
                          bg-white
                          border
                          border-blue-200
                          hover:bg-blue-50
                          rounded-lg
                          px-3
                          py-2
                          flex-shrink-0
                        "
                      >
                        Open File
                      </a>
                    </div>
                  )}
                </div>
              </section>


              {/* QUESTIONS */}
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
                      Questions
                    </h2>


                    <p
                      className="
                        text-xs
                        text-gray-400
                        mt-1
                      "
                    >
                      Questions included
                      in this assessment.
                    </p>
                  </div>


                  <span
                    className="
                      text-xs
                      font-semibold
                      text-gray-500
                    "
                  >
                    {
                      questionPointsTotal
                    }
                    {' / '}
                    {
                      assessment.totalPoints ??
                      0
                    }{' '}
                    points
                  </span>
                </div>


                {questions.length ===
                0 ? (
                  <div
                    className="
                      py-12
                      px-6
                      text-center
                    "
                  >
                    <p
                      className="
                        text-sm
                        text-gray-500
                      "
                    >
                      No questions have
                      been added to this
                      assessment.
                    </p>
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
                      ) => (
                        <QuestionCard
                          key={
                            question.questionId
                          }
                          question={
                            question
                          }
                          number={
                            index + 1
                          }
                        />
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
              {/* SCHEDULE */}
              <section
                className="
                  bg-white
                  rounded-xl
                  border
                  border-gray-100
                  shadow-sm
                  p-5
                "
              >
                <h2
                  className="
                    text-sm
                    font-bold
                    text-gray-800
                  "
                >
                  Schedule
                </h2>


                <div
                  className="
                    mt-4
                    space-y-4
                  "
                >
                  <DetailItem
                    label="Start Time"
                    value={
                      formatDateTime(
                        assessment.startTime
                      )
                    }
                  />


                  <DetailItem
                    label="Deadline"
                    value={
                      formatDateTime(
                        assessment.deadline
                      )
                    }
                  />


                  <div
                    className="
                      pt-3
                      border-t
                      border-gray-100
                    "
                  >
                    <p
                      className="
                        text-xs
                        text-gray-400
                      "
                    >
                      Late Submission
                    </p>


                    <span
                      className={`
                        inline-flex
                        mt-2
                        rounded-full
                        px-2.5
                        py-1
                        text-[10px]
                        font-bold

                        ${
                          assessment
                            .allowLateSubmission
                            ? `
                              bg-green-100
                              text-green-700
                            `
                            : `
                              bg-gray-100
                              text-gray-600
                            `
                        }
                      `}
                    >
                      {
                        assessment
                          .allowLateSubmission
                          ? 'ALLOWED'
                          : 'NOT ALLOWED'
                      }
                    </span>
                  </div>
                </div>
              </section>


              {/* SUBMISSION SUMMARY */}
              <section
                className="
                  bg-white
                  rounded-xl
                  border
                  border-gray-100
                  shadow-sm
                  p-5
                "
              >
                <h2
                  className="
                    text-sm
                    font-bold
                    text-gray-800
                  "
                >
                  Submission Summary
                </h2>


                <div
                  className="
                    mt-4
                    space-y-3
                  "
                >
                  <StatRow
                    label="Total"
                    value={
                      submissions.length
                    }
                  />


                  <StatRow
                    label="Pending Review"
                    value={
                      pendingReviewCount
                    }
                  />


                  <StatRow
                    label="Graded"
                    value={
                      gradedCount
                    }
                  />
                </div>


                <Link
                  to={
                    `/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}/submissions`
                  }
                  className="
                    block
                    w-full
                    text-center
                    mt-5
                    text-xs
                    font-semibold
                    text-blue-600
                    bg-blue-50
                    hover:bg-blue-100
                    px-3
                    py-2.5
                    rounded-lg
                  "
                >
                  View Submissions
                </Link>
              </section>


              {/* COURSE */}
              <section
                className="
                  bg-white
                  rounded-xl
                  border
                  border-gray-100
                  shadow-sm
                  p-5
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
                  Course
                </p>


                <Link
                  to={
                    `/educator/courses/${course.courseId}`
                  }
                  className="
                    block
                    mt-3
                    hover:text-blue-600
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
                      course.subjectName
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
                      course.courseCode
                    }
                  </p>
                </Link>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}


function QuestionCard({
  question,
  number
}) {
  return (
    <article
      className="
        p-5
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
            rounded-full
            bg-gray-100
            flex
            items-center
            justify-center
            flex-shrink-0
            text-xs
            font-bold
            text-gray-600
          "
        >
          {number}
        </div>


        <div
          className="
            min-w-0
            flex-1
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
            <span
              className="
                bg-blue-50
                text-blue-700
                rounded-full
                px-2.5
                py-1
                text-[10px]
                font-bold
              "
            >
              {
                question.type
              }
            </span>


            <span
              className="
                text-[10px]
                font-semibold
                text-gray-400
              "
            >
              {
                question.points
              }{' '}
              points
            </span>
          </div>


          <p
            className="
              text-sm
              font-semibold
              text-gray-800
              leading-6
              mt-3
            "
          >
            {
              question.content
            }
          </p>


          {question.type ===
            'MULTIPLE_CHOICE' &&
            Array.isArray(
              question.options
            ) && (
              <div
                className="
                  mt-4
                  grid
                  grid-cols-1
                  md:grid-cols-2
                  gap-2
                "
              >
                {question.options.map(
                  (
                    option,
                    index
                  ) => (
                    <div
                      key={
                        option.optionId
                      }
                      className={`
                        rounded-lg
                        border
                        px-3
                        py-2.5
                        flex
                        items-center
                        gap-3

                        ${
                          option.isCorrect
                            ? `
                              border-green-200
                              bg-green-50
                            `
                            : `
                              border-gray-100
                              bg-gray-50
                            `
                        }
                      `}
                    >
                      <span
                        className={`
                          w-6
                          h-6
                          rounded-full
                          flex
                          items-center
                          justify-center
                          text-[10px]
                          font-bold
                          flex-shrink-0

                          ${
                            option.isCorrect
                              ? `
                                bg-green-100
                                text-green-700
                              `
                              : `
                                bg-gray-200
                                text-gray-600
                              `
                          }
                        `}
                      >
                        {
                          String.fromCharCode(
                            65 + index
                          )
                        }
                      </span>


                      <span
                        className="
                          text-xs
                          text-gray-600
                          flex-1
                        "
                      >
                        {
                          option.content
                        }
                      </span>


                      {option.isCorrect && (
                        <span
                          className="
                            text-[10px]
                            font-bold
                            text-green-600
                          "
                        >
                          Correct
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}


          {question.type ===
            'ESSAY' && (
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
                  text-xs
                  text-gray-500
                "
              >
                Written response —
                manual review may be
                required.
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}


function SectionHeader({
  title,
  description
}) {
  return (
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
        {title}
      </h2>


      {description && (
        <p
          className="
            text-xs
            text-gray-400
            mt-1
          "
        >
          {description}
        </p>
      )}
    </div>
  );
}


function InfoCard({
  label,
  value,
  children
}) {
  return (
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
        {label}
      </p>


      {children || (
        <p
          className="
            text-lg
            font-bold
            text-gray-800
            mt-2
          "
        >
          {value}
        </p>
      )}
    </div>
  );
}


function DetailItem({
  label,
  value
}) {
  return (
    <div>
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
          text-sm
          font-semibold
          text-gray-700
          mt-1
        "
      >
        {value}
      </p>
    </div>
  );
}


function StatRow({
  label,
  value
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        gap-4
      "
    >
      <span
        className="
          text-xs
          text-gray-500
        "
      >
        {label}
      </span>


      <span
        className="
          text-sm
          font-bold
          text-gray-700
        "
      >
        {value}
      </span>
    </div>
  );
}


function NotFoundState({
  title,
  message,
  backTo,
  backLabel
}) {
  return (
    <div
      className="
        flex-1
        flex
        items-center
        justify-center
        p-6
      "
    >
      <div
        className="
          bg-white
          border
          border-gray-100
          rounded-xl
          shadow-sm
          p-8
          w-full
          max-w-md
          text-center
        "
      >
        <div
          className="
            w-12
            h-12
            mx-auto
            rounded-full
            bg-red-50
            text-red-500
            flex
            items-center
            justify-center
            font-bold
          "
        >
          !
        </div>


        <h1
          className="
            text-lg
            font-bold
            text-gray-800
            mt-4
          "
        >
          {title}
        </h1>


        <p
          className="
            text-sm
            text-gray-500
            mt-2
          "
        >
          {message}
        </p>


        <Link
          to={
            backTo
          }
          className="
            inline-block
            mt-5
            text-sm
            font-semibold
            text-blue-600
            hover:underline
          "
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}