import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link,
  useSearchParams
} from 'react-router';

import {
  getCourses
} from '../../features/classroom/courseApi';

import {
  getCourseGradebook
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


function calculatePercentage(
  score,
  totalPoints
) {
  const numericScore =
    Number(score);

  const numericTotal =
    Number(totalPoints);

  if (
    !Number.isFinite(
      numericScore
    ) ||
    !Number.isFinite(
      numericTotal
    ) ||
    numericTotal <= 0
  ) {
    return null;
  }

  return (
    numericScore /
    numericTotal
  ) * 100;
}


export default function GradebookPage() {
  const [
    searchParams,
    setSearchParams
  ] = useSearchParams();

  const initialCourseId =
    searchParams.get(
      'courseId'
    ) || '';


  const [
    selectedCourseId,
    setSelectedCourseId
  ] = useState(
    initialCourseId
  );

  const [
    courses,
    setCourses
  ] = useState([]);


  const [
    assessments,
    setAssessments
  ] = useState([]);


  const [
    enrolledLearners,
    setEnrolledLearners
  ] = useState([]);


  const [
    submissions,
    setSubmissions
  ] = useState([]);


  const [
    loadingCourses,
    setLoadingCourses
  ] = useState(true);


  const [
    loadingGradebook,
    setLoadingGradebook
  ] = useState(false);


  const [
    loadError,
    setLoadError
  ] = useState('');


    const [
      searchTerm,
      setSearchTerm
    ] = useState('');

  useEffect(() => {
    if (!selectedCourseId) {
      setAssessments([]);
      setEnrolledLearners([]);
      setSubmissions([]);
      setLoadError('');
      setLoadingGradebook(false);

      return;
    }


    let cancelled = false;


    async function loadGradebook() {
      try {
        setLoadingGradebook(true);
        setLoadError('');


        const result =
          await getCourseGradebook(
            selectedCourseId
          );


        /*
        * Future backend contract:
        *
        * {
        *   course,
        *   assessments: [],
        *   learners: [],
        *   submissions: []
        * }
        */


        const loadedAssessments =
          Array.isArray(
            result?.assessments
          )
            ? result.assessments
            : [];


        const loadedEnrolledLearners =
          Array.isArray(
            result?.learners
          )
            ? result.learners
            : [];


        const loadedSubmissions =
          Array.isArray(
            result?.submissions
          )
            ? result.submissions
            : [];


        if (cancelled) {
          return;
        }


        setAssessments(
          loadedAssessments
        );


        setEnrolledLearners(
          loadedEnrolledLearners
        );


        setSubmissions(
          loadedSubmissions
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load gradebook:',
            error
          );


          setAssessments([]);
          setEnrolledLearners([]);
          setSubmissions([]);


          setLoadError(
            error.message ||
            'Unable to load gradebook.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingGradebook(false);
        }
      }
    }


    loadGradebook();


    return () => {
      cancelled = true;
    };
  }, [
    selectedCourseId
  ]);

  const availableCourses =
    useMemo(() => {
      return [
        ...courses
      ].sort(
        (
          first,
          second
        ) => {
          if (
            first.status ===
            second.status
          ) {
            return String(
              first.subjectName ||
              ''
            ).localeCompare(
              String(
                second.subjectName ||
                ''
              )
            );
          }


          return first.status ===
            'ACTIVE'
            ? -1
            : 1;
        }
      );
    }, [courses]);


  const selectedCourse =
    useMemo(() => {
      if (!selectedCourseId) {
        return null;
      }

      return courses.find(
        (course) =>
          String(
            course.courseId
          ) ===
          String(
            selectedCourseId
          )
      );
    }, [
      courses,
      selectedCourseId
    ]);


  const courseAssessments =
    useMemo(() => {
      if (!selectedCourseId) {
        return [];
      }

      return assessments
        .filter(
          (assessment) =>
            String(
              assessment.courseId
            ) ===
            String(
              selectedCourseId
            )
        )
        .filter(
          (assessment) =>
            assessment.status !==
            'DRAFT'
        )
        .sort(
          (
            first,
            second
          ) => {
            const firstDate =
              new Date(
                first.startTime ||
                first.createdAt ||
                0
              ).getTime();

            const secondDate =
              new Date(
                second.startTime ||
                second.createdAt ||
                0
              ).getTime();

            return (
              firstDate -
              secondDate
            );
          }
        );
    }, [
      assessments,
      selectedCourseId
    ]);


  

  const gradebookRows =
    useMemo(() => {
      return enrolledLearners.map(
        (enrolledLearner) => {
          const assessmentScores =
            courseAssessments.map(
              (assessment) => {
                const submissionEntry =
                  submissions.find(
                    (item) => {
                      const currentSubmission =
                        item?.submission ||
                        item;


                      return (
                        String(
                          currentSubmission
                            .assessmentId
                        ) ===
                          String(
                            assessment
                              .assessmentId
                          ) &&
                        String(
                          currentSubmission
                            .learnerId
                        ) ===
                          String(
                            enrolledLearner.userId ??
                            enrolledLearner.id
                          ) &&
                        currentSubmission
                          .status ===
                          'GRADED'
                      );
                    }
                  );


                const submission =
                  submissionEntry
                    ?.submission ||
                  submissionEntry ||
                  null;


                return {
                  assessment,
                  submission
                };
              }
            );


          const percentages =
            assessmentScores
              .map(
                ({
                  assessment,
                  submission
                }) => {
                  if (
                    !submission
                  ) {
                    return null;
                  }


                  return calculatePercentage(
                    submission.score,
                    assessment.totalPoints
                  );
                }
              )
              .filter(
                (value) =>
                  value !== null
              );


          const average =
            percentages.length > 0
              ? percentages.reduce(
                  (
                    total,
                    value
                  ) =>
                    total + value,
                  0
                ) /
                percentages.length
              : null;


          return {
            enrolledLearner,
            assessmentScores,
            average
          };
        }
      );
    }, [
      enrolledLearners,
      courseAssessments,
      submissions
    ]);


  const filteredRows =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();


      if (!normalizedSearch) {
        return gradebookRows;
      }


      return gradebookRows.filter(
        ({ learner }) => {
          const name =
            (
              learner.displayName ||
              learner.fullname ||
              ''
            )
              .toLowerCase();


          const email =
            (
              learner.email ||
              ''
            )
              .toLowerCase();


          return (
            name.includes(
              normalizedSearch
            ) ||
            email.includes(
              normalizedSearch
            )
          );
        }
      );
    }, [
      gradebookRows,
      searchTerm
    ]);


  function handleCourseChange(
    event
  ) {
    const nextCourseId =
      event.target.value;


    setSelectedCourseId(
      nextCourseId
    );


    setSearchTerm('');


    if (nextCourseId) {
      setSearchParams({
        courseId:
          nextCourseId
      });
    } else {
      setSearchParams({});
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
          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Gradebook
          </h1>


          <p
            className="
              text-xs
              text-gray-400
              mt-0.5
            "
          >
            View official assessment
            scores across your courses.
          </p>
        </div>


        <button
          type="button"
          disabled
          className="
            text-xs
            font-semibold
            text-gray-400
            bg-gray-100
            px-4
            py-2
            rounded-lg
            cursor-not-allowed
          "
          title="Export will be connected after backend support is available."
        >
          Export
        </button>
      </header>


      <main
        className="
          p-6
          space-y-5
        "
      >
        {/* FILTERS */}
        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-xl
            shadow-sm
            p-4
          "
        >
          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              gap-4
            "
          >
            <div>
              <label
                className="
                  block
                  text-xs
                  font-semibold
                  text-gray-500
                  mb-2
                "
              >
                Course
              </label>


              <select
                value={
                  selectedCourseId
                }
                onChange={
                  handleCourseChange
                }
                disabled={
                  loadingCourses
                }
                className="
                  w-full
                  rounded-lg
                  border
                  border-gray-200
                  px-3
                  py-2.5
                  text-sm
                  text-gray-700
                  bg-white
                  outline-none
                "
              >
                <option value="">
                  {
                    loadingCourses
                      ? 'Loading courses...'
                      : 'Select a course'
                  }
                </option>


                {availableCourses.map(
                  (course) => (
                    <option
                      key={
                        course.courseId
                      }
                      value={
                        course.courseId
                      }
                    >
                      {
                        course.subjectName
                      }
                      {' — '}
                      {
                        course.courseCode
                      }
                      {
                        course.status ===
                        'ARCHIVED'
                          ? ' (Archived)'
                          : ''
                      }
                    </option>
                  )
                )}
              </select>
            </div>


            <div>
              <label
                className="
                  block
                  text-xs
                  font-semibold
                  text-gray-500
                  mb-2
                "
              >
                Search Learner
              </label>


              <input
                type="search"
                value={
                  searchTerm
                }
                onChange={
                  (event) =>
                    setSearchTerm(
                      event.target.value
                    )
                }
                placeholder="Search by name or email..."
                className="
                  w-full
                  rounded-lg
                  border
                  border-gray-200
                  px-3
                  py-2.5
                  text-sm
                  text-gray-700
                  outline-none
                  focus:ring-1
                  focus:ring-blue-300
                "
              />
            </div>
          </div>
        </section>
        {loadError && (
          <div
            className="
              bg-red-50
              border
              border-red-100
              text-red-600
              text-sm
              rounded-xl
              px-4
              py-3
            "
          >
            {
              loadError
            }
          </div>
        )}

        {loadingGradebook ? (
          <EmptyState
            title="Loading gradebook"
            message="Loading learners and assessment scores..."
          />
        ) : !selectedCourse ? (
          <EmptyState
            title="Select a course"
            message="Choose a course to view its assessment gradebook."
          />
        ) : (
          <>
            {/* COURSE SUMMARY */}
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
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
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
                      selectedCourse
                        .subjectName
                    }
                  </h2>


                  <p
                    className="
                      text-xs
                      text-gray-400
                      mt-1
                    "
                  >
                    {
                      selectedCourse
                        .courseCode
                    }
                  </p>
                </div>


                <div
                  className="
                    flex
                    gap-3
                  "
                >
                  <SummaryItem
                    label="Learners"
                    value={
                      enrolledLearners.length
                    }
                  />


                  <SummaryItem
                    label="Assessments"
                    value={
                      courseAssessments.length
                    }
                  />
                </div>
              </div>
            </section>


            {courseAssessments.length ===
            0 ? (
              <EmptyState
                title="No published assessments"
                message="This course does not have any non-draft assessments yet."
              />
            ) : filteredRows.length ===
              0 ? (
              <EmptyState
                title="No learners found"
                message="No enrolled learners match the current search."
              />
            ) : (
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
                    overflow-x-auto
                  "
                >
                  <table
                    className="
                      w-full
                      min-w-[900px]
                      text-sm
                      text-left
                    "
                  >
                    <thead
                      className="
                        bg-gray-50/50
                        text-xs
                        text-gray-500
                        uppercase
                      "
                    >
                      <tr>
                        <th
                          className="
                            px-5
                            py-3
                            sticky
                            left-0
                            bg-gray-50
                            z-10
                          "
                        >
                          Learner
                        </th>


                        {courseAssessments.map(
                          (assessment) => (
                            <th
                              key={
                                assessment
                                  .assessmentId
                              }
                              className="
                                px-5
                                py-3
                                min-w-[150px]
                              "
                            >
                              <div>
                                <p
                                  className="
                                    text-gray-600
                                    normal-case
                                    font-semibold
                                  "
                                >
                                  {
                                    assessment.title
                                  }
                                </p>


                                <p
                                  className="
                                    text-[10px]
                                    text-gray-400
                                    normal-case
                                    font-normal
                                    mt-1
                                  "
                                >
                                  {
                                    assessment.totalPoints
                                  }{' '}
                                  pts
                                </p>
                              </div>
                            </th>
                          )
                        )}


                        <th
                          className="
                            px-5
                            py-3
                          "
                        >
                          Average
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
                          learner,
                          assessmentScores,
                          average
                        }) => (
                          <tr
                            key={
                              learner.userId ??
                              learner.id
                            }
                            className="
                              hover:bg-gray-50/40
                            "
                          >
                            <td
                              className="
                                px-5
                                py-4
                                sticky
                                left-0
                                bg-white
                              "
                            >
                              <LearnerIdentity
                                learner={
                                  learner
                                }
                              />
                            </td>


                            {assessmentScores.map(
                              ({
                                assessment,
                                submission
                              }) => (
                                <td
                                  key={
                                    assessment
                                      .assessmentId
                                  }
                                  className="
                                    px-5
                                    py-4
                                  "
                                >
                                  {submission ? (
                                    <Link
                                      to={
                                        `/educator/courses/${selectedCourse.courseId}/assessments/${assessment.assessmentId}/submissions`
                                      }
                                      className="
                                        inline-flex
                                        items-center
                                        gap-1
                                        text-sm
                                        font-semibold
                                        text-blue-600
                                        hover:underline
                                      "
                                      title="Open assessment submissions"
                                    >
                                      {
                                        submission.score
                                      }
                                      {' / '}
                                      {
                                        assessment.totalPoints
                                      }
                                    </Link>
                                  ) : (
                                    <span
                                      className="
                                        text-gray-300
                                      "
                                    >
                                      —
                                    </span>
                                  )}
                                </td>
                              )
                            )}


                            <td
                              className="
                                px-5
                                py-4
                              "
                            >
                              {average ===
                              null ? (
                                <span
                                  className="
                                    text-gray-300
                                  "
                                >
                                  —
                                </span>
                              ) : (
                                <span
                                  className="
                                    text-sm
                                    font-bold
                                    text-gray-800
                                  "
                                >
                                  {
                                    average.toFixed(
                                      1
                                    )
                                  }
                                  %
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
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
        min-w-[180px]
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


function SummaryItem({
  label,
  value
}) {
  return (
    <div
      className="
        bg-gray-50
        rounded-lg
        px-4
        py-2
        min-w-[90px]
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


function EmptyState({
  title,
  message
}) {
  return (
    <div
      className="
        bg-white
        border
        border-gray-100
        rounded-xl
        shadow-sm
        py-14
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
            d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
          />
        </svg>
      </div>


      <h2
        className="
          text-base
          font-bold
          text-gray-800
          mt-4
        "
      >
        {title}
      </h2>


      <p
        className="
          text-sm
          text-gray-500
          mt-2
        "
      >
        {message}
      </p>
    </div>
  );
}