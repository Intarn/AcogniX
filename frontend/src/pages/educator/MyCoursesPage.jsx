import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link
} from 'react-router';

import {
  archiveCourse,
  getCourses
} from '../../features/classroom/courseApi';


const ENROLLMENTS_KEY =
  'acognix_enrollments';


function getStoredArray(key) {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(key)
      );

    return Array.isArray(value)
      ? value
      : [];
  } catch {
    return [];
  }
}


export default function MyCoursesPage() {
  const [
    courses,
    setCourses
  ] = useState([]);

  const [
  loading,
  setLoading
] = useState(true);


const [
  loadError,
  setLoadError
] = useState('');

  const enrollments =
  useMemo(
    () =>
      getStoredArray(
        ENROLLMENTS_KEY
      ),
    []
  );


  const [
    courseToArchive,
    setCourseToArchive
  ] = useState(null);


  /*
   * ACTIVE trước,
   * ARCHIVED sau.
   *
   * Trong mỗi nhóm:
   * course mới hơn nằm trước.
   */
  function getApprovedLearnerCount(
    courseId
  ) {
    const learnerIds =
      enrollments
        .filter(
          (enrollment) =>
            String(
              enrollment.courseId
            ) ===
              String(courseId) &&
            enrollment.status ===
              'APPROVED'
        )
        .map(
          (enrollment) =>
            String(
              enrollment.learnerId
            )
        );


    return new Set(
      learnerIds
    ).size;
  }
  
  useEffect(() => {
    async function loadCourses() {
      try {
        const result =
          await getCourses();


        setCourses(
          Array.isArray(
            result?.courses
          )
            ? result.courses
            : []
        );
      } catch (error) {
        console.error(
          'Unable to load courses:',
          error
        );
      }
    }


    loadCourses();
  }, []);

  const sortedCourses =
    useMemo(() => {
      return [...courses].sort(
        (first, second) => {
          if (
            first.status !==
            second.status
          ) {
            if (
              first.status ===
              'ACTIVE'
            ) {
              return -1;
            }

            if (
              second.status ===
              'ACTIVE'
            ) {
              return 1;
            }
          }


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
    }, [courses]);


  function openArchiveDialog(
    course
  ) {
    setCourseToArchive(
      course
    );
  }


  function closeArchiveDialog() {
    setCourseToArchive(
      null
    );
  }


  async function handleArchiveCourse() {
    if (!courseToArchive) {
      return;
    }

    try {
      const result =
        await archiveCourse(
          courseToArchive.courseId
        );

      const archivedCourse =
        result.course;

      setCourses(
        (previousCourses) =>
          previousCourses.map(
            (course) =>
              String(
                course.courseId
              ) ===
              String(
                archivedCourse.courseId
              )
                ? archivedCourse
                : course
          )
      );

      setCourseToArchive(null);
    } catch (error) {
      console.error(
        'Unable to archive course:',
        error
      );

      alert(
        error.message ||
        'Unable to archive course.'
      );
    }
  }


  return (
    <>
      {/* TOPBAR */}
      <header
        className="
          h-16
          bg-white
          border-b
          border-gray-100
          flex
          items-center
          justify-between
          px-6
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
            My Courses
          </h1>

          <p
            className="
              text-xs
              text-gray-400
              mt-0.5
            "
          >
            Manage the courses you teach.
          </p>
        </div>


        <Link
          to="/educator/courses/new"
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
          + Create New Course
        </Link>
      </header>


      {/* CONTENT */}
      <main
        className="
          flex-1
          min-h-0
          overflow-y-auto
          p-6
        "
      >
        {sortedCourses.length === 0 ? (
          /*
           * EMPTY STATE
           */
          <div
            className="
              min-h-[300px]
              flex
              items-center
              justify-center
            "
          >
            <div
              className="
                text-center
                max-w-md
              "
            >
              <div
                className="
                  w-14
                  h-14
                  mx-auto
                  rounded-full
                  bg-blue-50
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
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>


              <h2
                className="
                  text-base
                  font-bold
                  text-gray-800
                "
              >
                No courses yet
              </h2>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                Create your first course
                to begin managing learners,
                materials, announcements,
                and assessments.
              </p>


              <Link
                to="/educator/courses/new"
                className="
                  inline-block
                  mt-4
                  text-sm
                  font-semibold
                  text-blue-600
                  hover:underline
                "
              >
                Create a course
              </Link>
            </div>
          </div>
        ) : (
          /*
           * COURSE GRID
           */
          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              xl:grid-cols-3
              gap-5
            "
          >
            {sortedCourses.map(
              (course) => {
                const isArchived =
                  course.status ===
                  'ARCHIVED';


                return (
                  <article
                    key={
                      course.courseId
                    }
                    className="
                      bg-white
                      rounded-xl
                      border
                      border-gray-100
                      shadow-sm
                      overflow-hidden
                      flex
                      flex-col
                    "
                  >
                    {/* TOP DECORATION */}
                    <div
                      className={`
                        h-2

                        ${
                          isArchived
                            ? 'bg-gray-300'
                            : 'bg-blue-500'
                        }
                      `}
                    />


                    <div
                      className="
                        p-5
                        flex-1
                        flex
                        flex-col
                      "
                    >
                      {/* HEADER */}
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-3
                        "
                      >
                        <div
                          className="
                            min-w-0
                          "
                        >
                          <h2
                            className="
                              text-base
                              font-bold
                              text-gray-800
                              truncate
                            "
                            title={
                              course.subjectName
                            }
                          >
                            {
                              course.subjectName
                            }
                          </h2>


                          <p
                            className="
                              text-xs
                              text-gray-500
                              mt-1
                            "
                          >
                            {
                              course.courseCode
                            }
                          </p>
                        </div>


                        <span
                          className={`
                            flex-shrink-0
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


                      {/* DESCRIPTION */}
                      <p
                        className="
                          text-sm
                          text-gray-500
                          mt-4
                          line-clamp-3
                          min-h-[60px]
                        "
                      >
                        {
                          course.description ||
                          'No description provided.'
                        }
                      </p>


                      {/* COURSE INFORMATION */}
                      <div
                        className="
                          mt-5
                          space-y-3
                        "
                      >
                        <div
                          className="
                            flex
                            items-center
                            justify-between
                            gap-3
                          "
                        >
                          <span
                            className="
                              text-xs
                              text-gray-400
                            "
                          >
                            Enrollment Code
                          </span>


                          <span
                            className={`
                              text-xs
                              font-bold
                              tracking-wider

                              ${
                                isArchived
                                  ? 'text-gray-400'
                                  : 'text-gray-700'
                              }
                            `}
                          >
                            {
                              course.enrollmentCode ||
                              'N/A'
                            }
                          </span>
                        </div>


                        <div
                          className="
                            flex
                            items-center
                            justify-between
                            gap-3
                          "
                        >
                          <span
                            className="
                              text-xs
                              text-gray-400
                            "
                          >
                            Learners
                          </span>


                          <span
                            className="
                              text-xs
                              font-semibold
                              text-gray-700
                            "
                          >
                            {
                              getApprovedLearnerCount(
                                course.courseId
                              )
                            }
                          </span>
                        </div>
                      </div>


                      {/* ARCHIVED MESSAGE */}
                      {isArchived && (
                        <div
                          className="
                            mt-4
                            bg-gray-50
                            border
                            border-gray-100
                            rounded-lg
                            px-3
                            py-2
                          "
                        >
                          <p
                            className="
                              text-[11px]
                              text-gray-500
                            "
                          >
                            This course is
                            archived. New
                            enrollment is
                            disabled, but
                            historical data
                            remains available.
                          </p>
                        </div>
                      )}


                      {/* ACTIONS */}
                      <div
                        className="
                          mt-auto
                          pt-5
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <Link
                          to={
                            `/educator/courses/${course.courseId}`
                          }
                          className="
                            flex-1
                            text-center
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
                          View Details
                        </Link>


                        {!isArchived && (
                          <>
                            <Link
                              to={
                                `/educator/courses/${course.courseId}/edit`
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


                            <button
                              type="button"
                              onClick={() =>
                                openArchiveDialog(
                                  course
                                )
                              }
                              className="
                                text-xs
                                font-semibold
                                text-amber-700
                                bg-amber-50
                                px-3
                                py-2
                                rounded-lg
                                hover:bg-amber-100
                              "
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </main>


      {/* ARCHIVE CONFIRMATION */}
      {courseToArchive && (
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
              rounded-xl
              shadow-xl
              w-full
              max-w-md
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
                Archive Course?
              </h2>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                This Course will no
                longer be available as
                an active Course. Do you
                want to continue?
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
                    courseToArchive
                      .subjectName
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
                    courseToArchive
                      .courseCode
                  }
                </p>
              </div>


              <p
                className="
                  text-xs
                  text-gray-400
                  mt-4
                "
              >
                The enrollment code will
                no longer be available
                for new enrollment.
                Existing historical data
                will be preserved.
              </p>
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
                  closeArchiveDialog
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
                  handleArchiveCourse
                }
                className="
                  text-sm
                  font-semibold
                  text-white
                  bg-amber-600
                  hover:bg-amber-700
                  px-4
                  py-2
                  rounded-lg
                "
              >
                Archive Course
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}