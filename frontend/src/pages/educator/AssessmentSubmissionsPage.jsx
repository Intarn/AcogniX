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
  getCourseMembers
} from '../../features/classroom/enrollmentApi';

import {
  getAssessmentById,
  getAssessmentQuestions,
  getAssessmentSubmissions,
  getSubmissionById,
  gradeSubmission
} from '../../features/assessment/assessmentApi';


function formatDateTime(value) {
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


function getStatusClasses(status) {
  switch (status) {
    case 'IN_PROGRESS':
      return `
        bg-blue-100
        text-blue-700
      `;

    case 'SUBMITTED':
      return `
        bg-violet-100
        text-violet-700
      `;

    case 'PENDING_REVIEW':
      return `
        bg-amber-100
        text-amber-700
      `;

    case 'GRADED':
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

function getFileNameFromUrl(
  url,
  index
) {
  if (!url) {
    return `Submitted file ${index + 1}`;
  }


  try {
    const cleanUrl =
      String(url)
        .split('?')[0];


    const storedFileName =
      cleanUrl
        .split('/')
        .pop();


    if (!storedFileName) {
      return `Submitted file ${index + 1}`;
    }


    const decodedFileName =
      decodeURIComponent(
        storedFileName
      );

    const separatorIndex =
      decodedFileName.indexOf('__');


    if (
      separatorIndex !== -1
    ) {
      return decodedFileName.slice(
        separatorIndex + 2
      );
    }


    /*
     * File cũ không có "__"
     * thì giữ nguyên tên.
     */
    return (
      decodedFileName ||
      `Submitted file ${index + 1}`
    );

  } catch {
    return (
      `Submitted file ${index + 1}`
    );
  }
}

function normalizeFile(
  file,
  index
) {
  if (
    typeof file ===
    'string'
  ) {
    return {
      name:
        getFileNameFromUrl(
          file,
          index
        ),

      url:
        file
    };
  }


  return {
    ...file,

    name:
      file?.name ||
      file?.fileName ||
      getFileNameFromUrl(
        file?.url ||
        file?.fileUrl,
        index
      ),

    url:
      file?.url ||
      file?.fileUrl ||
      ''
  };
}

function normalizeSubmission(
  submission
) {
  if (!submission) {
    return null;
  }


  const directFiles =
    Array.isArray(
      submission.files
    )
      ? submission.files
      : [];


  const uploadedFileUrls =
    Array.isArray(
      submission.uploadedFileUrls
    )
      ? submission.uploadedFileUrls
      : [];


  const rawFiles =
    directFiles.length > 0
      ? directFiles
      : uploadedFileUrls;


  return {
    ...submission,

    /*
     * Backend domain uses "late".
     * Old frontend uses "isLate".
     */
    isLate:
      submission.isLate ??
      submission.late ??
      false,

    answers:
      Array.isArray(
        submission.answers
      )
        ? submission.answers
        : [],

    files:
      rawFiles.map(
        normalizeFile
      )
  };
}

export default function AssessmentSubmissionsPage() {
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
    assessmentQuestions,
    setAssessmentQuestions
  ] = useState([]);


  const [
    learners,
    setLearners
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


  const [
    openingSubmissionId,
    setOpeningSubmissionId
  ] = useState(null);


  const [
    savingGrade,
    setSavingGrade
  ] = useState(false);

  const [
    filter,
    setFilter
  ] = useState(
    'ALL'
  );


  const [
    selectedSubmission,
    setSelectedSubmission
  ] = useState(null);


  const [
    score,
    setScore
  ] = useState('');


  const [
    feedback,
    setFeedback
  ] = useState('');


  const [
    reviewError,
    setReviewError
  ] = useState('');

  useEffect(() => {
    if (
      !courseId ||
      !assessmentId
    ) {
      setCourse(null);
      setAssessment(null);
      setAssessmentQuestions([]);
      setLearners([]);
      setSubmissions([]);
      setLoadError('');
      setLoading(false);

      return;
    }


    let cancelled = false;


    async function loadSubmissionsPage() {
      try {
        setLoading(true);
        setLoadError('');


        const [
          courseResult,
          assessmentResult,
          questionResult,
          submissionResult,
          memberResult
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
          ),

          getCourseMembers(
            courseId
          )
        ]);


        /*
        * =========================
        * COURSE
        * =========================
        */
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


        /*
        * =========================
        * ASSESSMENT
        * =========================
        */
        const loadedAssessment =
          assessmentResult
            ?.assessment ||
          assessmentResult ||
          null;


        const validAssessment =
          loadedAssessment &&
          String(
            loadedAssessment.courseId
          ) ===
          String(courseId)
            ? loadedAssessment
            : null;


        /*
        * =========================
        * QUESTIONS
        * =========================
        */
        const loadedQuestions =
          Array.isArray(
            questionResult?.questions
          )
            ? [
                ...questionResult.questions
              ].sort(
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


        /*
        * =========================
        * SUBMISSIONS
        * =========================
        */
        const rawEntries =
          Array.isArray(
            submissionResult
              ?.submissions
          )
            ? submissionResult
                .submissions
            : [];


        const loadedSubmissions =
          rawEntries
            .map(
              (entry) =>
                normalizeSubmission(
                  entry?.submission ||
                  entry
                )
            )
            .filter(Boolean);


        /*
        * =========================
        * LEARNERS
        * =========================
        *
        * 1. Prefer Learners embedded
        *    in submission API.
        *
        * 2. Fall back to enrollment
        *    members API.
        */
        const embeddedLearners =
          rawEntries
            .map(
              (entry) =>
                entry?.learner ||
                entry?.user ||
                null
            )
            .filter(Boolean);


        const memberRows =
          Array.isArray(
            memberResult?.members
          )
            ? memberResult.members
            : [];


        const memberLearners =
          memberRows
            .map(
              (member) =>
                member?.learner ||
                member?.user ||
                null
            )
            .filter(Boolean);


        const learnerMap =
          new Map();


        [
          ...memberLearners,
          ...embeddedLearners
        ].forEach(
          (learner) => {
            const learnerId =
              learner?.userId ??
              learner?.id;


            if (learnerId) {
              learnerMap.set(
                String(learnerId),
                learner
              );
            }
          }
        );


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );


        setAssessment(
          validAssessment
        );


        setAssessmentQuestions(
          loadedQuestions
        );


        setSubmissions(
          loadedSubmissions
        );


        setLearners(
          Array.from(
            learnerMap.values()
          )
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load assessment submissions:',
            error
          );


          setCourse(null);
          setAssessment(null);
          setAssessmentQuestions([]);
          setLearners([]);
          setSubmissions([]);


          setLoadError(
            error.message ||
            'Unable to load assessment submissions.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadSubmissionsPage();


    return () => {
      cancelled = true;
    };
  }, [
    assessmentId,
    courseId
  ]);


  const assessmentSubmissions =
    useMemo(() => {
      return submissions
        .filter(
          (submission) =>
            String(
              submission.assessmentId
            ) ===
            String(assessmentId)
        )
        .sort(
          (first, second) =>
            new Date(
              second.submittedAt ||
              0
            ).getTime() -
            new Date(
              first.submittedAt ||
              0
            ).getTime()
        );
    }, [
      submissions,
      assessmentId
    ]);


  const rows =
    useMemo(() => {
      return assessmentSubmissions.map(
        (submission) => {
          const learner =
            learners.find(
              (user) =>
                String(
                  user.userId ??
                  user.id
                ) ===
                String(
                  submission.learnerId
                )
            );


          return {
            submission,

            learner:
              learner || {
                userId:
                  submission.learnerId,

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
      assessmentSubmissions,
      learners
    ]);


  const filteredRows =
    useMemo(() => {
      if (
        filter ===
        'ALL'
      ) {
        return rows;
      }


      return rows.filter(
        ({ submission }) =>
          submission.status ===
          filter
      );
    }, [
      rows,
      filter
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
          Loading submissions...
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
        backTo="/educator/courses"
      />
    );
  }


  if (!assessment) {
    return (
      <NotFoundState
        title="Assessment Not Found"
        backTo={
          `/educator/courses/${course.courseId}/assessments`
        }
      />
    );
  }


  const isArchived =
    course.status ===
    'ARCHIVED';


  const pendingReviewCount =
    assessmentSubmissions.filter(
      (submission) =>
        submission.status ===
        'PENDING_REVIEW'
    ).length;


  const gradedCount =
    assessmentSubmissions.filter(
      (submission) =>
        submission.status ===
        'GRADED'
    ).length;


  const submittedCount =
    assessmentSubmissions.filter(
      (submission) =>
        submission.status ===
        'SUBMITTED'
    ).length;


  async function openSubmission(
    submission
  ) {
    if (!submission) {
      return;
    }


    try {
      setOpeningSubmissionId(
        submission.submissionId
      );


      setReviewError('');


      const result =
        await getSubmissionById(
          submission.submissionId
        );


      const detailSubmission =
        result?.submission ||
        result ||
        {};


      const mergedSubmission =
        normalizeSubmission({
          ...submission,
          ...detailSubmission,

          answers:
            Array.isArray(
              result?.answers
            )
              ? result.answers
              : (
                  Array.isArray(
                    detailSubmission
                      ?.answers
                  )
                    ? detailSubmission
                        .answers
                    : []
                ),

          files:
            Array.isArray(
              result?.files
            )
              ? result.files
              : detailSubmission
                  ?.files
        });


      setSelectedSubmission(
        mergedSubmission
      );


      setScore(
        mergedSubmission.score ??
        ''
      );


      setFeedback(
        mergedSubmission.feedback ??
        ''
      );
    } catch (error) {
      console.error(
        'Unable to load submission detail:',
        error
      );


      alert(
        error.message ||
        'Unable to load submission details.'
      );
    } finally {
      setOpeningSubmissionId(
        null
      );
    }
  }


  function closeSubmission() {
    setSelectedSubmission(
      null
    );

    setScore('');

    setFeedback('');

    setReviewError('');
  }


  async function handleSaveGrade() {
    if (
      !selectedSubmission
    ) {
      return;
    }


    if (
      selectedSubmission.status !==
      'PENDING_REVIEW'
    ) {
      setReviewError(
        'Only submissions pending review can be manually graded.'
      );

      return;
    }


    const numericScore =
      Number(score);


    if (
      !Number.isFinite(
        numericScore
      ) ||
      numericScore < 0 ||
      numericScore >
        Number(
          assessment.totalPoints
        )
    ) {
      setReviewError(
        `Score must be between 0 and ${assessment.totalPoints}.`
      );

      return;
    }


    try {
      setSavingGrade(true);
      setReviewError('');


      const result =
        await gradeSubmission(
          selectedSubmission
            .submissionId,
          numericScore,
          feedback.trim() ||
            null
        );


      const gradedSubmission =
        normalizeSubmission({
          ...selectedSubmission,

          ...(
            result?.submission ||
            {}
          ),

          /*
          * Keep already loaded detail.
          */
          answers:
            selectedSubmission
              .answers,

          files:
            selectedSubmission
              .files
        });


      setSubmissions(
        (previous) =>
          previous.map(
            (submission) =>
              String(
                submission
                  .submissionId
              ) ===
              String(
                gradedSubmission
                  .submissionId
              )
                ? {
                    ...submission,
                    ...gradedSubmission
                  }
                : submission
          )
      );


      closeSubmission();
    } catch (error) {
      console.error(
        'Unable to grade submission:',
        error
      );


      setReviewError(
        error.message ||
        'Unable to save grade.'
      );
    } finally {
      setSavingGrade(false);
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


            <Link
              to={
                `/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}`
              }
              className="
                hover:text-blue-600
              "
            >
              {
                assessment.title
              }
            </Link>


            <span>/</span>


            <span>
              Submissions
            </span>
          </div>


          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Assessment Submissions
          </h1>
        </div>


        <Link
          to={
            `/educator/courses/${course.courseId}/assessments/${assessment.assessmentId}`
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
          View Assessment
        </Link>
      </header>


      {/* MAIN */}
      <main
        className="
          flex-1
          min-h-0
          overflow-y-auto
          p-6
        "
      >
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
            Submission data is available
            for viewing only.
          </div>
        )}


        {/* ASSESSMENT INFO */}
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
          <div
            className="
              flex
              items-start
              justify-between
              gap-5
              flex-wrap
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
                {
                  assessment.title
                }
              </h2>


              <div
                className="
                  flex
                  items-center
                  gap-2
                  mt-2
                  flex-wrap
                "
              >
                <span
                  className="
                    text-[10px]
                    font-bold
                    text-blue-700
                    bg-blue-50
                    rounded-full
                    px-2.5
                    py-1
                  "
                >
                  {
                    assessment.type
                  }
                </span>


                <span
                  className="
                    text-xs
                    text-gray-400
                  "
                >
                  {
                    assessment.totalPoints
                  }{' '}
                  points
                </span>
              </div>
            </div>


            <div
              className="
                grid
                grid-cols-2
                md:grid-cols-4
                gap-3
              "
            >
              <MiniStat
                label="Total"
                value={
                  assessmentSubmissions.length
                }
              />


              <MiniStat
                label="Submitted"
                value={
                  submittedCount
                }
              />


              <MiniStat
                label="Pending Review"
                value={
                  pendingReviewCount
                }
              />


              <MiniStat
                label="Graded"
                value={
                  gradedCount
                }
              />
            </div>
          </div>
        </section>


        {/* FILTER */}
        <div
          className="
            flex
            items-center
            gap-2
            flex-wrap
          "
        >
          <FilterButton
            active={
              filter ===
              'ALL'
            }
            label="All"
            count={
              assessmentSubmissions.length
            }
            onClick={() =>
              setFilter(
                'ALL'
              )
            }
          />
          <FilterButton
            active={
              filter ===
              'SUBMITTED'
            }
            label="Submitted"
            count={
              submittedCount
            }
            onClick={() =>
              setFilter(
                'SUBMITTED'
              )
            }
          />

          <FilterButton
            active={
              filter ===
              'PENDING_REVIEW'
            }
            label="Pending Review"
            count={
              pendingReviewCount
            }
            onClick={() =>
              setFilter(
                'PENDING_REVIEW'
              )
            }
          />


          <FilterButton
            active={
              filter ===
              'GRADED'
            }
            label="Graded"
            count={
              gradedCount
            }
            onClick={() =>
              setFilter(
                'GRADED'
              )
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
          {filteredRows.length ===
          0 ? (
            <div
              className="
                py-14
                px-6
                text-center
              "
            >
              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                "
              >
                No submissions found
              </h3>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                There are no submissions
                matching the selected
                filter.
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
                  min-w-[950px]
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
                      Submitted
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Timeliness
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
                      Score
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                        text-right
                      "
                    >
                      Action
                    </th>
                  </tr>
                </thead>


                <tbody
                  className="
                    divide-y
                    divide-gray-100
                  "
                >
                  {filteredRows.map(
                    ({
                      submission,
                      learner
                    }) => (
                      <tr
                        key={
                          submission
                            .submissionId
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
                            text-xs
                            text-gray-500
                          "
                        >
                          {
                            formatDateTime(
                              submission
                                .submittedAt
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
                            className={`
                              inline-flex
                              rounded-full
                              px-2.5
                              py-1
                              text-[10px]
                              font-bold

                              ${
                                submission.isLate
                                  ? `
                                    bg-red-100
                                    text-red-700
                                  `
                                  : `
                                    bg-green-100
                                    text-green-700
                                  `
                              }
                            `}
                          >
                            {
                              submission.isLate
                                ? 'LATE'
                                : 'ON TIME'
                            }
                          </span>
                        </td>


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
                                submission.status
                              )}
                            `}
                          >
                            {
                              submission.status
                            }
                          </span>
                        </td>


                        <td
                          className="
                            px-5
                            py-4
                            font-semibold
                            text-gray-700
                          "
                        >
                          {
                            submission.score ===
                              null ||
                            submission.score ===
                              undefined
                              ? '—'
                              : `${submission.score} / ${assessment.totalPoints}`
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
                              justify-end
                            "
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openSubmission(
                                  submission
                                )
                              }
                              disabled={
                                String(
                                  openingSubmissionId
                                ) ===
                                String(
                                  submission.submissionId
                                )
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
                              "
                            >
                              {
                                String(
                                  openingSubmissionId
                                ) ===
                                String(
                                  submission.submissionId
                                )
                                  ? 'Loading...'
                                  : (
                                      submission.status ===
                                      'PENDING_REVIEW'
                                        ? 'Review'
                                        : 'View'
                                    )
                              }
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


      {/* SUBMISSION REVIEW MODAL */}
      {selectedSubmission && (
        <SubmissionReviewModal
          submission={
            selectedSubmission
          }
          learner={
            learners.find(
              (user) =>
                String(
                  user.userId ??
                  user.id
                ) ===
                String(
                  selectedSubmission
                    .learnerId
                )
            ) || {
              displayName:
                'Unknown Learner',

              email:
                'N/A'
            }
          }
          assessment={
            assessment
          }
          questions={
            assessmentQuestions
          }
          score={
            score
          }
          setScore={
            setScore
          }
          feedback={
            feedback
          }
          setFeedback={
            setFeedback
          }
          error={
            reviewError
          }
          savingGrade={
            savingGrade
          }
          isArchived={
            isArchived
          }
          onClose={
            closeSubmission
          }
          onSave={
            handleSaveGrade
          }
        />
      )}
    </>
  );
}


function SubmissionReviewModal({
  submission,
  learner,
  assessment,
  questions,
  score,
  setScore,
  feedback,
  setFeedback,
  error,
  savingGrade,
  isArchived,
  onClose,
  onSave
}) {
  const canGrade =
    !isArchived &&
    !savingGrade &&
    submission.status ===
    'PENDING_REVIEW';


  const answers =
    Array.isArray(
      submission.answers
    )
      ? submission.answers
      : [];

  function findQuestionForAnswer(
    answer,
    index
  ) {
    const matchedQuestion =
      questions.find(
        (question) =>
          String(
            question.questionId
          ) ===
          String(
            answer.questionId
          )
      );


    return (
      matchedQuestion ||
      questions[index] ||
      null
    );
  }

  const files =
    Array.isArray(
      submission.files
    )
      ? submission.files
      : [];


  return (
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
          max-w-3xl
          max-h-[90vh]
          overflow-y-auto
          rounded-xl
          shadow-xl
        "
      >
        {/* HEADER */}
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
                text-lg
                font-bold
                text-gray-800
              "
            >
              Submission Review
            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-1
              "
            >
              {
                learner.displayName ||
                learner.fullname ||
                'Unknown Learner'
              }
            </p>
          </div>


          <button
            type="button"
            onClick={
              onClose
            }
            className="
              text-gray-400
              hover:text-gray-700
            "
          >
            ✕
          </button>
        </div>


        <div
          className="
            p-6
            space-y-6
          "
        >
          {/* META */}
          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-2
              lg:grid-cols-4
              gap-3
            "
          >
            <InfoBox
              label="Submitted"
              value={
                formatDateTime(
                  submission
                    .submittedAt
                )
              }
            />


            <InfoBox
              label="Timeliness"
              value={
                submission.isLate
                  ? 'LATE'
                  : 'ON TIME'
              }
            />


            <InfoBox
              label="Status"
              value={
                submission.status
              }
            />


            <InfoBox
              label="Current Score"
              value={
                submission.score ===
                  null ||
                submission.score ===
                  undefined
                  ? 'Not graded'
                  : `${submission.score} / ${assessment.totalPoints}`
              }
            />
          </div>


          {/* ANSWERS */}
          <section>
            <h3
              className="
                text-sm
                font-bold
                text-gray-800
              "
            >
              Answers
            </h3>


            {answers.length ===
            0 ? (
              <p
                className="
                  text-sm
                  text-gray-500
                  mt-3
                "
              >
                No text answers are
                available for this
                submission.
              </p>
            ) : (
              <div
                className="
                  mt-3
                  space-y-3
                "
              >
                {answers.map(
                  (
                    answer,
                    index
                  ) => {
                    const question =
                      findQuestionForAnswer(
                        answer,
                        index
                      );


                    return (
                      <div
                        key={
                          answer.answerId ??
                          index
                        }
                        className="
                          bg-gray-50
                          rounded-xl
                          p-4
                        "
                      >
                        <p
                          className="
                            text-xs
                            font-semibold
                            text-gray-400
                          "
                        >
                          Question {
                            index + 1
                          }
                        </p>


                        {question?.content && (
                          <p
                            className="
                              text-sm
                              font-semibold
                              text-gray-800
                              leading-6
                              mt-2
                              whitespace-pre-wrap
                            "
                          >
                            {
                              question.content
                            }
                          </p>
                        )}


                        <p
                          className="
                            text-[10px]
                            font-bold
                            uppercase
                            tracking-wider
                            text-gray-400
                            mt-4
                          "
                        >
                          Learner Answer
                        </p>


                        <p
                          className="
                            text-sm
                            text-gray-700
                            leading-6
                            mt-1
                            whitespace-pre-wrap
                          "
                        >
                          {
                            answer.response ??
                            answer.answerText ??
                            answer.content ??
                            answer
                              .selectedOptionContent ??
                            'No answer content.'
                          }
                        </p>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>


          {/* FILES */}
          {files.length >
            0 && (
            <section>
              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                "
              >
                Submitted Files
              </h3>


              <div
                className="
                  mt-3
                  space-y-2
                "
              >
                {files.map(
                  (
                    file,
                    index
                  ) => (
                    <div
                      key={
                        `${file.name}-${index}`
                      }
                      className="
                        bg-gray-50
                        rounded-lg
                        px-3
                        py-3
                        flex
                        items-center
                        justify-between
                        gap-4
                      "
                    >
                      {file.url ? (
                        <a
                          href={
                            file.url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="
                            text-sm
                            text-blue-600
                            font-semibold
                            hover:underline
                            truncate
                          "
                        >
                          {
                            file.name
                          }
                        </a>
                      ) : (
                        <span
                          className="
                            text-sm
                            text-gray-600
                            truncate
                          "
                        >
                          {
                            file.name
                          }
                        </span>
                      )}


                      <span
                        className="
                          text-[10px]
                          font-bold
                          text-gray-400
                        "
                      >
                        FILE
                      </span>
                    </div>
                  )
                )}
              </div>
            </section>
          )}


          {/* GRADING */}
          <section
            className="
              border-t
              border-gray-100
              pt-5
            "
          >
            <h3
              className="
                text-sm
                font-bold
                text-gray-800
              "
            >
              Grading
            </h3>


            {!canGrade && (
              <div
                className="
                  mt-3
                  bg-gray-50
                  rounded-lg
                  px-3
                  py-3
                  text-xs
                  text-gray-500
                "
              >
                {isArchived
                  ? 'This course is archived. Grading is read-only.'
                  : 'This submission is not pending manual review.'}
              </div>
            )}


            <div
              className="
                mt-4
                grid
                grid-cols-1
                md:grid-cols-3
                gap-4
              "
            >
              <div>
                <label
                  className="
                    block
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Score
                </label>


                <div
                  className="
                    mt-2
                    flex
                    items-center
                    gap-2
                  "
                >
                  <input
                    type="number"
                    min="0"
                    max={
                      assessment.totalPoints
                    }
                    value={
                      score
                    }
                    disabled={
                      !canGrade
                    }
                    onChange={
                      (event) =>
                        setScore(
                          event.target.value
                        )
                    }
                    className="
                      w-full
                      rounded-lg
                      border
                      border-gray-200
                      px-3
                      py-2.5
                      text-sm
                      outline-none
                      disabled:bg-gray-100
                    "
                  />


                  <span
                    className="
                      text-xs
                      text-gray-400
                      whitespace-nowrap
                    "
                  >
                    / {
                      assessment.totalPoints
                    }
                  </span>
                </div>
              </div>


              <div
                className="
                  md:col-span-2
                "
              >
                <label
                  className="
                    block
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Feedback
                </label>


                <textarea
                  rows={4}
                  value={
                    feedback
                  }
                  disabled={
                    !canGrade
                  }
                  onChange={
                    (event) =>
                      setFeedback(
                        event.target.value
                      )
                  }
                  placeholder="Provide feedback to the learner..."
                  className="
                    mt-2
                    w-full
                    rounded-lg
                    border
                    border-gray-200
                    px-3
                    py-2.5
                    text-sm
                    outline-none
                    resize-y
                    disabled:bg-gray-100
                  "
                />
              </div>
            </div>


            {error && (
              <p
                className="
                  text-xs
                  text-red-500
                  mt-3
                "
              >
                {error}
              </p>
            )}
          </section>
        </div>


        {/* ACTIONS */}
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
              onClose
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
            Close
          </button>


          {(
            !isArchived &&
            submission.status ===
              'PENDING_REVIEW'
          ) && (
            <button
              type="button"
              onClick={
                onSave
              }
              disabled={
                savingGrade
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
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
            >
              {
                savingGrade
                  ? 'Saving...'
                  : 'Save Grade'
              }
            </button>
          )}
        </div>
      </div>
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
          "
        >
          {
            getInitials(
              displayName
            )
          }
        </div>
      )}


      <div>
        <p
          className="
            text-sm
            font-semibold
            text-gray-800
          "
        >
          {displayName}
        </p>


        <p
          className="
            text-xs
            text-gray-400
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


function MiniStat({
  label,
  value
}) {
  return (
    <div
      className="
        bg-gray-50
        rounded-lg
        px-3
        py-2
        min-w-[90px]
      "
    >
      <p
        className="
          text-[10px]
          uppercase
          text-gray-400
          font-semibold
        "
      >
        {label}
      </p>


      <p
        className="
          text-lg
          font-bold
          text-gray-800
          mt-1
        "
      >
        {value}
      </p>
    </div>
  );
}


function FilterButton({
  active,
  label,
  count,
  onClick
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`
        text-xs
        font-semibold
        px-3
        py-2
        rounded-lg
        border

        ${
          active
            ? `
              border-blue-600
              bg-blue-600
              text-white
            `
            : `
              border-gray-200
              bg-white
              text-gray-600
              hover:bg-gray-50
            `
        }
      `}
    >
      {label} ({count})
    </button>
  );
}


function InfoBox({
  label,
  value
}) {
  return (
    <div
      className="
        bg-gray-50
        rounded-xl
        p-3
      "
    >
      <p
        className="
          text-[10px]
          uppercase
          font-semibold
          text-gray-400
        "
      >
        {label}
      </p>


      <p
        className="
          text-xs
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


function NotFoundState({
  title,
  backTo
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
          text-center
          max-w-md
          w-full
        "
      >
        <h1
          className="
            text-lg
            font-bold
            text-gray-800
          "
        >
          {title}
        </h1>


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
          Go Back
        </Link>
      </div>
    </div>
  );
}