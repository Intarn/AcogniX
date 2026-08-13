// frontend/src/pages/learner/CourseDetail.jsx
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
  getCourseAnnouncements,
  getCourseMaterials
} from '../../features/classroom/courseContentApi';

import {
  getLearnerAssessments
} from '../../services/assessmentService';

function getFileTypeLabel(
  fileType
) {
  if (!fileType) {
    return 'File';
  }

  if (
    fileType ===
    'application/pdf'
  ) {
    return 'PDF';
  }

  if (
    fileType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'DOCX';
  }

  return fileType;
}


function formatDateTime(
  value
) {
  if (!value) {
    return '';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
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

function formatFileSize(
  bytes
) {
  const value =
    Number(bytes);


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return '';
  }


  if (
    value < 1024
  ) {
    return `${value} B`;
  }


  if (
    value <
    1024 * 1024
  ) {
    return `${Math.ceil(
      value / 1024
    )} KB`;
  }


  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

export default function CourseDetail() {
  const {
    courseId
  } = useParams();

  const [
    course,
    setCourse
  ] = useState(null);


  const [
    announcements,
    setAnnouncements
  ] = useState([]);


  const [
    materials,
    setMaterials
  ] = useState([]);

  const [
    assessments,
    setAssessments
  ] = useState([]);

  const [
    activeTab,
    setActiveTab
  ] = useState(
    'Announcements'
  );


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
      setAnnouncements([]);
      setMaterials([]);
      setAssessments([]);

      setLoadError(
        'Course ID is missing.'
      );

      setLoading(false);

      return;
    }


    let cancelled = false;


    async function loadCourseDetail() {
      try {
        setLoading(true);

        setLoadError('');


        const [
          courseResult,
          announcementResult,
          materialResult,
          assessmentResult
        ] =
          await Promise.all([
            getCourses(),

            getCourseAnnouncements(
              courseId
            ),

            getCourseMaterials(
              courseId
            ),

            getLearnerAssessments()
          ]);


        /*
        * GET /api/enrollment
        * returns:
        *
        * {
        *   count: ...,
        *   courses: [...]
        * }
        */
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


        /*
        * GET
        * /api/courses/:courseId/announcements
        *
        * returns:
        *
        * {
        *   announcements: [...]
        * }
        */
        const loadedAnnouncements =
          Array.isArray(
            announcementResult
              ?.announcements
          )
            ? announcementResult
                .announcements
            : [];


        /*
        * GET
        * /api/courses/:courseId/materials
        *
        * returns:
        *
        * {
        *   materials: [...]
        * }
        */
        const loadedMaterials =
          Array.isArray(
            materialResult
              ?.materials
          )
            ? materialResult
                .materials
            : [];
          
        
        const allAssessments =
          Array.isArray(
            assessmentResult
          )
            ? assessmentResult
            : (
                Array.isArray(
                  assessmentResult
                    ?.assessments
                )
                  ? assessmentResult
                      .assessments
                  : []
              );


        const loadedAssessments =
          allAssessments.filter(
            (assessment) =>
              String(
                assessment.courseId
              ) ===
              String(
                courseId
              )
          );


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );


        setAnnouncements(
          loadedAnnouncements
        );


        setMaterials(
          loadedMaterials
        );

        setAssessments(
          loadedAssessments
        );

    } catch (error) {
        if (cancelled) {
          return;
        }


        console.error(
          'Unable to load learner course:',
          error
        );


        setCourse(null);

        setAnnouncements([]);

        setMaterials([]);
        setAssessments([]);


        setLoadError(
          error.message ||
          'Unable to load course content.'
        );

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadCourseDetail();


    return () => {
      cancelled = true;
    };

  }, [courseId]);

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
        <p
          className="
            text-sm
            text-gray-500
          "
        >
          Loading course content...
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
        <p
          className="
            text-sm
            text-red-500
          "
        >
          {loadError}
        </p>


        <Link
          to="/learner/my-courses"
          className="
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
          flex-1
          flex
          flex-col
          items-center
          justify-center
          p-8
          bg-gray-50
        "
      >
        <p
          className="
            text-sm
            text-gray-500
          "
        >
          Course not found.
        </p>


        <Link
          to="/learner/my-courses"
          className="
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
          {/* Breadcrumb */}
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
              className="
                hover:text-blue-600
                transition
              "
            >
              My Courses
            </Link>

            <span>
              /
            </span>

            <span
              className="
                truncate
                text-gray-500
              "
            >
              {
                course.subjectName ||
                'Course'
              }
            </span>
          </div>


          {/* Course title + status */}
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
                course.subjectName ||
                'Untitled Course'
              }
            </h1>


            <span
              className={`
                inline-flex
                items-center
                rounded-full
                px-2.5
                py-1
                text-[10px]
                font-bold

                ${
                  isArchived
                    ? `
                      bg-gray-100
                      text-gray-600
                    `
                    : `
                      bg-green-100
                      text-green-700
                    `
                }
              `}
            >
              {
                course.status ||
                'ACTIVE'
              }
            </span>
          </div>
        </div>
      </header>


      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}
      <main
        className="
          flex-1
          p-6
          space-y-6
          bg-gray-50
          overflow-y-auto
        "
      >

        {/* ===================================================
            ARCHIVED NOTICE
        =================================================== */}
        {isArchived && (
          <div
            className="
              bg-amber-50
              border
              border-amber-200
              rounded-xl
              px-4
              py-3
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
                  w-5
                  h-5
                  rounded-full
                  bg-amber-100
                  text-amber-700
                  flex
                  items-center
                  justify-center
                  flex-shrink-0
                  text-xs
                  font-bold
                "
              >
                !
              </div>


              <div>
                <p
                  className="
                    text-sm
                    font-semibold
                    text-amber-800
                  "
                >
                  This course is archived.
                </p>

                <p
                  className="
                    text-xs
                    text-amber-700
                    mt-1
                  "
                >
                  Historical course content
                  remains available for viewing.
                </p>
              </div>
            </div>
          </div>
        )}


        {/* ===================================================
            COURSE OVERVIEW
        =================================================== */}
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
          {/* Section header */}
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
              Course Overview
            </h2>

            <p
              className="
                text-xs
                text-gray-400
                mt-1
              "
            >
              Basic information about
              your classroom.
            </p>
          </div>


          {/* Course information */}
          <div
            className="
              p-6
            "
          >
            <div
              className="
                grid
                grid-cols-1
                md:grid-cols-3
                gap-5
              "
            >

              {/* =============================================
                  COURSE CODE
              ============================================= */}
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
                    tracking-wide
                    font-semibold
                    text-gray-400
                  "
                >
                  Course Code
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
                    course.courseCode ||
                    'N/A'
                  }
                </p>
              </div>


              {/* =============================================
                  EDUCATOR
              ============================================= */}
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
                    tracking-wide
                    font-semibold
                    text-gray-400
                  "
                >
                  Educator
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
                    course.educator
                      ?.displayName ||
                    course.educator
                      ?.email ||
                    'Unknown Educator'
                  }
                </p>
              </div>


              {/* =============================================
                  STATUS
              ============================================= */}
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
                    tracking-wide
                    font-semibold
                    text-gray-400
                  "
                >
                  Status
                </p>

                <div
                  className="
                    mt-2
                  "
                >
                  <span
                    className={`
                      inline-flex
                      rounded-full
                      px-3
                      py-1
                      text-xs
                      font-bold

                      ${
                        isArchived
                          ? `
                            bg-gray-200
                            text-gray-600
                          `
                          : `
                            bg-green-100
                            text-green-700
                          `
                      }
                    `}
                  >
                    {
                      course.status ||
                      'ACTIVE'
                    }
                  </span>
                </div>
              </div>
            </div>


            {/* =============================================
                DESCRIPTION
            ============================================= */}
            <div
              className="
                mt-6
                pt-5
                border-t
                border-gray-100
              "
            >
              <p
                className="
                  text-[11px]
                  uppercase
                  tracking-wide
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
                  course.description ||
                  'No description provided.'
                }
              </p>
            </div>
          </div>
        </section>


        {/* ===================================================
            CLASSROOM CONTENT
        =================================================== */}
        <section>
          {/* Section title */}
          <div
            className="
              mb-4
            "
          >
            <h2
              className="
                text-base
                font-bold
                text-gray-800
              "
            >
              Classroom Content
            </h2>

            <p
              className="
                text-xs
                text-gray-400
                mt-1
              "
            >
              Access learning materials,
              announcements, and assessments
              for this course.
            </p>
          </div>


          {/* =================================================
              CARDS
          ================================================= */}
          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              xl:grid-cols-3
              gap-4
            "
          >

            {/* =================================================
                COURSE MATERIALS CARD
            ================================================= */}
            <Link
              to={
                `/learner/courses/${course.courseId}/materials`
              }
              className="
                group
                bg-white
                rounded-xl
                border
                border-gray-100
                shadow-sm
                p-5
                hover:border-blue-200
                hover:shadow-md
                transition
              "
            >
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
                    w-11
                    h-11
                    rounded-xl
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
                      d="
                        M7 4h10
                        a2 2 0 012 2v12
                        a2 2 0 01-2 2H7
                        a2 2 0 01-2-2V6
                        a2 2 0 012-2
                        M9 8h6
                        M9 12h6
                        M9 16h4
                      "
                    />
                  </svg>
                </div>


                <span
                  className="
                    text-gray-300
                    text-lg
                    group-hover:text-blue-500
                    group-hover:translate-x-1
                    transition
                  "
                >
                  →
                </span>
              </div>


              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                  mt-4
                  group-hover:text-blue-600
                  transition
                "
              >
                Course Materials
              </h3>


              <p
                className="
                  text-xs
                  text-gray-500
                  mt-1
                  leading-5
                "
              >
                Browse and view learning
                materials shared by your
                educator.
              </p>


              <div
                className="
                  mt-4
                  pt-4
                  border-t
                  border-gray-100
                "
              >
                <span
                  className="
                    text-xs
                    font-semibold
                    text-blue-600
                  "
                >
                  View Materials
                </span>
              </div>
            </Link>


            {/* =================================================
                ANNOUNCEMENTS CARD
            ================================================= */}
            <Link
              to={
                `/learner/courses/${course.courseId}/announcements`
              }
              className="
                group
                bg-white
                rounded-xl
                border
                border-gray-100
                shadow-sm
                p-5
                hover:border-amber-200
                hover:shadow-md
                transition
              "
            >
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
                    w-11
                    h-11
                    rounded-xl
                    bg-amber-50
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
                      d="
                        M18 8
                        a6 6 0 01-6 6H8
                        l-4 3v-6
                        a6 6 0 1114-3
                      "
                    />
                  </svg>
                </div>


                <span
                  className="
                    text-gray-300
                    text-lg
                    group-hover:text-amber-500
                    group-hover:translate-x-1
                    transition
                  "
                >
                  →
                </span>
              </div>


              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                  mt-4
                  group-hover:text-amber-600
                  transition
                "
              >
                Announcements
              </h3>


              <p
                className="
                  text-xs
                  text-gray-500
                  mt-1
                  leading-5
                "
              >
                Read classroom updates and
                messages posted by your
                educator.
              </p>


              <div
                className="
                  mt-4
                  pt-4
                  border-t
                  border-gray-100
                "
              >
                <span
                  className="
                    text-xs
                    font-semibold
                    text-amber-600
                  "
                >
                  View Announcements
                </span>
              </div>
            </Link>


            {/* =================================================
                ASSESSMENTS CARD
            ================================================= */}
            <Link
              to={
                `/learner/courses/${course.courseId}/assessments`
              }
              className="
                group
                bg-white
                rounded-xl
                border
                border-gray-100
                shadow-sm
                p-5
                hover:border-emerald-200
                hover:shadow-md
                transition
              "
            >
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
                    w-11
                    h-11
                    rounded-xl
                    bg-emerald-50
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
                      text-emerald-600
                    "
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="
                        M9 5H7
                        a2 2 0 00-2 2v12
                        a2 2 0 002 2h10
                        a2 2 0 002-2V7
                        a2 2 0 00-2-2h-2
                        M9 5
                        a3 3 0 006 0
                        M9 12h6
                        M9 16h6
                      "
                    />
                  </svg>
                </div>


                <span
                  className="
                    text-gray-300
                    text-lg
                    group-hover:text-emerald-500
                    group-hover:translate-x-1
                    transition
                  "
                >
                  →
                </span>
              </div>


              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                  mt-4
                  group-hover:text-emerald-600
                  transition
                "
              >
                Assessments
              </h3>


              <p
                className="
                  text-xs
                  text-gray-500
                  mt-1
                  leading-5
                "
              >
                View and complete official
                quizzes and assignments for
                this course.
              </p>


              <div
                className="
                  mt-4
                  pt-4
                  border-t
                  border-gray-100
                "
              >
                <span
                  className="
                    text-xs
                    font-semibold
                    text-emerald-600
                  "
                >
                  View Assessments
                </span>
              </div>
            </Link>

          </div>
        </section>
      </main>
    </>
  );
}