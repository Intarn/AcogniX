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
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  BarElement,
  Tooltip
} from 'chart.js';

import {
  Bar,
  Doughnut
} from 'react-chartjs-2';


ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

import {
  getCourses
} from '../../features/classroom/courseApi';

import {
  getCourseGradebook
} from '../../features/assessment/assessmentApi';

import {
  getClassAnalytics
} from '../../features/analytics/analyticsApi';


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


function getSeverityClasses(
  severity
) {
  switch (severity) {
    case 'HIGH':
      return `
        bg-red-100
        text-red-700
      `;

    case 'MEDIUM':
      return `
        bg-amber-100
        text-amber-700
      `;

    default:
      return `
        bg-gray-100
        text-gray-600
      `;
  }
}

function createEmptyAnalytics() {
  return {
    totalActiveStudyHours: 0,

    commonKnowledgeGap:
      'No data available',

    averageInteractionsPerLearner:
      0,

    studyHoursByWeek: [],

    knowledgeGaps: [],

    attentionLearners: []
  };
}

export default function StudentAnalyticsPage() {
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
    learners,
    setLearners
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
    analytics,
    setAnalytics
  ] = useState(
    createEmptyAnalytics
  );


  const [
    loadingCourses,
    setLoadingCourses
  ] = useState(true);


  const [
    loadingAnalytics,
    setLoadingAnalytics
  ] = useState(false);


  const [
    loadError,
    setLoadError
  ] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      try {
        setLoadingCourses(true);
        setLoadError('');

        const result =
          await getCourses();

        const loadedCourses =
          Array.isArray(
            result?.courses
          )
            ? result.courses
            : [];

        if (!cancelled) {
          setCourses(
            loadedCourses
          );
        }
      } catch (error) {
        if (!cancelled) {
          setCourses([]);

          setLoadError(
            error.message ||
            'Unable to load courses.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCourses(false);
        }
      }
    }

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setLearners([]);
      setAssessments([]);
      setSubmissions([]);

      setAnalytics(
        createEmptyAnalytics()
      );

      setLoadingAnalytics(false);

      return;
    }

    let cancelled = false;

    async function loadAnalytics() {
      try {
        setLoadingAnalytics(true);
        setLoadError('');

        const [
          gradebookResult,
          analyticsResult
        ] = await Promise.all([
          getCourseGradebook(
            selectedCourseId
          ),

          getClassAnalytics(
            selectedCourseId
          )
        ]);

        const loadedLearners =
          Array.isArray(
            gradebookResult?.learners
          )
            ? gradebookResult.learners
            : [];

        const loadedAssessments =
          Array.isArray(
            gradebookResult
              ?.assessments
          )
            ? gradebookResult.assessments
            : [];

        const loadedSubmissions =
          Array.isArray(
            gradebookResult
              ?.submissions
          )
            ? gradebookResult
                .submissions
                .map(
                  (entry) =>
                    entry?.submission ||
                    entry
                )
            : [];

        const loadedAnalytics =
          analyticsResult?.report ||
          analyticsResult?.analytics ||
          analyticsResult ||
          createEmptyAnalytics();

        if (cancelled) {
          return;
        }

        setLearners(
          loadedLearners
        );

        setAssessments(
          loadedAssessments
        );

        setSubmissions(
          loadedSubmissions
        );

        setAnalytics({
          ...createEmptyAnalytics(),
          ...loadedAnalytics
        });
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load class analytics:',
            error
          );

          setLearners([]);
          setAssessments([]);
          setSubmissions([]);

          setAnalytics(
            createEmptyAnalytics()
          );

          setLoadError(
            error.message ||
            'Unable to load class analytics.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAnalytics(false);
        }
      }
    }

    loadAnalytics();

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
    }, [
      courses
    ]);


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


  const enrolledLearners =
    useMemo(() => {
      return learners.map(
        (entry) =>
          entry?.learner ||
          entry?.user ||
          entry
      );
    }, [
      learners
    ]);


  const courseAssessments =
    useMemo(() => {
      if (!selectedCourseId) {
        return [];
      }


      return assessments.filter(
        (assessment) =>
          String(
            assessment.courseId
          ) ===
            String(
              selectedCourseId
            ) &&
          assessment.status !==
            'DRAFT'
      );
    }, [
      assessments,
      selectedCourseId
    ]);


  const gradedSubmissions =
    useMemo(() => {
      const assessmentIds =
        new Set(
          courseAssessments.map(
            (assessment) =>
              String(
                assessment.assessmentId
              )
          )
        );


      return submissions.filter(
        (submission) =>
          assessmentIds.has(
            String(
              submission.assessmentId
            )
          ) &&
          submission.status ===
            'GRADED'
      );
    }, [
      submissions,
      courseAssessments
    ]);


  const averageAssessmentScore =
    useMemo(() => {
      const percentages =
        gradedSubmissions
          .map(
            (submission) => {
              const assessment =
                courseAssessments.find(
                  (item) =>
                    String(
                      item.assessmentId
                    ) ===
                    String(
                      submission.assessmentId
                    )
                );


              if (!assessment) {
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


      if (
        percentages.length ===
        0
      ) {
        return null;
      }


      return (
        percentages.reduce(
          (
            total,
            value
          ) =>
            total + value,
          0
        ) /
        percentages.length
      );
    }, [
      gradedSubmissions,
      courseAssessments
    ]);


  const scoreDistribution =
    useMemo(() => {
      const distribution = {
        excellent: 0,
        good: 0,
        fair: 0,
        needsImprovement:
          0
      };


      gradedSubmissions.forEach(
        (submission) => {
          const assessment =
            courseAssessments.find(
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


          const percentage =
            calculatePercentage(
              submission.score,
              assessment.totalPoints
            );


          if (
            percentage ===
            null
          ) {
            return;
          }


          if (
            percentage >= 90
          ) {
            distribution.excellent +=
              1;
          } else if (
            percentage >= 75
          ) {
            distribution.good +=
              1;
          } else if (
            percentage >= 60
          ) {
            distribution.fair +=
              1;
          } else {
            distribution
              .needsImprovement +=
              1;
          }
        }
      );


      return distribution;
    }, [
      gradedSubmissions,
      courseAssessments
    ]);

  const attentionLearners =
    useMemo(() => {
      return analytics
        .attentionLearners
        .map(
          (item) => {
            const learner =
              item.learner ||
              enrolledLearners.find(
                (user) =>
                  String(
                    user.userId ??
                    user.id
                  ) ===
                  String(
                    item.learnerId
                  )
              );

            return {
              ...item,

              learner:
                learner || {
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
      analytics,
      enrolledLearners
    ]);


  const scoreDistributionData = {
    labels: [
      'Excellent (90–100%)',
      'Good (75–89%)',
      'Fair (60–74%)',
      'Needs Improvement (<60%)'
    ],

    datasets: [
      {
        data: [
          scoreDistribution
            .excellent,

          scoreDistribution
            .good,

          scoreDistribution
            .fair,

          scoreDistribution
            .needsImprovement
        ]
      }
    ]
  };


  const studyTimeData = {
    labels:
      analytics
        .studyHoursByWeek
        .map(
          (item) =>
            item.label
        ),

    datasets: [
      {
        label:
          'Active Study Hours',

        data:
          analytics
            .studyHoursByWeek
            .map(
              (item) =>
                item.hours
            )
      }
    ]
  };


  function handleCourseChange(
    event
  ) {
    const nextCourseId =
      event.target.value;


    setSelectedCourseId(
      nextCourseId
    );


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
            Class Analytics
          </h1>


          <p
            className="
              text-xs
              text-gray-400
              mt-0.5
            "
          >
            Review aggregated learning
            and assessment performance.
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
          title="Excel/PDF export will be connected after analytics backend support is available."
        >
          Export Report
        </button>
      </header>


      {/* MAIN */}
      <main
        className="
          p-6
          space-y-5
        "
      >
        {/* COURSE FILTER */}
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
              md:max-w-md
              rounded-lg
              border
              border-gray-200
              bg-white
              px-3
              py-2.5
              text-sm
              text-gray-700
              outline-none
              disabled:bg-gray-50
              disabled:cursor-not-allowed
              disabled:opacity-70
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


        {loadingAnalytics ? (
            <EmptyState
              title="Loading analytics"
              message="Loading class performance data..."
            />
          ) : !selectedCourse ? (
          <EmptyState
            title="Select a course"
            message="Choose a course to view its class-wide analytics."
          />
        ) : (
          <>
            {/* PRIVACY NOTICE */}
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
                  text-xs
                  text-blue-700
                "
              >
                Analytics show
                aggregated learning
                activity and official
                assessment results.
                Personal AI prompts,
                private chat logs and
                private study history
                are not exposed to
                Educators.
              </p>
            </div>


            {/* COURSE HEADER */}
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
                  items-start
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


                <Link
                  to={
                    `/educator/courses/${selectedCourse.courseId}`
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
                  View Course
                </Link>
              </div>
            </section>


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
                label="Total Students"
                value={
                  enrolledLearners.length
                }
                helper="Approved enrollments"
              />


              <MetricCard
                label="Avg Assessment Score"
                value={
                  averageAssessmentScore ===
                  null
                    ? '—'
                    : `${averageAssessmentScore.toFixed(
                        1
                      )}%`
                }
                helper="Official graded assessments"
              />


              <MetricCard
                label="Active Study Time"
                value={
                  `${analytics.totalActiveStudyHours} hrs`
                }
                helper="Aggregated class activity"
              />


              <MetricCard
                label="Common Knowledge Gap"
                value={
                  analytics.commonKnowledgeGap
                }
                helper="Class-wide topic"
                compact
              />
            </div>


            {/* CHARTS */}
            <div
              className="
                grid
                grid-cols-1
                xl:grid-cols-2
                gap-5
              "
            >
              {/* SCORE DISTRIBUTION */}
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
                  Assessment Score
                  Distribution
                </h2>


                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  Distribution of final
                  graded assessment
                  results.
                </p>


                <div
                  className="
                    h-[320px]
                    mt-5
                    flex
                    items-center
                    justify-center
                  "
                >
                  {gradedSubmissions.length >
                  0 ? (
                    <Doughnut
                      data={
                        scoreDistributionData
                      }
                      options={{
                        responsive:
                          true,

                        maintainAspectRatio:
                          false,

                        plugins: {
                          legend: {
                            position:
                              'bottom'
                          }
                        }
                      }}
                    />
                  ) : (
                    <ChartEmptyState
                      message="No graded assessment data available."
                    />
                  )}
                </div>
              </section>


              {/* STUDY TIME */}
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
                  Active Study Time
                </h2>


                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  Aggregated active
                  study hours for the
                  class.
                </p>


                <div
                  className="
                    h-[320px]
                    mt-5
                  "
                >
                  {analytics
                    .studyHoursByWeek
                    .length >
                  0 ? (
                    <Bar
                      data={
                        studyTimeData
                      }
                      options={{
                        responsive:
                          true,

                        maintainAspectRatio:
                          false,

                        plugins: {
                          legend: {
                            display:
                              false
                          }
                        },

                        scales: {
                          y: {
                            beginAtZero:
                              true
                          }
                        }
                      }}
                    />
                  ) : (
                    <ChartEmptyState
                      message="No active study-time data available."
                    />
                  )}
                </div>
              </section>
            </div>


            {/* LOWER */}
            <div
              className="
                grid
                grid-cols-1
                xl:grid-cols-2
                gap-5
              "
            >
              {/* ATTENTION */}
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
                    Students Requiring
                    Attention
                  </h2>


                  <p
                    className="
                      text-xs
                      text-gray-400
                      mt-1
                    "
                  >
                    Learners identified
                    from aggregate study
                    and official
                    assessment metrics.
                  </p>
                </div>


                {attentionLearners.length ===
                0 ? (
                  <div
                    className="
                      py-10
                      text-center
                      text-sm
                      text-gray-500
                    "
                  >
                    No learners currently
                    require attention.
                  </div>
                ) : (
                  <div
                    className="
                      divide-y
                      divide-gray-100
                    "
                  >
                    {attentionLearners.map(
                      (item) => (
                        <div
                          key={
                            item.learnerId
                          }
                          className="
                            p-4
                            flex
                            items-center
                            justify-between
                            gap-4
                          "
                        >
                          <LearnerIdentity
                            learner={
                              item.learner
                            }
                          />


                          <div
                            className="
                              text-right
                              flex-shrink-0
                            "
                          >
                            <p
                              className="
                                text-xs
                                font-semibold
                                text-red-600
                              "
                            >
                              {
                                item.metric
                              }
                            </p>


                            <p
                              className="
                                text-[10px]
                                text-gray-400
                                mt-1
                              "
                            >
                              {
                                item.reason
                              }
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>


              {/* KNOWLEDGE GAPS */}
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
                    Class-wide
                    Knowledge Gaps
                  </h2>


                  <p
                    className="
                      text-xs
                      text-gray-400
                      mt-1
                    "
                  >
                    Aggregated topics
                    where learners may
                    need additional
                    support.
                  </p>
                </div>


                {analytics
                  .knowledgeGaps
                  .length ===
                0 ? (
                  <div
                    className="
                      py-10
                      text-center
                      text-sm
                      text-gray-500
                    "
                  >
                    No knowledge-gap
                    report is available.
                  </div>
                ) : (
                  <div
                    className="
                      divide-y
                      divide-gray-100
                    "
                  >
                    {analytics
                      .knowledgeGaps
                      .map(
                        (
                          gap,
                          index
                        ) => (
                          <div
                            key={
                              `${gap.topic}-${index}`
                            }
                            className="
                              p-4
                              flex
                              items-center
                              justify-between
                              gap-4
                            "
                          >
                            <div>
                              <p
                                className="
                                  text-sm
                                  font-semibold
                                  text-gray-800
                                "
                              >
                                {
                                  gap.topic
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
                                  gap.affectedLearners
                                }{' '}
                                learners affected
                              </p>
                            </div>


                            <span
                              className={`
                                text-[10px]
                                font-bold
                                rounded-full
                                px-2.5
                                py-1

                                ${getSeverityClasses(
                                  gap.severity
                                )}
                              `}
                            >
                              {
                                gap.severity
                              }
                            </span>
                          </div>
                        )
                      )}
                  </div>
                )}
              </section>
            </div>


            {/* INTERACTION SUMMARY */}
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
                Learning Interaction
                Summary
              </h2>


              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Aggregated interaction
                metrics only.
              </p>


              <div
                className="
                  mt-5
                  grid
                  grid-cols-1
                  md:grid-cols-3
                  gap-4
                "
              >
                <SmallMetric
                  label="Average Interactions / Learner"
                  value={
                    analytics
                      .averageInteractionsPerLearner
                  }
                />


                <SmallMetric
                  label="Official Assessments"
                  value={
                    courseAssessments.length
                  }
                />


                <SmallMetric
                  label="Graded Submissions"
                  value={
                    gradedSubmissions.length
                  }
                />
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}


function MetricCard({
  label,
  value,
  helper,
  compact = false
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
        className={`
          font-bold
          text-gray-800
          mt-2

          ${
            compact
              ? 'text-base'
              : 'text-2xl'
          }
        `}
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


function SmallMetric({
  label,
  value
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
          text-xs
          text-gray-400
        "
      >
        {label}
      </p>


      <p
        className="
          text-xl
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
          {displayName}
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


function ChartEmptyState({
  message
}) {
  return (
    <div
      className="
        h-full
        w-full
        flex
        items-center
        justify-center
        text-center
      "
    >
      <p
        className="
          text-sm
          text-gray-400
        "
      >
        {message}
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
      <h2
        className="
          text-base
          font-bold
          text-gray-800
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