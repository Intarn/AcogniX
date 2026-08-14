import {
  useEffect,
  useState
} from 'react';

import {
  Link,
  useNavigate,
  useParams
} from 'react-router';

import {
  getCourses
} from '../../features/classroom/courseApi';


export default function ClassDetailPage() {
  const navigate =
    useNavigate();

  const {
    courseId:
      routeCourseId
  } = useParams();


  const [
    course,
    setCourse
  ] = useState(null);


  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    loadError,
    setLoadError
  ] = useState(''); 

  const [
    copied,
    setCopied
  ] = useState(false);


  const courseId =
    routeCourseId || null;

  
  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setLoading(false);

      return;
    }


    let cancelled = false;


    async function loadCourse() {
      try {
        setLoading(true);
        setLoadError('');


        const result =
          await getCourses();


        const courses =
          Array.isArray(
            result?.courses
          )
            ? result.courses
            : [];


        const foundCourse =
          courses.find(
            (item) =>
              String(
                item.courseId
              ) ===
              String(courseId)
          );


        if (!cancelled) {
          setCourse(
            foundCourse || null
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load course:',
            error
          );


          setLoadError(
            error.message ||
            'Unable to load course.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadCourse();


    return () => {
      cancelled = true;
    };
  }, [courseId]);


  async function handleCopyEnrollmentCode() {
    if (
      !course?.enrollmentCode ||
      course.status ===
        'ARCHIVED'
    ) {
      return;
    }


    try {
      await navigator.clipboard.writeText(
        course.enrollmentCode
      );

      setCopied(true);


      setTimeout(
        () => {
          setCopied(false);
        },
        1800
      );
    } catch {
      /*
       * Clipboard API may be blocked
       * in some browser contexts.
       *
       * Do not crash the page.
       */
      alert(
        `Enrollment Code: ${course.enrollmentCode}`
      );
    }
  }


  /*
   * LOADING STATE
   */
  if (loading) {
    return (
      <div
        className="
          flex-1
          flex
          items-center
          justify-center
          text-sm
          text-gray-500
        "
      >
        Loading course...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-red-100 shadow-sm p-8 text-center">
          <h1 className="text-lg font-bold text-gray-800">
            Unable to Load Course
          </h1>

          <p className="text-sm text-gray-500 mt-2">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                '/educator/courses'
              )
            }
            className="mt-5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
          >
            Back to My Courses
          </button>
        </div>
      </div>
    );
  }

  /*
   * COURSE NOT FOUND
   */
  if (!course) {
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
            max-w-md
            w-full
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
              w-14
              h-14
              mx-auto
              rounded-full
              bg-red-50
              flex
              items-center
              justify-center
              mb-4
            "
          >
            <svg
              className="
                w-7
                h-7
                text-red-500
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


          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Course Not Found
          </h1>


          <p
            className="
              text-sm
              text-gray-500
              mt-2
            "
          >
            The requested course does
            not exist or is no longer
            available.
          </p>


          <button
            type="button"
            onClick={() =>
              navigate(
                '/educator/courses'
              )
            }
            className="
              mt-5
              bg-blue-600
              hover:bg-blue-700
              text-white
              text-sm
              font-semibold
              px-5
              py-2.5
              rounded-lg
            "
          >
            Back to My Courses
          </button>
        </div>
      </div>
    );
  }


  const isArchived =
    course.status ===
    'ARCHIVED';


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

            <span
              className="
                truncate
              "
            >
              {
                course.subjectName
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
                course.subjectName
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
                course.status
              }
            </span>
          </div>
        </div>


        {!isArchived && (
          <Link
            to={
              `/educator/courses/${course.courseId}/edit`
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
              whitespace-nowrap
            "
          >
            Edit Course
          </Link>
        )}
      </header>


      {/* MAIN */}
      <main
        className="
          flex-1
          min-h-0
          overflow-y-auto
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
              <svg
                className="
                  w-5
                  h-5
                  text-amber-600
                  flex-shrink-0
                  mt-0.5
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


              <div>
                <p
                  className="
                    text-sm
                    font-semibold
                    text-amber-800
                  "
                >
                  This course is
                  archived.
                </p>

                <p
                  className="
                    text-xs
                    text-amber-700
                    mt-1
                  "
                >
                  New enrollment is
                  disabled. Historical
                  course data remains
                  available for viewing.
                </p>
              </div>
            </div>
          </div>
        )}


        {/* COURSE SUMMARY */}
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
              Course Overview
            </h2>

            <p
              className="
                text-xs
                text-gray-400
                mt-1
              "
            >
              Basic information and
              classroom access details.
            </p>
          </div>


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

              {/* COURSE CODE */}
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
                    course.courseCode
                  }
                </p>
              </div>


              {/* ENROLLMENT CODE */}
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
                  Enrollment Code
                </p>


                <div
                  className="
                    mt-2
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <p
                    className={`
                      text-base
                      font-bold
                      tracking-wider

                      ${
                        isArchived
                          ? 'text-gray-400'
                          : 'text-gray-800'
                      }
                    `}
                  >
                    {
                      course.enrollmentCode ||
                      'N/A'
                    }
                  </p>


                  {course.enrollmentCode && !isArchived && (
                    <button
                      type="button"
                      onClick={
                        handleCopyEnrollmentCode
                      }
                      className={`
                        text-[11px]
                        font-semibold
                        px-2.5
                        py-1.5
                        rounded-lg

                        ${
                          copied
                            ? `
                              text-green-700
                              bg-green-100
                            `
                            : `
                              text-blue-600
                              bg-blue-50
                              hover:bg-blue-100
                            `
                        }
                      `}
                    >
                      {
                        copied
                          ? 'Copied'
                          : 'Copy'
                      }
                    </button>
                  )}
                </div>


                {isArchived && (
                  <p
                    className="
                      text-[10px]
                      text-gray-400
                      mt-2
                    "
                  >
                    Disabled for new
                    enrollment.
                  </p>
                )}
              </div>


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


                <div className="mt-2">
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
                      course.status
                    }
                  </span>
                </div>
              </div>
            </div>


            {/* DESCRIPTION */}
            <div
              className="
                mt-6
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


        {/* CLASSROOM MANAGEMENT */}
        <section>
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
              Classroom Management
            </h2>

            <p
              className="
                text-xs
                text-gray-400
                mt-1
              "
            >
              Manage classroom content,
              learners, assessments,
              and performance.
            </p>
          </div>


          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              xl:grid-cols-3
              gap-4
            "
          >

            {/* MATERIALS */}
            <Link
              to={
                `/educator/courses/${course.courseId}/materials`
              }
              className="
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
                  w-10
                  h-10
                  rounded-lg
                  bg-blue-50
                  flex
                  items-center
                  justify-center
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
                    d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zm2 4h6m-6 4h6m-6 4h4"
                  />
                </svg>
              </div>


              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                  mt-4
                "
              >
                Materials
              </h3>

              <p
                className="
                  text-xs
                  text-gray-500
                  mt-1
                "
              >
                Upload, edit, organize,
                and remove classroom
                learning materials.
              </p>
            </Link>


            {/* MEMBERS */}
            <Link
              to={
                `/educator/courses/${course.courseId}/members`
              }
              className="
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
                  w-10
                  h-10
                  rounded-lg
                  bg-violet-50
                  flex
                  items-center
                  justify-center
                "
              >
                <svg
                  className="
                    w-5
                    h-5
                    text-violet-600
                  "
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2a5 5 0 0110 0v2M12 11a4 4 0 100-8 4 4 0 000 8z"
                  />
                </svg>
              </div>


              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                  mt-4
                "
              >
                Members
              </h3>

              <p
                className="
                  text-xs
                  text-gray-500
                  mt-1
                "
              >
                Review enrollment
                requests and manage
                enrolled learners.
              </p>
            </Link>


            {/* ANNOUNCEMENTS */}
            <Link
              to={
                `/educator/courses/${course.courseId}/announcements`
              }
              className="
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
                  w-10
                  h-10
                  rounded-lg
                  bg-amber-50
                  flex
                  items-center
                  justify-center
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
                    d="M11 5h2m-1-1v2m7 5a7 7 0 01-7 7H8l-4 3v-6a7 7 0 117-4z"
                  />
                </svg>
              </div>


              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                  mt-4
                "
              >
                Announcements
              </h3>

              <p
                className="
                  text-xs
                  text-gray-500
                  mt-1
                "
              >
                Post classroom updates
                and notify enrolled
                learners.
              </p>
            </Link>


            {/* ASSESSMENTS */}
            <Link
              to={
                `/educator/courses/${course.courseId}/assessments`
              }
              className="
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
                  w-10
                  h-10
                  rounded-lg
                  bg-emerald-50
                  flex
                  items-center
                  justify-center
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a3 3 0 006 0M9 12h6m-6 4h6"
                  />
                </svg>
              </div>


              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                  mt-4
                "
              >
                Assessments
              </h3>

              <p
                className="
                  text-xs
                  text-gray-500
                  mt-1
                "
              >
                Create quizzes and
                assignments, manage
                schedules and grading.
              </p>
            </Link>


            {/* ANALYTICS */}
            <Link
              to={
                `/educator/analytics?courseId=${course.courseId}`
              }
              className="
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
                  w-10
                  h-10
                  rounded-lg
                  bg-cyan-50
                  flex
                  items-center
                  justify-center
                "
              >
                <svg
                  className="
                    w-5
                    h-5
                    text-cyan-600
                  "
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 19V9m5 10V5m5 14v-7m5 7V3"
                  />
                </svg>
              </div>


              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                  mt-4
                "
              >
                Analytics
              </h3>

              <p
                className="
                  text-xs
                  text-gray-500
                  mt-1
                "
              >
                Review class-wide
                learning and performance
                statistics.
              </p>
            </Link>


            {/* GRADEBOOK */}
            <Link
              to={
                `/educator/gradebook?courseId=${course.courseId}`
              }
              className="
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
                  w-10
                  h-10
                  rounded-lg
                  bg-rose-50
                  flex
                  items-center
                  justify-center
                "
              >
                <svg
                  className="
                    w-5
                    h-5
                    text-rose-600
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


              <h3
                className="
                  text-sm
                  font-bold
                  text-gray-800
                  mt-4
                "
              >
                Gradebook
              </h3>

              <p
                className="
                  text-xs
                  text-gray-500
                  mt-1
                "
              >
                View official assessment
                scores across the class.
              </p>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}